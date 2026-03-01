import { getDb } from "../_db.js";
import { requireAuth, cors } from "../_auth.js";

// Route: /api/users/follow?username=xxx
// Handles POST (follow) and DELETE (unfollow)
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const me = requireAuth(req, res);
  if (!me) return;

  const targetUsername = req.query.username;
  if (!targetUsername) return res.status(400).json({ error: "username required" });

  const sql = getDb();
  try {
    const [target] = await sql`SELECT id FROM users WHERE username = ${targetUsername} LIMIT 1`;
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.id === me.id) return res.status(400).json({ error: "Cannot follow yourself" });

    if (req.method === "POST") {
      await sql`
        INSERT INTO follows (follower_id, following_id)
        VALUES (${me.id}, ${target.id})
        ON CONFLICT DO NOTHING`;
      return res.status(200).json({ following: true });
    }

    if (req.method === "DELETE") {
      await sql`DELETE FROM follows WHERE follower_id = ${me.id} AND following_id = ${target.id}`;
      return res.status(200).json({ following: false });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
