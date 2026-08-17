import Link from 'next/link'
import { SignupForm } from './signup-form'

export default function SignupPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">Start running your business from one workspace.</p>

      <SignupForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </div>
  )
}
