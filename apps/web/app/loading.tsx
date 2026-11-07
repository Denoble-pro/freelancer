export default function Loading() {
  return (
    <div className="min-h-screen bg-background" aria-busy="true">
      <div className="border-b border-border bg-surface">
        <div className="container-page flex h-[74px] items-center justify-between">
          <div className="h-8 w-36 animate-pulse rounded-md bg-surface-muted" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-surface-muted" />
        </div>
      </div>
      <div className="container-page py-16">
        <div className="h-5 w-32 animate-pulse rounded bg-surface-muted" />
        <div className="mt-6 h-14 w-full max-w-2xl animate-pulse rounded-lg bg-surface-muted" />
        <div className="mt-3 h-14 w-full max-w-xl animate-pulse rounded-lg bg-surface-muted" />
        <div className="mt-8 h-4 w-full max-w-lg animate-pulse rounded bg-surface-muted" />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-lg bg-surface-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
