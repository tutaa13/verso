import { renderNav, api, getUser, isLoggedIn, toast, renderStars, statusBadge, relativeDate, escHtml, qs } from "/js/app.js";

renderNav("feed");

const myUser = getUser();

// ── Load feed ─────────────────────────────────────────────────
async function loadFeed() {
  const loading = qs("#feed-loading");
  const list    = qs("#feed-list");
  const empty   = qs("#feed-empty");
  const global  = qs("#global-feed-list");

  loading.classList.remove("hidden");

  try {
    let entries;
    if (isLoggedIn()) {
      entries = await api("/api/feed");
    } else {
      entries = await api("/api/feed?global=1");
    }

    loading.classList.add("hidden");

    if (!entries.length) {
      if (isLoggedIn()) {
        empty.classList.remove("hidden");
        // show global feed as fallback
        const globalEntries = await api("/api/feed?global=1");
        if (globalEntries.length) {
          global.classList.remove("hidden");
          const label = document.createElement("div");
          label.className = "section-label mb-2 mt-3";
          label.style.opacity = "0.6";
          label.textContent = "Actividad global";
          global.before(label);
          renderEntries(globalEntries, global);
        }
      } else {
        empty.classList.remove("hidden");
      }
      return;
    }

    renderEntries(entries, list);
  } catch (err) {
    loading.classList.add("hidden");
    toast("Error cargando el feed", "error");
  }
}

function renderEntries(entries, container) {
  container.innerHTML = "";
  entries.forEach((e, i) => {
    const card = document.createElement("div");
    card.className = "entry-card fade-up";
    card.style.animationDelay = `${i * 0.04}s`;

    const coverHtml = e.book?.cover_url
      ? `<img class="entry-card-cover" src="${escHtml(e.book.cover_url)}" alt="">`
      : `<div class="entry-card-cover-placeholder"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg></div>`;

    card.innerHTML = `
      <div class="user-row" style="margin-bottom:0.75rem;">
        <a href="/pages/profile.html?user=${escHtml(e.user?.username || "")}" class="user-avatar" style="text-decoration:none;">
          ${e.user?.avatar_url ? `<img src="${escHtml(e.user.avatar_url)}" alt="">` : (e.user?.display_name || "?")[0].toUpperCase()}
        </a>
        <div class="user-meta flex-1">
          <div class="user-name">${escHtml(e.user?.display_name || e.user?.username || "")}</div>
          <div class="user-handle">${activityLabel(e)} · ${relativeDate(e.created_at)}</div>
        </div>
      </div>

      <div class="entry-card-header">
        ${coverHtml}
        <div>
          <a href="/pages/book.html?id=${escHtml(e.book_id)}" class="entry-card-title">${escHtml(e.book?.title || e.book_id)}</a>
          <div class="entry-card-author">${escHtml(e.book?.author || "")}</div>
          <div class="flex items-center gap-1" style="margin-top:0.3rem;">
            ${statusBadge(e.status)}
            ${e.rating ? renderStars(e.rating) : ""}
          </div>
        </div>
      </div>

      ${e.review ? `<div class="entry-card-review">"${escHtml(e.review)}"</div>` : ""}
      ${e.quote  ? `<div class="entry-card-quote">"${escHtml(e.quote)}"</div>`  : ""}

      <div class="entry-card-actions">
        <button class="action-btn like-btn ${e.i_liked ? "liked" : ""}" data-id="${e.id}" data-liked="${!!e.i_liked}">
          <svg viewBox="0 0 20 20" fill="${e.i_liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5" style="width:15px;height:15px;">
            <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/>
          </svg>
          <span class="like-count">${e.likes_count || 0}</span>
        </button>
        <a href="/pages/book.html?id=${escHtml(e.book_id)}" class="action-btn">Ver libro</a>
      </div>`;

    card.querySelector(".like-btn").addEventListener("click", (ev) => toggleLike(ev.currentTarget, e.id));
    container.appendChild(card);
  });
}

function activityLabel(e) {
  const labels = {
    finished:     "terminó de leer",
    reading:      "está leyendo",
    want_to_read: "quiere leer",
    abandoned:    "abandonó",
  };
  return labels[e.status] || "registró";
}

async function toggleLike(btn, entryId) {
  if (!isLoggedIn()) { window.location.href = "/pages/login.html"; return; }
  if (btn.disabled) return;
  btn.disabled = true;
  const liked = btn.dataset.liked === "true";
  try {
    await api(`/api/entries/${entryId}/like`, { method: liked ? "DELETE" : "POST" });
    btn.dataset.liked = String(!liked);
    btn.classList.toggle("liked", !liked);
    btn.querySelector("svg").setAttribute("fill", !liked ? "currentColor" : "none");
    const span = btn.querySelector(".like-count");
    span.textContent = Number(span.textContent) + (!liked ? 1 : -1);
  } catch {
  } finally {
    btn.disabled = false;
  }
}

// ── Suggestions (who to follow) ───────────────────────────────
async function loadSuggestions() {
  const list = qs("#suggestions-list");
  try {
    const users = await api("/api/users/suggestions");
    if (!users.length) { list.innerHTML = `<div class="text-muted text-sm">Todavía no hay lectores para sugerir.</div>`; return; }
    list.innerHTML = "";
    users.slice(0, 5).forEach(u => {
      const row = document.createElement("div");
      row.className = "user-row";
      row.style.marginBottom = "0.5rem";
      row.innerHTML = `
        <a href="/pages/profile.html?user=${escHtml(u.username)}" class="user-avatar" style="text-decoration:none;">
          ${u.avatar_url ? `<img src="${escHtml(u.avatar_url)}" alt="">` : (u.display_name || u.username || "?")[0].toUpperCase()}
        </a>
        <div class="user-meta flex-1">
          <div class="user-name" style="font-size:0.85rem;">${escHtml(u.display_name || u.username)}</div>
          <div class="user-handle">${u.finished_count || 0} libros leídos</div>
        </div>
        <button class="btn btn-outline-accent btn-sm follow-btn" data-username="${escHtml(u.username)}">Seguir</button>`;
      row.querySelector(".follow-btn").addEventListener("click", async (e) => {
        if (!isLoggedIn()) { window.location.href = "/pages/login.html"; return; }
        const btn = e.currentTarget;
        try {
          await api(`/api/users/${u.username}/follow`, { method: "POST" });
          btn.textContent = "Siguiendo";
          btn.classList.remove("btn-outline-accent");
          btn.classList.add("btn-secondary");
          btn.disabled = true;
          toast(`Ahora seguís a ${u.display_name || u.username}`, "success");
          loadFeed();
        } catch (err) {
          toast(err.message, "error");
        }
      });
      list.appendChild(row);
    });
  } catch {
    list.innerHTML = "";
  }
}

// ── Boot ─────────────────────────────────────────────────────
loadFeed();
loadSuggestions();
