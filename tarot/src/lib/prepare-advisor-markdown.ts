/** Escape text for safe HTML injection into sanitized markdown. */
function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * CommonMark often fails to parse **bold** when glued to CJK text and/or
 * fullwidth parentheses inside the span (e.g. 。**权杖四（逆位）**在…).
 * Convert those markers to HTML <strong> before markdown.
 */
export function prepareAdvisorMarkdown(source: string): string {
  let s = source.replace(/\uFF0A/g, "*").replace(/＊/g, "*");
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, (_m, inner: string) => {
    return `<strong>${escapeHtml(inner)}</strong>`;
  });
  return s;
}
