import { renderNav, api, getUser, isLoggedIn, toast, renderStars, statusBadge, createStarInput, relativeDate, escHtml, qs } from "/js/app.js";

renderNav();

const params  = new URLSearchParams(location.search);
const myUser  = getUser();
const username = params.get("user") || myUser?.username;
if (!username) { window.location.href = "/index.html"; }

let profileData = null;
let currentStatus = "finished";
let starInputCtrl = null;
let selectedBook  = null;
let editEntryId   = null;

// ── Load profile ──────────────────────────────────────────────
async function loadProfile() {
  try {
    profileData = await api(`/api/users/${username}`);
    renderProfile(profileData);
    loadShelf(currentStatus);
  } catch (err) {
    toast("No se pudo cargar el perfil", "error");
  }
}

function renderProfile(p) {
  document.title = `${p.display_name || p.username} — Verso`;
  const initial = (p.display_name || p.username || "?")[0].toUpperCase();
  const avatarEl = qs("#profile-avatar");
  if (p.avatar_url) {
    avatarEl.innerHTML = `<img src="${escHtml(p.avatar_url)}" alt="${escHtml(p.username)}">`;
  } else {
    avatarEl.textContent = initial;
  }
  qs("#profile-display-name").textContent = p.display_name || p.username;
  qs("#profile-username").textContent = `@${p.username}`;
  qs("#profile-bio").textContent = p.bio || "";
  qs("#stat-finished").textContent  = p.stats?.finished  ?? 0;
  qs("#stat-reading").textContent   = p.stats?.reading   ?? 0;
  qs("#stat-followers").textContent = p.stats?.followers ?? 0;
  qs("#stat-following").textContent = p.stats?.following ?? 0;

  const actionsEl = qs("#profile-actions");
  const isOwn = myUser && myUser.username === p.username;
  if (isOwn) {
    actionsEl.innerHTML = `<button class="btn btn-secondary btn-sm" id="edit-profile-btn">Editar perfil</button>`;
    qs("#add-book-btn-wrap").classList.remove("hidden");
  } else if (isLoggedIn()) {
    const isFollowing = p.is_following;
    actionsEl.innerHTML = `
      <button class="btn ${isFollowing ? "btn-secondary" : "btn-primary"} btn-sm" id="follow-btn">
        ${isFollowing ? "Siguiendo" : "Seguir"}
      </button>`;
    qs("#follow-btn").addEventListener("click", toggleFollow);
  }
}

async function toggleFollow() {
  const btn = qs("#follow-btn");
  const following = btn.textContent.trim() === "Siguiendo";
  try {
    await api(`/api/users/${username}/follow`, { method: following ? "DELETE" : "POST" });
    btn.textContent = following ? "Seguir" : "Siguiendo";
    btn.className = `btn ${following ? "btn-primary" : "btn-secondary"} btn-sm`;
    const statEl = qs("#stat-followers");
    statEl.textContent = Number(statEl.textContent) + (following ? -1 : 1);
  } catch (err) {
    toast("No se pudo actualizar", "error");
  }
}

