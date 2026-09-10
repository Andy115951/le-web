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
          选择场景，确认问题后起卦。牌面将在服务端生成（P1）。
        </p>
      </div>
      <NewReadingForm initialSceneId={sp.scene} />
    </div>
  );
}
