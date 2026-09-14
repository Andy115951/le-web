export default function NewReadingLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="加载中">
      <div className="space-y-2">
        <div className="h-8 w-28 rounded-md bg-muted" />
        <div className="h-4 w-full max-w-md rounded bg-muted/70" />
      </div>
      <div className="h-5 w-48 rounded bg-muted/60" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-8 w-16 rounded-md bg-muted/80" />
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-4 w-20 rounded bg-muted/70" />
        <div className="h-24 w-full rounded-lg border border-border/40 bg-card/50" />
      </div>
      <div className="h-12 w-full rounded-xl border border-border/50 bg-card/40" />
      <div className="h-11 w-36 rounded-md bg-primary/25" />
    </div>
  );
}
