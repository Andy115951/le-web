import { NewReadingForm } from "./new-reading-form";

export default async function NewReadingPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">新占卜</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          选好场景，把问题轻轻放下；确认后开始仪式，牌面会在静心里揭晓。
        </p>
      </div>
      <NewReadingForm initialSceneId={sp.scene} />
    </div>
  );
}
