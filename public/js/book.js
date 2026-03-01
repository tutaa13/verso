import { renderNav, api, getUser, isLoggedIn, toast, renderStars, statusBadge, createStarInput, relativeDate, escHtml, qs } from "/js/app.js";

renderNav();

const params = new URLSearchParams(location.search);
const bookId = params.get("id");
if (!bookId) { window.location.href = "/index.html"; }

const myUser = getUser();
let bookData = null;
let reviewStarCtrl = null;

// ── Load book data ────────────────────────────────────────────
async function loadBook() {
  try {
    const res = await fetch(`https://openlibrary.org/works/${bookId}.json`);
    if (!res.ok) throw new Error("Book not found");
    const data = await res.json();
    bookData = data;
    renderBookHeader(data);
    loadCommunityData();
    loadReviews();
  } catch {
    // Try from our DB
    try {
      const dbBook = await api(`/api/books/${bookId}`);
      bookData = dbBook;
      renderBookHeader(dbBook);
      loadCommunityData();
      loadReviews();
    } catch (err) {
      toast("No se pudo cargar el libro", "error");
    }
  }
}

function getCoverUrl(data) {
  const coverId = data.covers?.[0];
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
}

function renderBookHeader(data) {
  const title  = data.title  || "Sin título";
  const author = data.author || (data.authors?.[0]?.key ? "Ver Open Library" : "");
  const desc   = typeof data.description === "string"
    ? data.description
    : (data.description?.value || "");
  const cover  = getCoverUrl(data);

  document.title = `${title} — Verso`;
  qs("#book-title").textContent  = title;
  qs("#book-author").textContent = author;
  qs("#book-desc").textContent   = desc.slice(0, 400) + (desc.length > 400 ? "…" : "");

  if (cover) {
    qs("#book-cover").src = cover;
    qs("#book-cover").classList.remove("hidden");
    qs("#cover-placeholder").classList.add("hidden");
  }

  qs("#ol-link").href = `https://openlibrary.org/works/${bookId}`;

  if (!isLoggedIn()) {
    qs("#add-to-shelf-btn").textContent = "Iniciar sesión para agregar";
    qs("#add-to-shelf-btn").addEventListener("click", () => {
      window.location.href = `/pages/login.html?redirect=/pages/book.html?id=${bookId}`;
    });
  } else {
    qs("#add-to-shelf-btn").addEventListener("click", () => addToShelf(data));
  }
}

async function addToShelf(data) {
  const btn = qs("#add-to-shelf-btn");
  btn.disabled = true;
  try {
    await api("/api/entries", {
      method: "POST",
      body: {
        book_id: bookId,
        book: {
          id: bookId,
          title:     data.title,
          author:    data.author || "",
          cover_url: getCoverUrl(data),
        },
        status: "want_to_read",
      },
    });
    btn.textContent = "Agregado a tu estante ✓";
    toast("Libro agregado a tu estante", "success");
  } catch (err) {
    toast(err.message, "error");
    btn.disabled = false;
  }
}

// ── Community stats ───────────────────────────────────────────
async function loadCommunityData() {
  try {
    const stats = await api(`/api/books/${bookId}/stats`);
    qs("#sidebar-rating").textContent  = stats.avg_rating ? Number(stats.avg_rating).toFixed(1) : "—";
    qs("#sidebar-reviews").textContent = stats.review_count ?? "—";
    qs("#sidebar-readers").textContent = stats.reader_count ?? "—";
    if (stats.avg_rating) {
      qs("#book-stars").innerHTML = renderStars(Number(stats.avg_rating));
    }
    qs("#book-rating-count").textContent = stats.review_count ? `${stats.review_count} reseñas` : "";
  } catch {}
}

// ── Reviews ───────────────────────────────────────────────────
async function loadReviews() {
  const list = qs("#reviews-list");
  list.innerHTML = "";
  try {
    const reviews = await api(`/api/entries?book=${bookId}&has_review=1`);
    if (!reviews.length) {
      qs("#reviews-empty").classList.remove("hidden");
      return;
    }
    reviews.forEach(r => {
      const card = document.createElement("div");
      card.className = "entry-card fade-up mb-1";
      card.innerHTML = `
        <div class="user-row">
          <a href="/pages/profile.html?user=${escHtml(r.user?.username || "")}" class="user-avatar" style="text-decoration:none;">
            ${r.user?.avatar_url ? `<img src="${escHtml(r.user.avatar_url)}" alt="">` : (r.user?.display_name || "?")[0].toUpperCase()}
          </a>
          <div class="user-meta">
            <div class="user-name">${escHtml(r.user?.display_name || r.user?.username || "")}</div>
            <div class="user-handle">${relativeDate(r.created_at)}</div>
          </div>
          <div style="margin-left:auto;">${renderStars(r.rating || 0)}</div>
        </div>
        ${r.review ? `<div class="entry-card-review">${escHtml(r.review)}</div>` : ""}
        ${r.quote  ? `<div class="entry-card-quote">"${escHtml(r.quote)}"</div>`  : ""}
        <div class="entry-card-actions">
          <button class="action-btn like-btn" data-id="${r.id}" data-liked="${r.i_liked || false}">
            <svg viewBox="0 0 20 20" fill="${r.i_liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5">
              <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/>
            </svg>
            ${r.likes_count || 0}
          </button>
        </div>`;
      card.querySelector(".like-btn").addEventListener("click", (e) => toggleLike(e.currentTarget, r.id));
      list.appendChild(card);
    });
  } catch (err) {
    toast("Error cargando reseñas", "error");
  }
}

