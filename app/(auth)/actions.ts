'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/database/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { headers } from 'next/headers'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().min(1, 'Full name is required'),
})

export interface AuthActionState {
  error?: string
}

export async function signInAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid credentials' }
  }

  const forwardedFor = (await headers()).get('x-forwarded-for') ?? 'unknown'
  const { allowed } = await checkRateLimit(`login:${forwardedFor}`, RATE_LIMITS.LOGIN.limit, RATE_LIMITS.LOGIN.windowMs)
  if (!allowed) {
    return { error: 'Too many login attempts. Please try again in a minute.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: 'Invalid email or password.' }
  }

  redirect('/dashboard')
}

export async function signUpAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid details' }
  }

  const supabase = await createClient()
  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_APP_URL

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/onboarding')
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
