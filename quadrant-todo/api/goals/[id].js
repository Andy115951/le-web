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
  if (value === null || value === "") {
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

function getGoalId(req) {
  const value = req.query?.id;
  return Array.isArray(value) ? value[0] : value;
}

module.exports = async function handler(req, res) {
  const goalId = getGoalId(req);
  if (!goalId) {
    return json(res, 400, { error: "Goal id is required" });
  }

  if (req.method === "PATCH") {
    try {
      const auth = await requireUser(req, res);
      if (!auth) {
        return;
      }

      const body = await parseJson(req);
      const patch = {};
      const supabase = getSupabaseAdmin();

      if (body.title !== undefined) {
        const title = String(body.title || "").trim();
        if (!title || title.length > 120) {
          return json(res, 400, { error: "Title is required and must be under 120 characters" });
        }
        patch.title = title;
      }

      if (body.description !== undefined) {
        const description = String(body.description || "").trim();
        if (description.length > 2000) {
          return json(res, 400, { error: "Description must be under 2000 characters" });
        }
        patch.description = description;
      }

      if (body.area !== undefined) {
        const area = String(body.area || "");
        if (!AREAS.has(area)) {
          return json(res, 400, { error: "Invalid area" });
        }
        patch.area = area;
        if (body.sortOrder === undefined) {
          patch.sort_order = await getNextSortOrder(supabase, auth.user.id, area);
        }
      }

      if (body.status !== undefined) {
        const status = String(body.status || "");
        if (!STATUSES.has(status)) {
          return json(res, 400, { error: "Invalid status" });
        }
        patch.status = status;
        patch.completed_at = status === "done" ? new Date().toISOString() : null;
      }

      if (body.progress !== undefined) {
        const progress = parseProgress(body.progress);
        if (progress === null) {
          return json(res, 400, { error: "Progress must be an integer between 0 and 100" });
        }
        patch.progress = progress;
      }

      if (body.targetDate !== undefined) {
        const targetDate = parseTargetDate(body.targetDate);
        if (targetDate === undefined) {
          return json(res, 400, { error: "Target date must be in YYYY-MM-DD format" });
        }
        patch.target_date = targetDate;
      }

      if (body.sortOrder !== undefined) {
        const sortOrder = Number(body.sortOrder);
        if (!Number.isInteger(sortOrder) || sortOrder < 0) {
          return json(res, 400, { error: "sortOrder must be a non-negative integer" });
        }
        patch.sort_order = sortOrder;
      }

      if (Object.keys(patch).length === 0) {
        return json(res, 400, { error: "No valid fields to update" });
      }

      const { data, error } = await supabase
        .from("quadrant_goals")
        .update(patch)
        .eq("id", goalId)
        .eq("user_id", auth.user.id)
        .select(GOAL_COLUMNS)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        return json(res, 404, { error: "Goal not found" });
      }

      return json(res, 200, { goal: data });
    } catch (error) {
      return json(res, 500, { error: error.message || "Failed to update goal" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const auth = await requireUser(req, res);
      if (!auth) {
        return;
      }

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("quadrant_goals")
        .delete()
        .eq("id", goalId)
        .eq("user_id", auth.user.id)
        .select("id")
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        return json(res, 404, { error: "Goal not found" });
      }

      return json(res, 200, { ok: true });
    } catch (error) {
      return json(res, 500, { error: error.message || "Failed to delete goal" });
    }
  }

  return methodNotAllowed(res, ["PATCH", "DELETE"]);
};
