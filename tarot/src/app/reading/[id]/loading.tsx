export default function ReadingLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="加载中">
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-muted/70" />
        <div className="h-7 w-3/4 max-w-lg rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="h-5 w-14 rounded-full bg-muted/60" />
          <div className="h-5 w-16 rounded-full bg-muted/60" />
        </div>
      </div>
      <div className="ritual-panel relative overflow-hidden rounded-xl border border-primary/20 bg-card/50 p-8 text-center">
        <div className="mx-auto h-3 w-16 rounded bg-primary/30" />
        <div className="mx-auto mt-4 h-5 w-28 rounded bg-muted/80" />
        <div className="mx-auto mt-4 h-1 max-w-xs rounded-full bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-xl border border-border/50 bg-card/60"
          />
        ))}
      </div>
    </div>
  );
}
