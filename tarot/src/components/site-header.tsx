import Link from "next/link";
import { PRODUCT_NAME } from "@/data/scenes";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="font-medium tracking-wide text-primary">
          {PRODUCT_NAME}
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/history">历史</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings">设置</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/reading/new">新占卜</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
