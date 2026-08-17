import { type NextRequest } from 'next/server'
import { requirePermission, can } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { routeModel, estimateCostNgn } from '@/lib/ai/router'
import { getToolSchemas, executeTool } from '@/lib/ai-tools'
import { AIProviderNotConfiguredError, type AIMessage } from '@/lib/ai/providers/types'

const SYSTEM_PROMPT_TEMPLATE = (orgName: string) => `You are the AI assistant for "${orgName}", a business operating system for Nigerian companies.

You MUST use the provided tools to answer any question about this organization's real data (employees, tasks, projects, customers, meetings, tickets). NEVER invent or assume internal company information. If a tool returns an error, forbidden, or no results, tell the user plainly that you don't have that information or it doesn't exist — do not guess or fabricate details.

Be concise and practical. Currency is NGN (₦). Timezone is Africa/Lagos.`

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requirePermission(PERMISSIONS.AI_USE)

    const { allowed } = await checkRateLimit(
      `ai-chat:${profile.organization_id}:${user.id}`,
      RATE_LIMITS.AI_CHAT.limit,
      RATE_LIMITS.AI_CHAT.windowMs
    )
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please slow down.' }), { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const userMessage: string = typeof body.message === 'string' ? body.message : ''
    if (!userMessage.trim()) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 })
    }

    const supabase = await createClient()

    const { data: org } = await supabase.from('organizations').select('name').eq('id', profile.organization_id).single()

    let conversationId: string | undefined = typeof body.conversationId === 'string' ? body.conversationId : undefined
    if (!conversationId) {
      const { data: conv } = await supabase
        .from('ai_conversations')
        .insert({ organization_id: profile.organization_id, user_id: user.id, agent_type: 'EXECUTIVE', title: userMessage.slice(0, 80) })
        .select('id')
        .single()
      conversationId = conv?.id
    }

    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'Could not start conversation' }), { status: 500 })
    }

    await supabase.from('ai_messages').insert({ organization_id: profile.organization_id, conversation_id: conversationId, role: 'user', content: userMessage })

    const { provider, model } = routeModel('simple')

    const messages: AIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT_TEMPLATE(org?.name ?? 'your organization') },
      { role: 'user', content: userMessage },
    ]

    const toolCtx = { supabase, organizationId: profile.organization_id, userId: user.id, can }

    let totalInputTokens = 0
    let totalOutputTokens = 0
    let finalText = ''

    try {
      // Tool-resolution pass (non-streaming): let the model decide which
      // tools to call, execute them, then feed results back.
      let round = 0
      while (round < 4) {
        const completion = await provider.complete(messages, { model, tools: getToolSchemas() })
        totalInputTokens += completion.usage.inputTokens
        totalOutputTokens += completion.usage.outputTokens

        if (completion.toolCalls.length === 0) {
          finalText = completion.content
          break
        }

        messages.push({ role: 'assistant', content: completion.content || '' })
        for (const call of completion.toolCalls) {
          const result = await executeTool(call.name, call.arguments, toolCtx)
          messages.push({ role: 'tool', content: JSON.stringify(result), toolCallId: call.id, name: call.name })
        }
        round += 1
      }

      if (!finalText) {
        const last = await provider.complete(messages, { model })
        finalText = last.content
        totalInputTokens += last.usage.inputTokens
        totalOutputTokens += last.usage.outputTokens
      }
    } catch (err) {
      if (err instanceof AIProviderNotConfiguredError) {
        finalText = "AI isn't configured yet for this workspace. An administrator needs to add an OpenAI or Google AI API key in the environment configuration."
      } else {
        console.error('[ai/chat] provider error', err)
        finalText = 'Something went wrong reaching the AI provider. Please try again shortly.'
      }
    }

    await supabase.from('ai_messages').insert({ organization_id: profile.organization_id, conversation_id: conversationId, role: 'assistant', content: finalText })

    const admin = createAdminClient()
    await admin.from('ai_usage').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      provider: provider.name,
      model,
      tokens_input: totalInputTokens,
      tokens_output: totalOutputTokens,
      estimated_cost_ngn: estimateCostNgn(model, totalInputTokens, totalOutputTokens),
      workflow: 'ai_chat',
    })

    return new Response(JSON.stringify({ conversationId, message: finalText }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[ai/chat] unhandled error', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })
  }
}
