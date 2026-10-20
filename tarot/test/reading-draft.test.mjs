import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { clearReadingDraft, parseReadingDraft, readReadingDraft, writeReadingDraft } from "../src/lib/reading-draft.ts";

const fields = {
  sceneId: "career", question: "下一周，我该怎样安排手边的事情？\n想先留一点余力。",
  spread: "five_cross", detail: "detailed", speed: "slow",
  silentReveal: true, advancedOpen: true,
};
let values;
const originalWindow = globalThis.window;
beforeEach(() => {
  values = new Map();
  globalThis.window = { localStorage: {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  } };
});
afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test("round-trips the exact question, scene and every form option", () => {
  const saved = writeReadingDraft(fields);
  assert.ok(saved);
  assert.deepEqual(readReadingDraft(), { draft: saved, available: true });
  assert.deepEqual(saved.fields, fields);
});

test("saves immediately and retains intentionally empty questions", () => {
  writeReadingDraft(fields);
  writeReadingDraft({ ...fields, sceneId: "custom", question: "" });
  assert.equal(readReadingDraft().draft.fields.question, "");
  assert.equal(readReadingDraft().draft.fields.sceneId, "custom");
});

test("clearing removes the draft without touching preferences or history favorites", () => {
  values.set("candle-taro:user-prefs", "prefs");
  values.set("candle-taro:history-favorites", "favorites");
  writeReadingDraft(fields);
  assert.equal(clearReadingDraft(), true);
  assert.equal(readReadingDraft().draft, null);
  assert.equal(values.get("candle-taro:user-prefs"), "prefs");
  assert.equal(values.get("candle-taro:history-favorites"), "favorites");
});

test("submission clears its own revision but preserves newer edits from another tab", () => {
  const submitted = writeReadingDraft(fields);
  const newer = writeReadingDraft({ ...fields, question: "另一页还没写完的问题" });
  assert.equal(clearReadingDraft(submitted.id), true);
  assert.equal(readReadingDraft().draft.id, newer.id);
  assert.equal(clearReadingDraft(newer.id), true);
  assert.equal(readReadingDraft().draft, null);
});

test("corrupt, obsolete and invalid form values do not break restoration", () => {
  const good = { version: 1, id: "draft-id", fields };
  for (const raw of [null, "", "{", "null", "[]", JSON.stringify({ ...good, version: 9 }),
    ...[{ sceneId: "unknown" }, { spread: "unknown" }, { detail: "unknown" },
      { speed: "unknown" }, { silentReveal: "false" }, { advancedOpen: 1 },
      { question: "x".repeat(201) }].map(patch => JSON.stringify({ ...good, fields: { ...fields, ...patch } }))]) {
    assert.equal(parseReadingDraft(raw), null);
  }
});

test("blocked browser storage degrades gracefully for reads, writes and clears", () => {
  Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  assert.deepEqual(readReadingDraft(), { draft: null, available: false });
  assert.equal(writeReadingDraft(fields), null);
  assert.equal(clearReadingDraft(), false);
  assert.equal(clearReadingDraft("submitted-id"), false);
});

test("a full browser storage does not destroy the last saved draft", () => {
  const previous = writeReadingDraft(fields);
  window.localStorage.setItem = () => { throw new Error("quota exceeded"); };
  assert.equal(writeReadingDraft({ ...fields, question: "尚未保存的新问题" }), null);
  assert.deepEqual(readReadingDraft().draft, previous);
});
