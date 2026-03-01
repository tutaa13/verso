import Groq from "groq-sdk";
import { getDb } from "./_db.js";
import { cors } from "./_auth.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const DAILY_LIMIT = 50;

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { books = [], movies = [], freeText = "", chips = [], qty = 5, excludedBooks = [] } = req.body;
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

  const prompt = buildPrompt(books, movies, freeText, chips, Math.min(Number(qty) || 5, 10), excludedBooks);

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 4096,
      temperature: 0.9,
      top_p: 0.95,
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

const EXPLORATION_ANGLES = [
  "explorando literaturas latinoamericanas, africanas o asiáticas poco representadas",
  "priorizando autoras mujeres o voces históricamente marginadas",
  "buscando óperas primas o segundas novelas de autores emergentes",
  "enfocándote en obras publicadas en los últimos 15 años",
  "rastreando joyas de culto con poca visibilidad mainstream",
  "cruzando géneros de forma inesperada (ej: thriller filosófico, romance histórico experimental)",
  "priorizando autores de Europa del Este, Escandinavia o el Mediterráneo",
  "buscando en la periferia del canon: autores traducidos pero poco conocidos en habla hispana",
  "con énfasis en estructuras narrativas no convencionales",
  "explorando la tradición de un país o región literaria específica poco común",
];

function buildPrompt(books, movies, freeText, chips, qty, excludedBooks = []) {
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

  const exclusionPart = excludedBooks.length > 0
    ? ` IMPORTANTE: NO recomiendes ninguno de estos títulos que ya fueron mostrados: ${excludedBooks.slice(0, 40).join("; ")}. Buscá obras completamente distintas.`
    : "";

  const angle = EXPLORATION_ANGLES[Math.floor(Math.random() * EXPLORATION_ANGLES.length)];

  return `Sos un crítico literario y cinéfilo con conocimiento enciclopédico y gusto por lo poco convencional. ${context}${filterPart}${exclusionPart} Priorizá obras menos conocidas, joyas subestimadas y autores fuera del canon típico — evitá los títulos que aparecen en toda lista de recomendaciones estándar. En esta búsqueda, explorá ${angle}. Recomendá exactamente ${qty} libros. Respondé SOLO con JSON válido sin backticks ni markdown. Cada por_que: máximo 2 oraciones. Formato exacto: {"analisis":"una oración sobre el perfil del lector","libros":[{"titulo":"...","autor":"...","anio":"...","por_que":"...","conexion":"...","tags":["t1","t2","t3"]}]}`;
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
