import { type NextRequest } from 'next/server'
import { requirePermission, can } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { routeModel, getFallbackProvider, estimateCostNgn } from '@/lib/ai/router'
import { getToolSchemas, executeTool } from '@/lib/ai-tools'
import { AIProviderNotConfiguredError, AIProviderRequestError, AIProviderTimeoutError, type AIMessage } from '@/lib/ai/providers/types'
import { getAgent, type AgentType } from '@/lib/ai/agents'
import { canAccessFeature } from '@/lib/billing/entitlements'
import { checkUsageLimit, incrementUsage } from '@/lib/billing/usage'
import { logAIEvent } from '@/lib/ai/logging'

const SYSTEM_PROMPT_TEMPLATE = (orgName: string, agentFocus: string) => `You are the AI assistant for "${orgName}", a business operating system for Nigerian companies.

${agentFocus}

You MUST use the provided tools to answer any question about this organization's real data (employees, tasks, projects, customers, meetings, tickets). NEVER invent or assume internal company information. If a tool returns an error, forbidden, or no results, tell the user plainly that you don't have that information or it doesn't exist — do not guess or fabricate details.

Be concise and practical. Currency is NGN (₦). Timezone is Africa/Lagos.`

export async function POST(request: NextRequest) {
  const start = Date.now()
  try {
    const body = await request.json().catch(() => ({}))
    const agent = getAgent(typeof body.agentType === 'string' ? (body.agentType as AgentType) : undefined)

    const { user, profile } = await requirePermission(agent.permission)

    const { allowed: withinRateLimit } = await checkRateLimit(
      `ai-chat:${profile.organization_id}:${user.id}`,
      RATE_LIMITS.AI_CHAT.limit,
      RATE_LIMITS.AI_CHAT.windowMs
    )
    if (!withinRateLimit) {
      return Response.json({ error: 'Rate limit exceeded. Please slow down.' }, { status: 429 })
    }

    // Plan entitlement + monthly usage cap — connects AI usage to the
    // subscription/entitlement system (lib/billing), not just permissions.
    const [hasFeature, usage] = await Promise.all([
      canAccessFeature('ai_assistant'),
      checkUsageLimit(profile.organization_id, 'ai_requests', 'max_ai_requests_month'),
    ])
    if (!hasFeature) {
      return Response.json({ error: "Your organization's plan doesn't include the AI Assistant. Upgrade in Settings → Billing." }, { status: 403 })
    }
    if (!usage.allowed) {
      return Response.json(
        { error: `Your organization has reached its monthly AI request limit (${usage.limit}). Upgrade your plan for more.` },
        { status: 429 }
      )
    }

    const userMessage: string = typeof body.message === 'string' ? body.message : ''
    if (!userMessage.trim()) {
      return Response.json({ error: 'Message is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: org } = await supabase.from('organizations').select('name').eq('id', profile.organization_id).single()

    let conversationId: string | undefined = typeof body.conversationId === 'string' ? body.conversationId : undefined
    if (!conversationId) {
      const { data: conv } = await supabase
        .from('ai_conversations')
        .insert({ organization_id: profile.organization_id, user_id: user.id, agent_type: agent.type, title: userMessage.slice(0, 80) })
        .select('id')
        .single()
      conversationId = conv?.id
    }

    if (!conversationId) {
      return Response.json({ error: 'Could not start conversation' }, { status: 500 })
    }

    await supabase.from('ai_messages').insert({ organization_id: profile.organization_id, conversation_id: conversationId, role: 'user', content: userMessage })

    const { provider, model } = routeModel(agent.routeTask)

    const messages: AIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT_TEMPLATE(org?.name ?? 'your organization', agent.systemPromptFocus) },
      { role: 'user', content: userMessage },
    ]

    const toolCtx = { supabase, organizationId: profile.organization_id, userId: user.id, can }
    const availableTools = agent.toolNames ? getToolSchemas().filter((t) => agent.toolNames!.includes(t.name)) : getToolSchemas()

    let totalInputTokens = 0
    let totalOutputTokens = 0
    let finalText = ''
    let usedProviderName = provider.name

    async function runWithProvider(activeProvider: typeof provider) {
      let round = 0
      while (round < 4) {
        const completion = await activeProvider.complete(messages, { model, tools: availableTools })
        totalInputTokens += completion.usage.inputTokens
        totalOutputTokens += completion.usage.outputTokens

        if (completion.toolCalls.length === 0) {
          finalText = completion.content
          return
        }

        messages.push({ role: 'assistant', content: completion.content || '' })
        for (const call of completion.toolCalls) {
          const result = await executeTool(call.name, call.arguments, toolCtx)
          messages.push({ role: 'tool', content: JSON.stringify(result), toolCallId: call.id, name: call.name })
        }
        round += 1
      }

      if (!finalText) {
        const last = await activeProvider.complete(messages, { model })
        finalText = last.content
        totalInputTokens += last.usage.inputTokens
        totalOutputTokens += last.usage.outputTokens
      }
    }

    try {
      await runWithProvider(provider)
    } catch (primaryErr) {
      // Failure resilience (CLAUDE.md #62): ANY provider-level failure —
      // not just "missing API key" — falls back to the configured
      // secondary provider once before giving up. This matters in
      // practice: a provider can be correctly configured (valid key) and
      // still fail transiently (rate limit, exhausted quota, timeout,
      // momentary outage), and the user shouldn't see a dead end just
      // because the *default* provider happens to be the one having a
      // bad moment.
      const isProviderFailure =
        primaryErr instanceof AIProviderNotConfiguredError ||
        primaryErr instanceof AIProviderTimeoutError ||
        primaryErr instanceof AIProviderRequestError

      let fallbackSucceeded = false
      if (isProviderFailure) {
        const fallback = getFallbackProvider()
        if (fallback.name !== provider.name) {
          try {
            usedProviderName = fallback.name
            await runWithProvider(fallback)
            fallbackSucceeded = true
          } catch (fallbackErr) {
            logAIEvent({ event: 'ai.request.error', provider: fallback.name, model, error: `fallback also failed: ${describeError(fallbackErr)}` })
          }
        }
      }

      if (!fallbackSucceeded) {
        if (primaryErr instanceof AIProviderNotConfiguredError) {
          finalText = "AI isn't configured yet for this workspace. An administrator needs to add an OpenAI or Gemini API key in the environment configuration."
        } else if (primaryErr instanceof AIProviderTimeoutError) {
          finalText = 'The AI provider took too long to respond. Please try again.'
        } else if (primaryErr instanceof AIProviderRequestError) {
          finalText = `The AI provider couldn't complete this request right now (${primaryErr.message.includes('quota') || primaryErr.message.includes('credit') ? 'no usage credits remaining on the configured account' : 'temporary provider error'}). Please try again shortly, or ask an administrator to check the AI provider account.`
        } else {
          console.error('[ai/chat] unexpected provider error', describeError(primaryErr))
          finalText = 'Something went wrong. Please try again shortly.'
        }
      }
    }

    await supabase.from('ai_messages').insert({ organization_id: profile.organization_id, conversation_id: conversationId, role: 'assistant', content: finalText })

    const admin = createAdminClient()
    await admin.from('ai_usage').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      provider: usedProviderName,
      model,
      tokens_input: totalInputTokens,
      tokens_output: totalOutputTokens,
      estimated_cost_ngn: estimateCostNgn(model, totalInputTokens, totalOutputTokens),
      workflow: `ai_chat:${agent.type.toLowerCase()}`,
    })

    if (totalInputTokens + totalOutputTokens > 0) {
      await incrementUsage(profile.organization_id, 'ai_requests')
    }

    logAIEvent({
      event: 'ai.request.success',
      provider: usedProviderName,
      model,
      workflow: `ai_chat:${agent.type}`,
      organizationId: profile.organization_id,
      userId: user.id,
      durationMs: Date.now() - start,
      tokensInput: totalInputTokens,
      tokensOutput: totalOutputTokens,
    })

    return Response.json({ conversationId, message: finalText, agentType: agent.type })
  } catch (err) {
    console.error('[ai/chat] unhandled error', describeError(err))
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
