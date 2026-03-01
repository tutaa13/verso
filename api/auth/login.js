import bcrypt from "bcryptjs";
import { getDb } from "../_db.js";
import { signToken, cors } from "../_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Faltan campos requeridos" });

  const sql = getDb();
  try {
    const [user] = await sql`
      SELECT id, email, username, display_name, avatar_url, locale, password_hash
      FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Email o contraseña incorrectos" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Email o contraseña incorrectos" });

    const { password_hash, ...safeUser } = user;
    const token = signToken({ id: user.id, username: user.username });
    return res.status(200).json({ token, user: safeUser });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: "Error al iniciar sesión" });
  }
}
