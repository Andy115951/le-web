import { notFound } from "next/navigation";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import {
  canAccessReading,
  findPriorReadingByQuestion,
  getReading,
  listMessages,
} from "@/lib/store/readings";
import { ReadingClient } from "@/components/reading/reading-client";

export default async function ReadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const reading = await getReading(id);
  if (!reading || !(await canAccessReading(reading, user?.id ?? null, anon))) {
    notFound();
  }
  const messages = await listMessages(id);
  const prior = await findPriorReadingByQuestion({
    question: reading.question,
    userId: user?.id ?? null,
    anonymousId: user ? null : anon,
    excludeId: reading.id,
  });
  return (
    <ReadingClient
      initialReading={reading}
      initialMessages={messages}
      priorReading={prior}
    />
  );
}
