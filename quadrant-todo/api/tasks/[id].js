const { requireUser } = require("../_lib/auth");
const { json, methodNotAllowed, parseJson } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");

const QUADRANTS = new Set(["q1", "q2", "q3", "q4"]);
const STATUSES = new Set(["todo", "done", "archived"]);

function normalizeStatus(status) {
  return status === "doing" ? "todo" : status;
}

function normalizeTask(task) {
  return {
    ...task,
    status: normalizeStatus(task.status)
  };
}

async function getNextSortOrder(supabase, userId, quadrant) {
  const { data, error } = await supabase
    .from("quadrant_tasks")
    .select("sort_order")
    .eq("user_id", userId)
    .eq("quadrant", quadrant)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data && data[0] ? data[0].sort_order : 0) + 1;
}

function getTaskId(req) {
  const value = req.query?.id;
  return Array.isArray(value) ? value[0] : value;
}

module.exports = async function handler(req, res) {
  const taskId = getTaskId(req);
  if (!taskId) {
    return json(res, 400, { error: "Task id is required" });
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

      if (body.quadrant !== undefined) {
        const quadrant = String(body.quadrant || "");
        if (!QUADRANTS.has(quadrant)) {
          return json(res, 400, { error: "Invalid quadrant" });
        }
        patch.quadrant = quadrant;
        if (body.sortOrder === undefined) {
          patch.sort_order = await getNextSortOrder(supabase, auth.user.id, quadrant);
        }
      }

      if (body.status !== undefined) {
        const status = normalizeStatus(String(body.status || ""));
        if (!STATUSES.has(status)) {
          return json(res, 400, { error: "Invalid status" });
        }
        patch.status = status;
        patch.completed_at = status === "done" ? new Date().toISOString() : null;
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
        .from("quadrant_tasks")
        .update(patch)
        .eq("id", taskId)
        .eq("user_id", auth.user.id)
        .select("id, title, description, quadrant, status, sort_order, created_at, updated_at, completed_at")
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        return json(res, 404, { error: "Task not found" });
      }

      return json(res, 200, { task: normalizeTask(data) });
    } catch (error) {
      return json(res, 500, { error: error.message || "Failed to update task" });
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
        .from("quadrant_tasks")
        .delete()
        .eq("id", taskId)
        .eq("user_id", auth.user.id)
        .select("id")
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        return json(res, 404, { error: "Task not found" });
      }

      return json(res, 200, { ok: true });
    } catch (error) {
      return json(res, 500, { error: error.message || "Failed to delete task" });
    }
  }

  return methodNotAllowed(res, ["PATCH", "DELETE"]);
};
