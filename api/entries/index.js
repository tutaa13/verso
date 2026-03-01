import { getDb } from "../_db.js";
import { requireAuth, verifyToken, cors } from "../_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql = getDb();

  // ── GET: list entries ─────────────────────────────────────
  if (req.method === "GET") {
    const { user, status, book, has_review } = req.query;
    const me = verifyToken(req);

    try {
      let rows;
      if (book) {
        // Entries for a specific book (community view)
        rows = await sql`
          SELECT e.*,
            u.username, u.display_name, u.avatar_url,
            b.title AS book_title, b.author AS book_author, b.cover_url AS book_cover,
            (SELECT COUNT(*) FROM likes l WHERE l.entry_id = e.id) AS likes_count,
            ${me ? sql`(SELECT 1 FROM likes l WHERE l.entry_id = e.id AND l.user_id = ${me.id}) IS NOT NULL` : sql`FALSE`} AS i_liked
          FROM entries e
          JOIN users u ON u.id = e.user_id
          LEFT JOIN books b ON b.id = e.book_id
          WHERE e.book_id = ${book}
            ${status ? sql`AND e.status = ${status}` : sql``}
            ${has_review === "1" ? sql`AND e.review IS NOT NULL AND e.review <> ''` : sql``}
          ORDER BY e.updated_at DESC
          LIMIT 50`;
        return res.status(200).json(rows.map(formatEntry));
      }

      if (user) {
        // Entries for a specific user's shelf
        const [profileUser] = await sql`SELECT id FROM users WHERE username = ${user} LIMIT 1`;
        if (!profileUser) return res.status(404).json({ error: "User not found" });

        rows = await sql`
          SELECT e.*,
            b.title AS book_title, b.author AS book_author, b.cover_url AS book_cover
          FROM entries e
          LEFT JOIN books b ON b.id = e.book_id
          WHERE e.user_id = ${profileUser.id}
            ${status ? sql`AND e.status = ${status}` : sql``}
          ORDER BY e.updated_at DESC
          LIMIT 100`;
        return res.status(200).json(rows.map(formatEntry));
      }

      return res.status(400).json({ error: "Specify ?user= or ?book=" });
    } catch (err) {
      console.error("GET entries error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: create entry ────────────────────────────────────
  if (req.method === "POST") {
    const me = requireAuth(req, res);
    if (!me) return;

    const { book_id, book, status, rating, review, quote, started_at, finished_at } = req.body;
    if (!book_id || !status) return res.status(400).json({ error: "book_id y status son requeridos" });

    try {
      // Upsert book into our cache
      if (book && book.title) {
        await sql`
          INSERT INTO books (id, title, author, cover_url)
          VALUES (${book_id}, ${book.title || ""}, ${book.author || ""}, ${book.cover_url || null})
          ON CONFLICT (id) DO UPDATE
            SET title = EXCLUDED.title,
                author = COALESCE(EXCLUDED.author, books.author),
                cover_url = COALESCE(EXCLUDED.cover_url, books.cover_url)`;
      }

      const [entry] = await sql`
        INSERT INTO entries (user_id, book_id, status, rating, review, quote, started_at, finished_at)
        VALUES (${me.id}, ${book_id}, ${status}, ${rating || null}, ${review || null}, ${quote || null},
                ${started_at || null}, ${finished_at || null})
        ON CONFLICT (user_id, book_id) DO UPDATE
          SET status = EXCLUDED.status, rating = EXCLUDED.rating, review = EXCLUDED.review,
              quote = EXCLUDED.quote, started_at = EXCLUDED.started_at, finished_at = EXCLUDED.finished_at,
              updated_at = NOW()
        RETURNING *`;

      return res.status(201).json(entry);
    } catch (err) {
      console.error("POST entry error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}

function formatEntry(row) {
  return {
    id:          row.id,
    user_id:     row.user_id,
    book_id:     row.book_id,
    status:      row.status,
    rating:      row.rating ? Number(row.rating) : null,
    review:      row.review,
    quote:       row.quote,
    started_at:  row.started_at,
    finished_at: row.finished_at,
    created_at:  row.created_at,
    updated_at:  row.updated_at,
    likes_count: Number(row.likes_count || 0),
    i_liked:     row.i_liked || false,
    user: row.username ? {
      username:     row.username,
      display_name: row.display_name,
      avatar_url:   row.avatar_url,
    } : undefined,
    book: row.book_title ? {
      title:     row.book_title,
      author:    row.book_author,
      cover_url: row.book_cover,
    } : undefined,
  };
}