// ── Shelf ─────────────────────────────────────────────────────
async function loadShelf(status) {
  currentStatus = status;
  const list = qs("#shelf-list");
  const empty = qs("#shelf-empty");
  list.innerHTML = `<div class="skeleton" style="height:120px;border-radius:12px;margin-bottom:0.75rem;"></div>`.repeat(3);
  empty.classList.add("hidden");

  try {
    const isOwn = myUser && myUser.username === username;
    const entries = await api(`/api/entries?user=${username}&status=${status}`);
    list.innerHTML = "";

    if (!entries.length) {
      const labels = { finished:"leídos", reading:"en progreso", want_to_read:"en tu lista", abandoned:"abandonados" };
      qs("#shelf-empty-title").textContent = "Sin libros aquí todavía";
      qs("#shelf-empty-sub").textContent = isOwn
        ? `Todavía no tenés libros ${labels[status] || ""}.`
        : `Este lector no tiene libros ${labels[status] || ""}.`;
      empty.classList.remove("hidden");
      return;
    }

    entries.forEach(e => {
      const card = document.createElement("div");
      card.className = "entry-card fade-up mb-2";
      card.innerHTML = `
        <div class="entry-card-header">
          ${e.book?.cover_url
            ? `<img class="entry-card-cover" src="${escHtml(e.book.cover_url)}" alt="">`
            : `<div class="entry-card-cover-placeholder"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg></div>`}
          <div>
            <a href="/pages/book.html?id=${escHtml(e.book_id)}" class="entry-card-title">${escHtml(e.book?.title || e.book_id)}</a>
            <div class="entry-card-author">${escHtml(e.book?.author || "")}</div>
            <div class="flex items-center gap-1">
              ${statusBadge(e.status)}
              ${e.rating ? renderStars(e.rating) : ""}
            </div>
          </div>
          ${myUser && myUser.username === username ? `
            <div style="margin-left:auto;display:flex;gap:0.4rem;">
              <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${e.id}">Editar</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--error)" data-action="delete" data-id="${e.id}">×</button>
            </div>` : ""}
        </div>
        ${e.review ? `<div class="entry-card-review">"${escHtml(e.review)}"</div>` : ""}
        ${e.quote  ? `<div class="entry-card-quote">"${escHtml(e.quote)}"</div>` : ""}
        ${e.finished_at ? `<div class="text-xs text-muted" style="margin-top:0.35rem;">Terminado ${relativeDate(e.finished_at)}</div>` : ""}`;

      card.querySelector("[data-action='edit']")?.addEventListener("click", () => openEditModal(e));
      card.querySelector("[data-action='delete']")?.addEventListener("click", () => deleteEntry(e.id, card));
      list.appendChild(card);
    });
  } catch (err) {
    toast("Error cargando el estante", "error");
  }
}

// ── Shelf tabs ────────────────────────────────────────────────
qs("#shelf-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".shelf-tab");
  if (!btn) return;
  qs(".shelf-tab.active")?.classList.remove("active");
  btn.classList.add("active");
  loadShelf(btn.dataset.status);
});

// ── Add / Edit entry modal ────────────────────────────────────
function openAddModal() {
  editEntryId = null;
  selectedBook = null;
  resetModal();
  openModal();
}

function openEditModal(entry) {
  editEntryId = entry.id;
  selectedBook = { id: entry.book_id, title: entry.book?.title, author: entry.book?.author, cover: entry.book?.cover_url };
  resetModal();
  // Pre-fill
  showSelectedBook(selectedBook);
  qs("#entry-status").value    = entry.status;
  qs("#entry-review").value    = entry.review || "";
  qs("#entry-quote").value     = entry.quote  || "";
  qs("#entry-started").value   = entry.started_at  ? entry.started_at.slice(0,10)  : "";
  qs("#entry-finished").value  = entry.finished_at ? entry.finished_at.slice(0,10) : "";
  if (entry.rating) starInputCtrl?.setValue(entry.rating);
  openModal();
}

function resetModal() {
  qs("#book-search-input").value = "";
  qs("#book-search-dropdown").innerHTML = "";
  qs("#book-search-dropdown").classList.remove("open");
  qs("#selected-book-display").classList.add("hidden");
  qs("#entry-status").value   = "want_to_read";
  qs("#entry-review").value   = "";
  qs("#entry-quote").value    = "";
  qs("#entry-started").value  = "";
  qs("#entry-finished").value = "";
  qs("#modal-error").classList.add("hidden");
  starInputCtrl = createStarInput(qs("#star-input-container"), () => {});
}

function openModal()  { qs("#add-modal").classList.add("open"); }
function closeModal() { qs("#add-modal").classList.remove("open"); }

qs("#add-book-btn")?.addEventListener("click", openAddModal);
qs("#add-modal-close").addEventListener("click", closeModal);
qs("#add-modal").addEventListener("click", (e) => { if (e.target === qs("#add-modal")) closeModal(); });

