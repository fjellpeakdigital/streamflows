export default function RiverDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Back link placeholder */}
      <div className="mb-5 h-8 w-24 rounded-md bg-muted animate-pulse" />

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Header card */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-7 w-64 rounded bg-muted animate-pulse" />
                <div className="h-4 w-40 rounded bg-muted animate-pulse" />
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
                <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
              </div>
            </div>
          </div>

          {/* Conditions summary card */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="h-5 w-40 rounded bg-muted animate-pulse" />
            <div className="h-4 w-full rounded bg-muted animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
          </div>

          {/* Current conditions card */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="h-5 w-36 rounded bg-muted animate-pulse" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                  <div className="h-6 w-20 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
            <div className="h-3 w-32 rounded bg-muted animate-pulse" />
          </div>

          {/* Chart card */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="h-5 w-44 rounded bg-muted animate-pulse" />
            <div className="h-56 w-full rounded-lg bg-muted animate-pulse" />
          </div>

          {/* Notes card */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="h-5 w-28 rounded bg-muted animate-pulse" />
            <div className="h-20 w-full rounded-md bg-muted animate-pulse" />
            <div className="h-8 w-20 rounded-md bg-muted animate-pulse" />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Reservoir card */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted animate-pulse" />
              <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
            </div>
          </div>

          {/* Weather card */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="h-5 w-36 rounded bg-muted animate-pulse" />
            <div className="grid grid-cols-5 gap-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-1 flex flex-col items-center">
                  <div className="h-3 w-8 rounded bg-muted animate-pulse" />
                  <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
                  <div className="h-3 w-6 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Historical card */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="h-5 w-40 rounded bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-muted animate-pulse" />
            </div>
          </div>

          {/* Species card */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
            <div className="flex flex-wrap gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-6 w-20 rounded-full bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
