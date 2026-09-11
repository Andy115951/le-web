import type { DetailLevel, RitualSpeed, SceneId, SpreadType } from "@/data/scenes";
import { drawSpread } from "@/lib/draw";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Message, Reading, ReadingStatus, SpreadResult } from "@/lib/types";

function mapReading(row: Record<string, unknown>): Reading {
  return {
    id: row.id as string,
    userId: (row.user_id as string) ?? null,
    anonymousId: (row.anonymous_id as string) ?? null,
    title: (row.title as string) || "",
    question: row.question as string,
    scene: row.scene as SceneId,
    spreadType: row.spread_type as SpreadType,
    spreadResult: row.spread_result as SpreadResult,
    status: row.status as ReadingStatus,
    detailLevel: row.detail_level as DetailLevel,
    ritualSpeed: row.ritual_speed as RitualSpeed,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: (row.deleted_at as string) ?? null,
  };
}

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    readingId: row.reading_id as string,
    role: row.role as Message["role"],
    content: row.content as string,
    createdAt: row.created_at as string,
  };
}

export async function createReading(input: {
  userId: string | null;
  anonymousId: string | null;
  question: string;
  scene: SceneId;
  spreadType: SpreadType;
  detailLevel: DetailLevel;
  ritualSpeed: RitualSpeed;
}) {
  const supabase = getSupabaseAdmin();
  const spreadResult = drawSpread(input.spreadType);
  const title =
    input.question.trim().slice(0, 24) + (input.question.trim().length > 24 ? "…" : "");
  const { data, error } = await supabase
    .from("tarot_readings")
    .insert({
      user_id: input.userId,
      anonymous_id: input.userId ? null : input.anonymousId,
      title,
      question: input.question.trim(),
      scene: input.scene,
      spread_type: input.spreadType,
      spread_result: spreadResult,
      status: "revealed",
      detail_level: input.detailLevel,
      ritual_speed: input.ritualSpeed,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapReading(data);
}

export async function getReading(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tarot_readings")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapReading(data) : null;
}

export async function listReadings(opts: { userId?: string | null; anonymousId?: string | null }) {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("tarot_readings")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  else if (opts.anonymousId) q = q.eq("anonymous_id", opts.anonymousId);
  else return [];
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapReading);
}

export async function updateReadingStatus(id: string, status: ReadingStatus) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("tarot_readings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function renameReading(id: string, title: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("tarot_readings")
    .update({ title: title.trim().slice(0, 40), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function softDeleteReading(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("tarot_readings")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listMessages(readingId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tarot_messages")
    .select("*")
    .eq("reading_id", readingId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMessage);
}

export async function addMessage(
  readingId: string,
  role: Message["role"],
  content: string,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tarot_messages")
    .insert({ reading_id: readingId, role, content })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await supabase
    .from("tarot_readings")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", readingId);
  return mapMessage(data);
}

export async function canAccessReading(
  reading: Reading,
  userId: string | null,
  anonymousId: string | null,
) {
  if (userId && reading.userId === userId) return true;
  if (!userId && anonymousId && reading.anonymousId === anonymousId) return true;
  return false;
}

/** usage helpers */
export async function bumpUsage(
  subjectKey: string,
  kind: "reading" | "message",
) {
  const supabase = getSupabaseAdmin();
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("tarot_usage_counters")
    .select("*")
    .eq("subject_key", subjectKey)
    .eq("day", day)
    .maybeSingle();
  if (!data) {
    await supabase.from("tarot_usage_counters").insert({
      subject_key: subjectKey,
      day,
      readings_count: kind === "reading" ? 1 : 0,
      messages_count: kind === "message" ? 1 : 0,
    });
    return { readings: kind === "reading" ? 1 : 0, messages: kind === "message" ? 1 : 0 };
  }
  const readings = data.readings_count + (kind === "reading" ? 1 : 0);
  const messages = data.messages_count + (kind === "message" ? 1 : 0);
  await supabase
    .from("tarot_usage_counters")
    .update({ readings_count: readings, messages_count: messages })
    .eq("subject_key", subjectKey)
    .eq("day", day);
  return { readings, messages };
}

export async function getUsage(subjectKey: string) {
  const supabase = getSupabaseAdmin();
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("tarot_usage_counters")
    .select("*")
    .eq("subject_key", subjectKey)
    .eq("day", day)
    .maybeSingle();
  return {
    readings: data?.readings_count ?? 0,
    messages: data?.messages_count ?? 0,
  };
}

export const QUOTAS = {
  guest: { readings: 1, messages: 5 },
  user: { readings: 10, messages: 100 },
} as const;


/** Trim + collapse internal whitespace for same-question matching. */
export function normalizeQuestion(q: string): string {
  return q.trim().replace(/\s+/g, " ");
}

/**
 * Most recent earlier reading with the same normalized question for this owner.
 * Ignores soft-deleted; requires spread_result; excludes excludeId.
 */
export async function findPriorReadingByQuestion(opts: {
  question: string;
  userId?: string | null;
  anonymousId?: string | null;
  excludeId: string;
}): Promise<Reading | null> {
  const normalized = normalizeQuestion(opts.question);
  if (!normalized) return null;

  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("tarot_readings")
    .select("*")
    .is("deleted_at", null)
    .neq("id", opts.excludeId)
    .not("spread_result", "is", null)
    .order("created_at", { ascending: false })
    .limit(80);

  if (opts.userId) q = q.eq("user_id", opts.userId);
  else if (opts.anonymousId) q = q.eq("anonymous_id", opts.anonymousId);
  else return null;

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const match = (data ?? []).find(
    (row) => normalizeQuestion(String(row.question ?? "")) === normalized,
  );
  return match ? mapReading(match) : null;
}
