import { getDb } from "../_db.js";
import { requireAuth, verifyToken, cors } from "../_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql    = getDb();
  const entryId = req.query.id;

  // ── PUT: update entry ─────────────────────────────────────
  if (req.method === "PUT") {
    const me = requireAuth(req, res);
    if (!me) return;

    const { status, rating, review, quote, started_at, finished_at } = req.body;
    try {
      const [entry] = await sql`
        UPDATE entries SET
          status      = COALESCE(${status ?? null}, status),
          rating      = ${rating || null},
          review      = ${review || null},
          quote       = ${quote  || null},
          started_at  = ${started_at  || null},
          finished_at = ${finished_at || null},
          updated_at  = NOW()
        WHERE id = ${entryId} AND user_id = ${me.id}
        RETURNING *`;
      if (!entry) return res.status(404).json({ error: "Entry not found" });
      return res.status(200).json(entry);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DELETE: remove entry ──────────────────────────────────
  if (req.method === "DELETE") {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      await sql`DELETE FROM entries WHERE id = ${entryId} AND user_id = ${me.id}`;
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/entries/:id/like ────────────────────────────
  // Vercel doesn't support path segments easily, handle via query param ?action=like
  if (req.method === "POST" && req.query.action === "like") {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      await sql`
        INSERT INTO likes (user_id, entry_id) VALUES (${me.id}, ${entryId})
        ON CONFLICT DO NOTHING`;
      const [{ count }] = await sql`SELECT COUNT(*) FROM likes WHERE entry_id = ${entryId}`;
      return res.status(200).json({ likes_count: Number(count) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "DELETE" && req.query.action === "like") {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      await sql`DELETE FROM likes WHERE user_id = ${me.id} AND entry_id = ${entryId}`;
      const [{ count }] = await sql`SELECT COUNT(*) FROM likes WHERE entry_id = ${entryId}`;
      return res.status(200).json({ likes_count: Number(count) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
