export default function HistoryLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="加载中">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-8 w-20 rounded-md bg-muted" />
          <div className="h-4 w-40 rounded bg-muted/70" />
        </div>
        <div className="h-9 w-20 rounded-md bg-primary/25" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="h-5 w-2/3 max-w-xs rounded bg-muted" />
              <div className="h-5 w-12 rounded-full bg-muted/60" />
            </div>
            <div className="flex gap-2">
              <div className="h-4 w-16 rounded bg-muted/70" />
              <div className="h-4 w-24 rounded bg-muted/50" />
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-14 w-10 rounded bg-muted/40" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
