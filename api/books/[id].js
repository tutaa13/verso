import { getDb } from "../_db.js";
import { cors } from "../_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql    = getDb();
  const bookId = req.query.id;
  const action = req.query.action; // ?action=stats

  if (action === "stats" || req.url?.includes("/stats")) {
    try {
      const [stats] = await sql`
        SELECT
          ROUND(AVG(rating)::numeric, 1) AS avg_rating,
          COUNT(*) FILTER (WHERE review IS NOT NULL AND review <> '') AS review_count,
          COUNT(*) FILTER (WHERE status = 'finished') AS reader_count
        FROM entries WHERE book_id = ${bookId}`;
      return res.status(200).json({
        avg_rating:   stats?.avg_rating ? Number(stats.avg_rating) : null,
        review_count: Number(stats?.review_count || 0),
        reader_count: Number(stats?.reader_count || 0),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "GET") {
    try {
      const [book] = await sql`SELECT * FROM books WHERE id = ${bookId} LIMIT 1`;
      if (!book) return res.status(404).json({ error: "Book not found" });
      return res.status(200).json(book);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
