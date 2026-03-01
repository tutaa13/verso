import { getDb } from "../_db.js";
import { requireAuth, verifyToken, cors } from "../_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql      = getDb();
  const username = req.query.id; // route: /api/users/[id] where id = username
  const me       = verifyToken(req);

  // ── GET: user profile ─────────────────────────────────────
  if (req.method === "GET") {
    try {
      const [user] = await sql`
        SELECT id, username, display_name, bio, avatar_url, locale, created_at
        FROM users WHERE username = ${username} LIMIT 1`;
      if (!user) return res.status(404).json({ error: "User not found" });

      const [[stats], [followStats]] = await Promise.all([
        sql`SELECT
          COUNT(*) FILTER (WHERE status = 'finished')   AS finished,
          COUNT(*) FILTER (WHERE status = 'reading')    AS reading,
          COUNT(*) FILTER (WHERE status = 'want_to_read') AS want_to_read
        FROM entries WHERE user_id = ${user.id}`,
        sql`SELECT
          (SELECT COUNT(*) FROM follows WHERE following_id = ${user.id}) AS followers,
          (SELECT COUNT(*) FROM follows WHERE follower_id  = ${user.id}) AS following`,
      ]);

      const isFollowing = me
        ? (await sql`SELECT 1 FROM follows WHERE follower_id = ${me.id} AND following_id = ${user.id} LIMIT 1`).length > 0
        : false;

      return res.status(200).json({
        ...user,
        stats: {
          finished:     Number(stats.finished),
          reading:      Number(stats.reading),
          want_to_read: Number(stats.want_to_read),
          followers:    Number(followStats.followers),
          following:    Number(followStats.following),
        },
        is_following: isFollowing,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PUT: update own profile ───────────────────────────────
  if (req.method === "PUT") {
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (auth.username !== username) return res.status(403).json({ error: "Forbidden" });

    const { display_name, bio, avatar_url, locale } = req.body;
    try {
      const [user] = await sql`
        UPDATE users SET
          display_name = COALESCE(${display_name || null}, display_name),
          bio          = ${bio          ?? null},
          avatar_url   = ${avatar_url  ?? null},
          locale       = COALESCE(${locale || null}, locale)
        WHERE username = ${username}
        RETURNING id, username, display_name, bio, avatar_url, locale`;
      return res.status(200).json({ user });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
