import Groq from "groq-sdk";
import { getDb } from "./_db.js";
import { cors } from "./_auth.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const DAILY_LIMIT = 50;

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { books = [], movies = [], freeText = "", chips = [], qty = 5 } = req.body;
  if (!books.length && !movies.length && !freeText.trim()) {
    return res.status(400).json({ error: "Ingresá al menos un libro, película o texto libre." });
  }

  // Rate limit by IP
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  try {
    const sql = getDb();
    const [row] = await sql`
      INSERT INTO rate_limit (ip, date, count)
      VALUES (${ip}, CURRENT_DATE, 1)
      ON CONFLICT (ip, date) DO UPDATE
        SET count = rate_limit.count + 1
      RETURNING count`;
    if (row.count > DAILY_LIMIT) {
      return res.status(429).json({ error: `Límite diario alcanzado (${DAILY_LIMIT} búsquedas/día). Volvé mañana.` });
    }
  } catch {}

  const prompt = buildPrompt(books, movies, freeText, chips, Math.min(Number(qty) || 5, 10));

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 4096,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content || "";
    const data = parseRobust(raw);
    return res.status(200).json(data);
  } catch (err) {
    console.error("Groq error:", err.message);
    return res.status(500).json({ error: "No se pudo generar la recomendación. Intentá de nuevo." });
  }
}

function buildPrompt(books, movies, freeText, chips, qty) {
  let context = "";
  if (books.length > 0 && movies.length > 0) {
    context = `El lector disfrutó los libros: ${books.join(", ")}. También le gustaron las películas/series: ${movies.join(", ")}. Buscá libros que capturen la esencia de ambas fuentes.`;
  } else if (books.length > 0) {
    context = `El lector disfrutó los libros: ${books.join(", ")}.`;
  } else if (movies.length > 0) {
    context = `Al lector le gustaron las películas/series: ${movies.join(", ")}. Recomendá libros que capturen el mismo tono, atmósfera y temáticas.`;
  }
  if (freeText) context += ` Además: ${freeText}.`;
  const filterPart = chips.length > 0 ? ` Preferencias específicas: ${chips.join(", ")}.` : "";
  return `Sos un crítico literario y cinéfilo experto. ${context}${filterPart} Recomendá exactamente ${qty} libros. Respondé SOLO con JSON válido sin backticks ni markdown. Cada por_que: máximo 2 oraciones. Formato exacto: {"analisis":"una oración sobre el perfil del lector","libros":[{"titulo":"...","autor":"...","anio":"...","por_que":"...","conexion":"...","tags":["t1","t2","t3"]}]}`;
}

function parseRobust(raw) {
  const clean = raw.replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); } catch {}
  const lb = clean.lastIndexOf("},");
  if (lb > 0) {
    try { return JSON.parse(clean.slice(0, lb + 1) + "\n]\n}"); } catch {}
  }
  throw new Error("Respuesta incompleta");
}
