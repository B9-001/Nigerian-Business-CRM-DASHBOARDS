import Link from 'next/link'
import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to your organization&apos;s workspace.</p>

      <LoginForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-primary hover:text-primary-hover">
          Create one
        </Link>
      </p>
    </div>
  )
}
