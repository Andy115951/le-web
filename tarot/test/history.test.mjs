import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_HISTORY_QUERY,
  HISTORY_PAGE_SIZE,
  historySearchFilter,
  parseHistoryQuery,
  queryHistoryRows,
} from "../src/lib/history-query.ts";
import { groupHistory } from "../src/lib/history-groups.ts";
import { normalizeQuestion } from "../src/lib/normalize-question.ts";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = new Date("2026-10-20T00:00:00.000Z");
const rows = Array.from({ length: 65 }, (_, i) => ({
  id: id(i + 1),
  user_id: "user-a",
  anonymous_id: null,
  deleted_at: null,
  question: i === 60 ? "很久以前的海边计划" : `问题 ${i + 1}`,
  title: i === 61 ? "旧标题里的月亮" : `标题 ${i + 1}`,
  scene: i % 2 ? "love" : "career",
  created_at: new Date(+now - i * 86400000).toISOString(),
  updated_at: new Date(+now - i * 86400000).toISOString(),
}));
rows.push({
  ...rows[0],
  id: id(1001),
  user_id: "user-b",
  question: "其他账号的海边计划",
});
rows.push({ ...rows[0], id: id(1002), user_id: null, anonymous_id: "anon-a" });
rows.push({ ...rows[0], id: id(1003), deleted_at: now.toISOString() });

function fixture(data = rows) {
  const calls = [];
  let fail = false;
  const client = createClient("http://fixture.test", "test-only-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (url, init) => {
        const params = new URL(url).searchParams;
        calls.push(params);
        if (fail)
          return new Response(JSON.stringify({ message: "fixture failure" }), {
            status: 500,
          });
        let found = data.filter((row) =>
          [...params].every(([key, value]) => {
            if (["select", "order", "offset", "limit", "or"].includes(key))
              return true;
            if (value === "is.null") return row[key] == null;
            if (value.startsWith("eq.")) return row[key] === value.slice(3);
            if (value.startsWith("gte.")) return row[key] >= value.slice(4);
            if (value.startsWith("lt.")) return row[key] < value.slice(3);
            if (value.startsWith("in.("))
              return value.slice(4, -1).split(",").includes(row[key]);
            throw new Error(`Unhandled ${key}=${value}`);
          }),
        );
        if (params.has("or")) {
          const expression = params.get("or");
          const match = expression.match(
            /^\(title\.imatch\.("(?:\\.|[^"\\])*"),question\.imatch\.("(?:\\.|[^"\\])*")\)$/,
          );
          assert.ok(match, expression);
          assert.equal(match[1], match[2]);
          const regex = new RegExp(JSON.parse(match[1]), "i");
          found = found.filter(
            (r) => regex.test(r.title) || regex.test(r.question),
          );
        }
        found.sort(
          (a, b) =>
            b.updated_at.localeCompare(a.updated_at) ||
            b.id.localeCompare(a.id),
        );
        const total = found.length;
        const offset = Number(params.get("offset") || 0);
        if (offset > 0 && offset >= total) {
          return new Response(
            JSON.stringify({
              code: "PGRST103",
              message: "Requested range not satisfiable",
              details: `An offset of ${offset} was requested, but there are only ${total} rows.`,
            }),
            {
              status: 416,
              headers: { "content-range": `*/${total}` },
            },
          );
        }
        found = found.slice(
          offset,
          offset + Number(params.get("limit") || 1000),
        );
        return new Response(
          init?.method === "HEAD" ? null : JSON.stringify(found),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "content-range": `${offset}-${offset + found.length - 1}/${total}`,
            },
          },
        );
      },
    },
  });
  return {
    client,
    calls,
    fail: () => {
      fail = true;
    },
  };
}
const owner = { userId: "user-a", anonymousId: "anon-a" };
const query = (patch) => ({ ...DEFAULT_HISTORY_QUERY, ...patch });

test("pages beyond the old 50-row cutoff, with stable ordering and no duplicate IDs", async () => {
  const { client, calls } = fixture();
  const all = [];
  for (let offset = 0; offset < 65; offset += HISTORY_PAGE_SIZE) {
    const result = await queryHistoryRows(
      client,
      owner,
      query({ offset }),
      now,
    );
    assert.equal(result.total, 65);
    all.push(...result.rows);
  }
  assert.equal(all.length, 65);
  assert.equal(new Set(all.map((r) => r.id)).size, 65);
  assert.ok(all.some((r) => r.id === id(65)));
  assert.equal(calls[0].get("order"), "updated_at.desc,id.desc");
});

test("question and renamed-title searches find old records outside the initial page", async () => {
  const { client } = fixture();
  for (const [search, expected] of [
    ["海边", 61],
    ["月亮", 62],
  ]) {
    const result = await queryHistoryRows(
      client,
      owner,
      query({ search }),
      now,
    );
    assert.equal(result.total, 1);
    assert.equal(result.rows[0].id, id(expected));
  }
});

