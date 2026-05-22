const { requireUser } = require("../_lib/auth");
const { json, methodNotAllowed, parseJson } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");

const QUADRANTS = new Set(["q1", "q2", "q3", "q4"]);
const STATUSES = new Set(["todo", "doing", "done", "archived"]);

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

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const auth = await requireUser(req, res);
      if (!auth) {
        return;
      }

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("quadrant_tasks")
        .select("id, title, description, quadrant, status, sort_order, created_at, updated_at, completed_at")
        .eq("user_id", auth.user.id)
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return json(res, 200, { tasks: data || [] });
    } catch (error) {
      return json(res, 500, { error: error.message || "Failed to load tasks" });
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
      const quadrant = String(body.quadrant || "q2");
      const status = String(body.status || "todo");

      if (!title || title.length > 120) {
        return json(res, 400, { error: "Title is required and must be under 120 characters" });
      }

      if (description.length > 2000) {
        return json(res, 400, { error: "Description must be under 2000 characters" });
      }

      if (!QUADRANTS.has(quadrant)) {
        return json(res, 400, { error: "Invalid quadrant" });
      }

      if (!STATUSES.has(status)) {
        return json(res, 400, { error: "Invalid status" });
      }

      const supabase = getSupabaseAdmin();
      const sortOrder = await getNextSortOrder(supabase, auth.user.id, quadrant);

      const { data, error } = await supabase
        .from("quadrant_tasks")
        .insert({
          user_id: auth.user.id,
          title,
          description,
          quadrant,
          status,
          sort_order: sortOrder,
          completed_at: status === "done" ? new Date().toISOString() : null
        })
        .select("id, title, description, quadrant, status, sort_order, created_at, updated_at, completed_at")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return json(res, 201, { task: data });
    } catch (error) {
      return json(res, 500, { error: error.message || "Failed to create task" });
    }
  }

  return methodNotAllowed(res, ["GET", "POST"]);
};
