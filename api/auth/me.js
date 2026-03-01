import { getDb } from "../_db.js";
import { requireAuth, cors } from "../_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const me = requireAuth(req, res);
  if (!me) return;

  const sql = getDb();
  try {
    const [user] = await sql`
      SELECT id, email, username, display_name, avatar_url, bio, locale
      FROM users WHERE id = ${me.id} LIMIT 1`;
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.status(200).json({ user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
