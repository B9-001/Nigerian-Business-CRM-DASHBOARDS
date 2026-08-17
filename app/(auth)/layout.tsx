export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white font-bold">N</div>
          <span className="text-lg font-bold text-foreground">Nigerian Business OS</span>
        </div>
        <div className="rounded-card border border-border bg-surface p-7 shadow-soft">{children}</div>
      </div>
    </div>
  )
}
