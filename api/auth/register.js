import bcrypt from "bcryptjs";
import { getDb } from "../_db.js";
import { signToken, cors } from "../_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, username, display_name, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  }
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return res.status(400).json({ error: "Nombre de usuario inválido (3–30 chars, letras/números/_)" });
  }

  const sql = getDb();
  try {
    const existing = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()} OR username = ${username.toLowerCase()} LIMIT 1`;
    if (existing.length) {
      return res.status(409).json({ error: "El email o nombre de usuario ya está en uso" });
    }

    const hash = await bcrypt.hash(password, 12);
    const [user] = await sql`
      INSERT INTO users (email, username, display_name, password_hash)
      VALUES (${email.toLowerCase()}, ${username.toLowerCase()}, ${display_name || username}, ${hash})
      RETURNING id, email, username, display_name, avatar_url, locale`;

    const token = signToken({ id: user.id, username: user.username });
    return res.status(201).json({ token, user });
  } catch (err) {
    console.error("Register error:", err.message);
    return res.status(500).json({ error: "Error al crear la cuenta" });
  }
}