test("search escaping keeps wildcard, quotes, commas, parentheses and filter-like text literal", async () => {
  const special = '100% _ * \\ "月亮",user_id.eq.user-b)';
  const data = [{ ...rows[0], question: special }, rows[1]];
  const { client } = fixture(data);
  const result = await queryHistoryRows(
    client,
    owner,
    query({ search: special }),
    now,
  );
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].id, rows[0].id);
  assert.ok(historySearchFilter(special).includes('title.imatch."'));
});

test("owner scope excludes other accounts, guests and soft-deleted rows even with supplied favorites", async () => {
  const { client } = fixture();
  const result = await queryHistoryRows(
    client,
    owner,
    query({ favoriteIds: [id(1), id(1001), id(1002), id(1003)] }),
    now,
  );
  assert.deepEqual(
    result.rows.map((r) => r.id),
    [id(1)],
  );
  const guest = await queryHistoryRows(
    client,
    { anonymousId: "anon-a" },
    query({}),
    now,
  );
  assert.deepEqual(
    guest.rows.map((r) => r.id),
    [id(1002)],
  );
  assert.deepEqual(await queryHistoryRows(client, {}, query({}), now), {
    rows: [],
    total: 0,
  });
});

test("combined scene, date, search and favorite filters apply before pagination", async () => {
  const { client } = fixture();
  const result = await queryHistoryRows(
    client,
    owner,
    query({
      search: "问题",
      scene: "career",
      time: "7d",
      favoriteIds: [id(1), id(2), id(3), id(60)],
    }),
    now,
  );
  assert.deepEqual(
    result.rows.map((r) => r.id),
    [id(1), id(3)],
  );
});

test("date ranges use created_at even if a much older reading was renamed today", async () => {
  const { client } = fixture([{ ...rows[60], updated_at: now.toISOString() }]);
  assert.equal(
    (await queryHistoryRows(client, owner, query({ time: "7d" }), now)).total,
    0,
  );
  assert.equal(
    (await queryHistoryRows(client, owner, query({ time: "older" }), now))
      .total,
    1,
  );
});

test("favorites beyond one URL batch are globally sorted and paginated", async () => {
  const data = Array.from({ length: 215 }, (_, i) => ({
    ...rows[0],
    id: id(i + 1),
  }));
  const { client, calls } = fixture(data);
  const result = await queryHistoryRows(
    client,
    owner,
    query({ favoriteIds: data.map((r) => r.id), offset: 200 }),
    now,
  );
  assert.equal(result.total, 215);
  assert.equal(result.rows.length, 15);
  assert.equal(result.rows[0].id, id(15));
  assert.equal(calls.length, 3);
  assert.deepEqual(
    await queryHistoryRows(client, owner, query({ favoriteIds: [] }), now),
    { rows: [], total: 0 },
  );
});

test("empty result, out-of-range page and database failures are explicit", async () => {
  const { client, fail } = fixture();
  assert.equal(
    (
      await queryHistoryRows(
        client,
        owner,
        query({ search: "不存在的关键词" }),
        now,
      )
    ).total,
    0,
  );
  const beyond = await queryHistoryRows(
    client,
    owner,
    query({ offset: 200 }),
    now,
  );
  assert.equal(beyond.total, 65);
  assert.deepEqual(beyond.rows, []);
  fail();
  await assert.rejects(
    queryHistoryRows(client, owner, query({}), now),
    /fixture failure/,
  );
});

test("PostgREST 416 on an empty or shrunken page becomes an empty page with the true total", async () => {
  for (const data of [[], [rows[0]], rows.slice(0, 21)]) {
    const { client, calls } = fixture(data);
    const result = await queryHistoryRows(
      client,
      owner,
      query({ offset: 40 }),
      now,
    );
    assert.deepEqual(result, { rows: [], total: data.length });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].get("offset"), null);
    assert.equal(calls[1].get("user_id"), "eq.user-a");
    assert.equal(calls[1].get("deleted_at"), "is.null");
  }
});

test("validates inputs and de-duplicates favorites without accepting owner overrides", () => {
  const parsed = parseHistoryQuery({
    search: "  月亮  ",
    favoriteIds: [id(1), id(1)],
    userId: "attacker",
  });
  assert.equal(parsed.search, "月亮");
  assert.deepEqual(parsed.favoriteIds, [id(1)]);
  assert.equal("userId" in parsed, false);
  for (const input of [
    null,
    [],
    { offset: -1 },
    { offset: 0.5 },
    { offset: "20" },
    { search: "x".repeat(201) },
    { search: null },
    { scene: "invalid" },
    { time: "invalid" },
    { favoriteIds: ["bad-id"] },
  ]) {
    assert.throws(() => parseHistoryQuery(input));
  }
});

test("same questions fold across loaded pages and use newest creation, not an old star or rename", () => {
  const items = [
    rows[0],
    rows[2],
    { ...rows[50], updated_at: now.toISOString() },
  ].map((r, i) => ({
    id: r.id,
    title: r.title,
    question: i === 1 ? "另一题" : "  同一个   问题 ",
    questionNormalized: normalizeQuestion(
      i === 1 ? "另一题" : "  同一个   问题 ",
    ),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  const groups = groupHistory(items, [id(51)]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].items[0].id, id(1));
  assert.equal(groups[0].items[1].id, id(51));
});