// ── Book search ───────────────────────────────────────────────
let searchTimeout;
qs("#book-search-input").addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) { qs("#book-search-dropdown").classList.remove("open"); return; }
  searchTimeout = setTimeout(() => searchBooks(q), 350);
});

async function searchBooks(q) {
  try {
    const data = await api(`/api/books/search?q=${encodeURIComponent(q)}`);
    renderSearchResults(data.books || []);
  } catch {}
}

function renderSearchResults(books) {
  const dd = qs("#book-search-dropdown");
  dd.innerHTML = "";
  if (!books.length) { dd.classList.remove("open"); return; }
  books.slice(0, 8).forEach(book => {
    const item = document.createElement("div");
    item.className = "book-search-result";
    item.innerHTML = `
      ${book.cover_url ? `<img class="book-search-result-cover" src="${escHtml(book.cover_url)}" alt="">` : `<div class="book-search-result-cover"></div>`}
      <div>
        <div class="book-search-result-title">${escHtml(book.title)}</div>
        <div class="book-search-result-author">${escHtml(book.author || "")}</div>
      </div>`;
    item.addEventListener("click", () => {
      selectedBook = book;
      showSelectedBook(book);
      qs("#book-search-input").value = "";
      dd.classList.remove("open");
    });
    dd.appendChild(item);
  });
  dd.classList.add("open");
}

function showSelectedBook(book) {
  const display = qs("#selected-book-display");
  display.classList.remove("hidden");
  qs("#selected-book-title").textContent  = book.title || "";
  qs("#selected-book-author").textContent = book.author || "";
  const img = qs("#selected-book-cover");
  if (book.cover_url || book.cover) { img.src = book.cover_url || book.cover; img.style.display = "block"; }
  else img.style.display = "none";
}

// Close dropdown on outside click
document.addEventListener("click", (e) => {
  if (!qs("#book-search-wrap")?.contains(e.target)) {
    qs("#book-search-dropdown")?.classList.remove("open");
  }
});

// ── Save entry ─────────────────────────────────────────────────
qs("#save-entry-btn").addEventListener("click", saveEntry);

async function saveEntry() {
  const errorEl = qs("#modal-error");
  errorEl.classList.add("hidden");

  if (!selectedBook && !editEntryId) {
    errorEl.textContent = "Seleccioná un libro primero";
    errorEl.classList.remove("hidden");
    return;
  }

  const payload = {
    book_id:     editEntryId ? undefined : selectedBook.id,
    book:        editEntryId ? undefined : selectedBook,
    status:      qs("#entry-status").value,
    rating:      starInputCtrl?.getValue() || null,
    review:      qs("#entry-review").value.trim() || null,
    quote:       qs("#entry-quote").value.trim() || null,
    started_at:  qs("#entry-started").value  || null,
    finished_at: qs("#entry-finished").value || null,
  };

  const btn = qs("#save-entry-btn");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    if (editEntryId) {
      await api(`/api/entries/${editEntryId}`, { method: "PUT", body: payload });
      toast("Entrada actualizada", "success");
    } else {
      await api("/api/entries", { method: "POST", body: payload });
      toast("Libro agregado a tu estante", "success");
    }
    closeModal();
    loadShelf(currentStatus);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar";
  }
}

// ── Delete entry ──────────────────────────────────────────────
async function deleteEntry(id, cardEl) {
  if (!confirm("¿Eliminar este libro de tu estante?")) return;
  try {
    await api(`/api/entries/${id}`, { method: "DELETE" });
    cardEl.style.opacity = "0";
    cardEl.style.transition = "opacity 0.2s";
    setTimeout(() => { cardEl.remove(); }, 200);
    toast("Entrada eliminada", "success");
  } catch (err) {
    toast("No se pudo eliminar", "error");
  }
}

// ── Boot ──────────────────────────────────────────────────────
loadProfile();
