import { getDb } from "../_db.js";
import { signToken, cors } from "../_auth.js";

export default async function handler(req, res) {
  cors(res);
  const { code, error } = req.query;
  const appUrl     = process.env.APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/google-callback`;

  if (error || !code) {
    return res.redirect(302, `/pages/login.html?error=oauth_failed`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokens.error_description || "Token exchange failed");

    // Get user info
    const infoRes  = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const gUser = await infoRes.json();
    if (!gUser.id) throw new Error("Failed to get Google user info");

    const sql = getDb();

    // Upsert user
    let [user] = await sql`
      SELECT id, email, username, display_name, avatar_url, locale
      FROM users WHERE google_id = ${gUser.id} LIMIT 1`;

    if (!user) {
      // Check if email already exists (link accounts)
      [user] = await sql`SELECT id, email, username, display_name, avatar_url, locale FROM users WHERE email = ${gUser.email?.toLowerCase()} LIMIT 1`;
      if (user) {
        await sql`UPDATE users SET google_id = ${gUser.id}, avatar_url = COALESCE(avatar_url, ${gUser.picture}) WHERE id = ${user.id}`;
        [user] = await sql`SELECT id, email, username, display_name, avatar_url, locale FROM users WHERE id = ${user.id} LIMIT 1`;
      } else {
        // Create new user — generate a unique username from Google name
        let baseUsername = (gUser.name || gUser.email?.split("@")[0] || "reader")
          .toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 25);
        const [exists] = await sql`SELECT id FROM users WHERE username = ${baseUsername} LIMIT 1`;
        if (exists) baseUsername += "_" + Math.floor(Math.random() * 9000 + 1000);

        [user] = await sql`
          INSERT INTO users (email, username, display_name, google_id, avatar_url)
          VALUES (${gUser.email?.toLowerCase()}, ${baseUsername}, ${gUser.name || baseUsername}, ${gUser.id}, ${gUser.picture})
          RETURNING id, email, username, display_name, avatar_url, locale`;
      }
    }

    const token = signToken({ id: user.id, username: user.username });
    const userEncoded = encodeURIComponent(JSON.stringify(user));
    res.redirect(302, `/pages/login.html?token=${token}&user=${userEncoded}`);
  } catch (err) {
    console.error("Google OAuth error:", err.message);
    res.redirect(302, `/pages/login.html?error=oauth_failed`);
  }
}
