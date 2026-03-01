import { cors } from "../_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = String(req.query.q || "").trim();
  if (!q || q.length < 2) return res.status(400).json({ error: "Query too short" });

  try {
    const olRes = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=key,title,author_name,first_publish_year,cover_i&limit=10`
    );
    const data = await olRes.json();

    const books = (data.docs || []).map(doc => ({
      id:        doc.key?.replace("/works/", "") || "",
      title:     doc.title || "",
      author:    (doc.author_name || []).join(", "),
      year:      doc.first_publish_year || null,
      cover_url: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
    })).filter(b => b.id && b.title);

    return res.status(200).json({ books });
  } catch (err) {
    console.error("OL search error:", err.message);
    return res.status(500).json({ error: "Error buscando libros" });
  }
}
