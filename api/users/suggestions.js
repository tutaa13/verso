import { getDb } from "../_db.js";
import { verifyToken, cors } from "../_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql = getDb();
  const me  = verifyToken(req);

  try {
    let users;
    if (me) {
      // Users not already followed by me, with most finished books
      users = await sql`
        SELECT u.id, u.username, u.display_name, u.avatar_url,
          COUNT(e.id) FILTER (WHERE e.status = 'finished') AS finished_count
        FROM users u
        LEFT JOIN entries e ON e.user_id = u.id
        WHERE u.id <> ${me.id}
          AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ${me.id})
        GROUP BY u.id
        ORDER BY finished_count DESC, u.created_at DESC
        LIMIT 8`;
    } else {
      users = await sql`
        SELECT u.id, u.username, u.display_name, u.avatar_url,
          COUNT(e.id) FILTER (WHERE e.status = 'finished') AS finished_count
        FROM users u
        LEFT JOIN entries e ON e.user_id = u.id
        GROUP BY u.id
        ORDER BY finished_count DESC
        LIMIT 8`;
    }

    return res.status(200).json(users.map(u => ({ ...u, finished_count: Number(u.finished_count || 0) })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
