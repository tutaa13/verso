import { getDb } from "./_db.js";
import { verifyToken, cors } from "./_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const sql     = getDb();
  const me      = verifyToken(req);
  const isGlobal = req.query.global === "1" || !me;

  try {
    let entries;

    if (isGlobal) {
      // Global feed: most recent public entries with reviews or ratings
      entries = await sql`
        SELECT e.*,
          u.username, u.display_name, u.avatar_url,
          b.title AS book_title, b.author AS book_author, b.cover_url AS book_cover,
          (SELECT COUNT(*) FROM likes l WHERE l.entry_id = e.id) AS likes_count,
          FALSE AS i_liked
        FROM entries e
        JOIN users u ON u.id = e.user_id
        LEFT JOIN books b ON b.id = e.book_id
        WHERE e.is_private = FALSE
          AND (e.review IS NOT NULL OR e.rating IS NOT NULL)
        ORDER BY e.updated_at DESC
        LIMIT 30`;
    } else {
      // Personal feed: entries from users I follow
      entries = await sql`
        SELECT e.*,
          u.username, u.display_name, u.avatar_url,
          b.title AS book_title, b.author AS book_author, b.cover_url AS book_cover,
          (SELECT COUNT(*) FROM likes l WHERE l.entry_id = e.id) AS likes_count,
          (SELECT 1 FROM likes l WHERE l.entry_id = e.id AND l.user_id = ${me.id}) IS NOT NULL AS i_liked
        FROM entries e
        JOIN users u ON u.id = e.user_id
        LEFT JOIN books b ON b.id = e.book_id
        JOIN follows f ON f.following_id = e.user_id AND f.follower_id = ${me.id}
        WHERE e.is_private = FALSE
        ORDER BY e.updated_at DESC
        LIMIT 50`;
    }

    return res.status(200).json(entries.map(e => ({
      id:          e.id,
      user_id:     e.user_id,
      book_id:     e.book_id,
      status:      e.status,
      rating:      e.rating ? Number(e.rating) : null,
      review:      e.review,
      quote:       e.quote,
      finished_at: e.finished_at,
      created_at:  e.created_at,
      updated_at:  e.updated_at,
      likes_count: Number(e.likes_count || 0),
      i_liked:     e.i_liked || false,
      user: {
        username:     e.username,
        display_name: e.display_name,
        avatar_url:   e.avatar_url,
      },
      book: {
        title:     e.book_title,
        author:    e.book_author,
        cover_url: e.book_cover,
      },
    })));
  } catch (err) {
    console.error("Feed error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
