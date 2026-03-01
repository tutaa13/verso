import { saveAuth, isLoggedIn, toast, initThemeToggle, applyTheme, getTheme } from "/js/app.js";

// Redirect if already logged in
if (isLoggedIn()) window.location.href = "/pages/feed.html";

// Theme
applyTheme(getTheme());
initThemeToggle();

// ── Tab switching ─────────────────────────────────────────────
const params = new URLSearchParams(location.search);
let activeTab = params.get("tab") === "register" ? "register" : "login";

function switchTab(tab) {
  activeTab = tab;
  document.getElementById("tab-login").classList.toggle("active", tab === "login");
  document.getElementById("tab-register").classList.toggle("active", tab === "register");
  document.getElementById("login-form").classList.toggle("hidden", tab !== "login");
  document.getElementById("register-form").classList.toggle("hidden", tab !== "register");
  document.getElementById("auth-switch-text").textContent =
    tab === "login" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?";
  document.getElementById("auth-switch-link").textContent =
    tab === "login" ? " Registrate" : " Iniciá sesión";
}

switchTab(activeTab);

document.getElementById("tab-login").addEventListener("click", () => switchTab("login"));
document.getElementById("tab-register").addEventListener("click", () => switchTab("register"));
document.getElementById("auth-switch-link").addEventListener("click", (e) => {
  e.preventDefault();
  switchTab(activeTab === "login" ? "register" : "login");
});

// ── Helpers ───────────────────────────────────────────────────
function setLoading(formEl, loading) {
  const btn = formEl.querySelector("button[type=submit]");
  btn.disabled = loading;
  btn.textContent = loading ? "Cargando..." : (activeTab === "login" ? "Iniciar sesión" : "Crear cuenta");
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearError(id) {
  const el = document.getElementById(id);
  el.textContent = "";
  el.classList.add("hidden");
}

// ── Login ─────────────────────────────────────────────────────
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError("login-error");
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (!email || !password) return;

  setLoading(e.target, true);
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al iniciar sesión");
    saveAuth(data.token, data.user);
    toast("¡Bienvenido de vuelta!", "success");
    setTimeout(() => { window.location.href = "/pages/feed.html"; }, 600);
  } catch (err) {
    showError("login-error", err.message);
    setLoading(e.target, false);
  }
});

// ── Register ──────────────────────────────────────────────────
document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError("register-error");
  const email       = document.getElementById("reg-email").value.trim();
  const username    = document.getElementById("reg-username").value.trim().toLowerCase();
  const displayName = document.getElementById("reg-display").value.trim();
  const password    = document.getElementById("reg-password").value;

  if (!email || !username || !displayName || !password) return;
  if (password.length < 8) { showError("register-error", "La contraseña debe tener al menos 8 caracteres"); return; }
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) { showError("register-error", "Nombre de usuario inválido"); return; }

  setLoading(e.target, true);
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, display_name: displayName, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al crear cuenta");
    saveAuth(data.token, data.user);
    toast("¡Cuenta creada! Bienvenido a Verso.", "success");
    setTimeout(() => { window.location.href = "/pages/feed.html"; }, 600);
  } catch (err) {
    showError("register-error", err.message);
    setLoading(e.target, false);
  }
});

// ── Google OAuth ──────────────────────────────────────────────
document.getElementById("google-btn").addEventListener("click", () => {
  window.location.href = "/api/auth/google";
});

// Handle OAuth callback token (Google redirects to /pages/login.html?token=...)
const token = params.get("token");
const userParam = params.get("user");
const oauthError = params.get("error");

if (oauthError) {
  toast("Error al iniciar sesión con Google: " + decodeURIComponent(oauthError), "error");
}

if (token && userParam) {
  try {
    saveAuth(token, JSON.parse(decodeURIComponent(userParam)));
    toast("¡Bienvenido!", "success");
    setTimeout(() => { window.location.href = "/pages/feed.html"; }, 500);
  } catch (e) {
    toast("Error al procesar el login: " + e.message, "error");
  }
}
