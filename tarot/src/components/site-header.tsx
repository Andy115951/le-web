import Link from "next/link";
import { PRODUCT_NAME } from "@/data/scenes";
import { getCurrentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";

export async function SiteHeader() {
  const user = await getCurrentUser();
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
          {user ? (
            <LogoutButton label={user.username} />
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">登录</Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href="/reading/new">新占卜</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
