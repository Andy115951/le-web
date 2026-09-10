import { SiteHeader } from "@/components/site-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        仅供娱乐与自我反思，不构成任何现实决策建议。
      </footer>
    </div>
  );
}
