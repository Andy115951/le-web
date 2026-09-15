/** Trim + collapse internal whitespace for same-question matching (P32/P41/P46). */
export function normalizeQuestion(q: string): string {
  return q.trim().replace(/\s+/g, " ");
}