async function toggleLike(btn, entryId) {
  if (!isLoggedIn()) { window.location.href = "/pages/login.html"; return; }
  const liked = btn.dataset.liked === "true";
  try {
    await api(`/api/entries/${entryId}/like`, { method: liked ? "DELETE" : "POST" });
    btn.dataset.liked = String(!liked);
    btn.classList.toggle("liked", !liked);
    const svg = btn.querySelector("svg");
    svg.setAttribute("fill", !liked ? "currentColor" : "none");
    const countMatch = btn.textContent.trim().match(/\d+/);
    const count = countMatch ? Number(countMatch[0]) + (!liked ? 1 : -1) : 0;
    btn.innerHTML = btn.innerHTML.replace(/\d+/, count);
  } catch {}
}

// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll(".shelf-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".shelf-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    qs("#tab-reviews").classList.toggle("hidden", tab !== "reviews");
    qs("#tab-readers").classList.toggle("hidden", tab !== "readers");
    if (tab === "readers") loadReaders();
  });
});

async function loadReaders() {
  const list = qs("#readers-list");
  if (list.children.length) return;
  try {
    const readers = await api(`/api/entries?book=${bookId}&status=finished`);
    readers.slice(0, 20).forEach(r => {
      const row = document.createElement("div");
      row.className = "user-row";
      row.innerHTML = `
        <a href="/pages/profile.html?user=${escHtml(r.user?.username || "")}" class="user-avatar" style="text-decoration:none;">
          ${r.user?.avatar_url ? `<img src="${escHtml(r.user.avatar_url)}" alt="">` : (r.user?.display_name || "?")[0].toUpperCase()}
        </a>
        <div class="user-meta">
          <div class="user-name">${escHtml(r.user?.display_name || r.user?.username || "")}</div>
          ${r.rating ? `<div>${renderStars(r.rating)}</div>` : `<div class="user-handle">${statusBadge(r.status)}</div>`}
        </div>`;
      list.appendChild(row);
    });
    if (!readers.length) list.innerHTML = `<div class="text-muted text-sm">Nadie ha marcado este libro todavía.</div>`;
  } catch {}
}

// ── Write review modal ────────────────────────────────────────
function openReviewModal() {
  if (!isLoggedIn()) { window.location.href = `/pages/login.html`; return; }
  qs("#review-modal").classList.add("open");
  reviewStarCtrl = createStarInput(qs("#review-star-input"), () => {});
}
function closeReviewModal() { qs("#review-modal").classList.remove("open"); }

qs("#write-review-btn").addEventListener("click", openReviewModal);
qs("#review-modal-close").addEventListener("click", closeReviewModal);
qs("#review-modal").addEventListener("click", (e) => { if (e.target === qs("#review-modal")) closeReviewModal(); });

qs("#submit-review-btn").addEventListener("click", async () => {
  const review = qs("#review-text").value.trim();
  const quote  = qs("#review-quote").value.trim();
  const rating = reviewStarCtrl?.getValue() || null;
  const errorEl = qs("#review-modal-error");
  errorEl.classList.add("hidden");

  if (!review && !rating) {
    errorEl.textContent = "Escribí una reseña o seleccioná una puntuación";
    errorEl.classList.remove("hidden");
    return;
  }

  const btn = qs("#submit-review-btn");
  btn.disabled = true; btn.textContent = "Publicando...";
  try {
    const data = bookData;
    await api("/api/entries", {
      method: "POST",
      body: {
        book_id:  bookId,
        book: { id: bookId, title: data?.title || "", author: data?.author || "", cover_url: getCoverUrl(data || {}) },
        status:   "finished",
        rating,
        review,
        quote,
      },
    });
    toast("Reseña publicada", "success");
    closeReviewModal();
    loadReviews();
    loadCommunityData();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false; btn.textContent = "Publicar reseña";
  }
});

// ── Boot ──────────────────────────────────────────────────────
loadBook();
