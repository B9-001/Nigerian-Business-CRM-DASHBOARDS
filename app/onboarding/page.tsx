import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const { profile } = await requireUser()
  if (profile?.organization_id) redirect('/dashboard')

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white font-bold">N</div>
          <span className="text-lg font-bold text-foreground">Nigerian Business OS</span>
        </div>
        <div className="rounded-card border border-border bg-surface p-7 shadow-soft">
          <h1 className="text-xl font-bold text-foreground">Set up your organization</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This creates your workspace. You&apos;ll be the owner and can invite your team next.
          </p>
          <OnboardingForm />
        </div>
      </div>
    </div>
  )
}
