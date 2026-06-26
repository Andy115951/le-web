const { requireUser } = require("../_lib/auth");
const { json, methodNotAllowed, parseJson } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");

const AREAS = new Set(["finance", "health", "reading", "learning", "work", "life", "other"]);
const STATUSES = new Set(["active", "done", "paused"]);

const GOAL_COLUMNS =
  "id, title, description, area, status, progress, target_date, sort_order, created_at, updated_at, completed_at";

function parseProgress(value) {
  const progress = Number(value);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    return null;
  }
  return progress;
}

function parseTargetDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return undefined;
  }
  return text;
}

async function getNextSortOrder(supabase, userId, area) {
  const { data, error } = await supabase
    .from("quadrant_goals")
    .select("sort_order")
    .eq("user_id", userId)
    .eq("area", area)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data && data[0] ? data[0].sort_order : 0) + 1;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const auth = await requireUser(req, res);
      if (!auth) {
        return;
      }

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("quadrant_goals")
        .select(GOAL_COLUMNS)
        .eq("user_id", auth.user.id)
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return json(res, 200, { goals: data || [] });
    } catch (error) {
      return json(res, 500, { error: error.message || "Failed to load goals" });
    }
  }

  if (req.method === "POST") {
    try {
      const auth = await requireUser(req, res);
      if (!auth) {
        return;
      }

      const body = await parseJson(req);
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      const area = String(body.area || "other");
      const status = String(body.status || "active");
      const progress = body.progress === undefined ? 0 : parseProgress(body.progress);
      const targetDate = parseTargetDate(body.targetDate);

      if (!title || title.length > 120) {
        return json(res, 400, { error: "Title is required and must be under 120 characters" });
      }

      if (description.length > 2000) {
        return json(res, 400, { error: "Description must be under 2000 characters" });
      }

      if (!AREAS.has(area)) {
        return json(res, 400, { error: "Invalid area" });
      }

      if (!STATUSES.has(status)) {
        return json(res, 400, { error: "Invalid status" });
      }

      if (progress === null) {
        return json(res, 400, { error: "Progress must be an integer between 0 and 100" });
      }

      if (targetDate === undefined) {
        return json(res, 400, { error: "Target date must be in YYYY-MM-DD format" });
      }

      const supabase = getSupabaseAdmin();
      const sortOrder = await getNextSortOrder(supabase, auth.user.id, area);

      const { data, error } = await supabase
        .from("quadrant_goals")
        .insert({
          user_id: auth.user.id,
          title,
          description,
          area,
          status,
          progress,
          target_date: targetDate,
          sort_order: sortOrder,
          completed_at: status === "done" ? new Date().toISOString() : null
        })
        .select(GOAL_COLUMNS)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return json(res, 201, { goal: data });
    } catch (error) {
      return json(res, 500, { error: error.message || "Failed to create goal" });
    }
  }

  return methodNotAllowed(res, ["GET", "POST"]);
};
