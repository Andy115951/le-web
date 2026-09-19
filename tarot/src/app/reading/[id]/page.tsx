import { notFound } from "next/navigation";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { isReadingId } from "@/lib/reading-id";
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
  // Call notFound before cookies() — reading cookies first makes Next.js
  // return HTTP 200 while still rendering the 404 UI (see /s/[token] contrast).
  if (!isReadingId(id)) notFound();

  const reading = await getReading(id);
  if (!reading) notFound();

  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  if (!(await canAccessReading(reading, user?.id ?? null, anon))) {
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
