// ─────────────────────────────────────────────────────────────
// VERSO — shared utilities
// ─────────────────────────────────────────────────────────────

// ── Theme ────────────────────────────────────────────────────
const THEME_KEY = "verso-theme";

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

export function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(THEME_KEY, t);
}

export function toggleTheme() {
  const next = getTheme() === "light" ? "dark" : "light";
  applyTheme(next);
  return next;
}

// Anti-FOUC: call immediately in <head>
export function initTheme() {
  applyTheme(getTheme());
}

// ── Auth ─────────────────────────────────────────────────────
const TOKEN_KEY = "verso-token";
const USER_KEY  = "verso-user";

export function getToken()  { return localStorage.getItem(TOKEN_KEY); }
export function getUser()   { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
export function isLoggedIn(){ return !!getToken() && !!getUser(); }

export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── API helper ───────────────────────────────────────────────
export async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Toast ────────────────────────────────────────────────────
let toastContainer;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function toast(message, type = "default", duration = 3000) {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" style="flex-shrink:0;color:${
      type === "success" ? "var(--success)" : type === "error" ? "var(--error)" : "var(--muted)"
    }">
      ${type === "success"
        ? '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>'
        : type === "error"
        ? '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>'
        : '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>'}
    </svg>
    <span>${message}</span>`;
  getToastContainer().appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; el.style.transition = "all 0.2s"; setTimeout(() => el.remove(), 200); }, duration);
}

// ── Stars ─────────────────────────────────────────────────────
export function renderStars(rating, max = 5) {
  let html = '<span class="stars">';
  for (let i = 1; i <= max; i++) {
    if (rating >= i) html += '<span class="star filled">★</span>';
    else if (rating >= i - 0.5) html += '<span class="star half">★</span>';
    else html += '<span class="star">★</span>';
  }
  html += `<span class="rating-text">${rating ? rating.toFixed(1) : ""}</span></span>`;
  return html;
}

export function createStarInput(container, onChange) {
  container.innerHTML = '<div class="star-input" role="group" aria-label="Rating"></div>';
  const wrap = container.querySelector(".star-input");
  let current = 0;

  function render(highlighted) {
    wrap.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "star-btn" + (i <= highlighted ? " on" : "");
      btn.textContent = "★";
      btn.addEventListener("click", () => { current = i; render(current); onChange(current); });
      btn.addEventListener("mouseenter", () => render(i));
      btn.addEventListener("mouseleave", () => render(current));
      wrap.appendChild(btn);
    }
  }
  render(0);
  return { getValue: () => current, setValue: (v) => { current = v; render(v); } };
}

// ── Status badge ─────────────────────────────────────────────
const STATUS_MAP = {
  want_to_read: { label: "Quiero leer",  labelEn: "Want to read",  cls: "badge-want" },
  reading:      { label: "Leyendo",      labelEn: "Reading",       cls: "badge-reading" },
  finished:     { label: "Leído",        labelEn: "Finished",      cls: "badge-finished" },
  abandoned:    { label: "Abandonado",   labelEn: "Abandoned",     cls: "badge-abandoned" },
};

export function statusBadge(status, lang = "es") {
  const s = STATUS_MAP[status] || {};
  return `<span class="badge ${s.cls || ""}">${lang === "en" ? s.labelEn : s.label}</span>`;
}

// ── Date helpers ─────────────────────────────────────────────
export function relativeDate(dateStr) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return d.toLocaleDateString("es-AR", { day:"numeric", month:"short", year:"numeric" });
}

// ── Nav: render auth state ───────────────────────────────────
export function renderNavAuth() {
  const actionsEl = document.getElementById("nav-actions");
  if (!actionsEl) return;
  const user = getUser();
  if (user) {
    const initial = (user.display_name || user.username || "?")[0].toUpperCase();
    actionsEl.innerHTML = `
      <a href="/pages/feed.html" id="nav-profile-link" class="nav-avatar" title="${user.username}">
        ${user.avatar_url ? `<img src="${user.avatar_url}" alt="${user.username}">` : initial}
      </a>
      <button class="btn btn-ghost btn-sm" id="nav-logout-btn">
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M13 3h4a1 1 0 011 1v12a1 1 0 01-1 1h-4M9 15l4-5-4-5M13 10H3"/>
        </svg>
      </button>`;
    document.getElementById("nav-profile-link").href = `/pages/profile.html?user=${user.username}`;
    document.getElementById("nav-logout-btn").addEventListener("click", () => {
      clearAuth();
      window.location.href = "/pages/login.html";
    });
  } else {
    actionsEl.innerHTML = `
      <a href="/pages/login.html" class="btn btn-ghost btn-sm">Sign in</a>
      <a href="/pages/login.html?tab=register" class="btn btn-primary btn-sm">Join</a>`;
  }
}

// ── Shared nav HTML ──────────────────────────────────────────
export function renderNav(activePage = "") {
  const navEl = document.getElementById("main-nav");
  if (!navEl) return;
  navEl.innerHTML = `
    <div class="nav-inner">
      <a href="/index.html" class="nav-logo">V<em>erso</em></a>
      <nav class="nav-links">
        <a href="/pages/discover.html" class="nav-link ${activePage==="discover"?"active":""}">Discover</a>
        <a href="/pages/feed.html"     class="nav-link ${activePage==="feed"?"active":""}">Feed</a>
      </nav>
      <div class="nav-actions" id="nav-actions"></div>
      <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">
        <svg id="theme-icon" viewBox="0 0 20 20" fill="currentColor">
          <path id="theme-path"/>
        </svg>
      </button>
    </div>`;

  renderNavAuth();
  initThemeToggle();
}

export function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  const path = document.getElementById("theme-path");
  if (!btn) return;

  const SUN = "M10 2a1 1 0 011 1v1a1 1 0 01-2 0V3a1 1 0 011-1zm4.22 1.72a1 1 0 011.42 1.42l-.7.7a1 1 0 01-1.42-1.42l.7-.7zM18 9a1 1 0 010 2h-1a1 1 0 010-2h1zM4.93 14.07a1 1 0 011.42 1.42l-.7.7a1 1 0 01-1.42-1.42l.7-.7zM2 10a1 1 0 011-1h1a1 1 0 010 2H3a1 1 0 01-1-1zm13.07 4.07a1 1 0 011.42-1.42l.7.7a1 1 0 01-1.42 1.42l-.7-.7zM10 15a1 1 0 011 1v1a1 1 0 01-2 0v-1a1 1 0 011-1zM5.64 5.64a1 1 0 011.42 0l.7.7A1 1 0 016.34 7.76l-.7-.7a1 1 0 010-1.42zM10 6a4 4 0 100 8 4 4 0 000-8z";
  const MOON = "M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z";

  function update() { if (path) path.setAttribute("d", getTheme() === "dark" ? SUN : MOON); }
  update();
  btn.addEventListener("click", () => { toggleTheme(); update(); });
}

// ── Tag input component ──────────────────────────────────────
export function createTagInput(wrapEl, { placeholder = "Type and press Enter...", type = "book" } = {}) {
  const tags = [];
  const input = document.createElement("input");
  input.placeholder = placeholder;
  wrapEl.appendChild(input);

  function renderTags() {
    wrapEl.querySelectorAll(".input-tag").forEach(el => el.remove());
    tags.forEach((tag, i) => {
      const el = document.createElement("span");
      el.className = `input-tag${type === "movie" ? " movie" : ""}`;
      el.innerHTML = `${escHtml(tag)}<span class="input-tag-remove" data-i="${i}" title="Remove">×</span>`;
      el.querySelector(".input-tag-remove").addEventListener("click", () => { tags.splice(i, 1); renderTags(); });
      wrapEl.insertBefore(el, input);
    });
  }

  input.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === ",") && input.value.trim()) {
      e.preventDefault();
      const val = input.value.trim().replace(/,$/, "");
      if (val && !tags.includes(val)) { tags.push(val); renderTags(); }
      input.value = "";
    }
    if (e.key === "Backspace" && !input.value && tags.length) {
      tags.pop(); renderTags();
    }
  });

  wrapEl.addEventListener("click", () => input.focus());

  return { getTags: () => [...tags], clear: () => { tags.length = 0; renderTags(); } };
}

// ── Utils ─────────────────────────────────────────────────────
export function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

export function qs(sel, ctx = document)  { return ctx.querySelector(sel); }
export function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

export function getLang() {
  const user = getUser();
  return user?.locale || localStorage.getItem("verso-lang") || "es";
}
