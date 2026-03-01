import { renderNav, createTagInput, toast, escHtml, qs } from "/js/app.js";

renderNav("discover");

// ── Filter groups ────────────────────────────────────────────
const FILTER_GROUPS = [
  { title: "Estilo de prosa / Prose style", chips: ["Prosa elaborada y literaria","Escritura concisa y directa","Voz narrativa irónica","Prosa poética o lírica","Humor sutil y refinado","Narrador no confiable","Muy descriptiva","Diálogos brillantes"] },
  { title: "Tipo de personajes / Characters", chips: ["Intelectuales y cultos","Alta sociedad o aristocracia","Moralmente ambiguos","Protagonista femenino fuerte","Antihéroes","Personajes históricos reales","Artistas y creadores","Outsiders y marginales"] },
  { title: "Época y ambientación / Setting", chips: ["Siglo XIX","Primera mitad siglo XX","Segunda mitad siglo XX","Contemporánea","Europa del Este o Rusia","América Latina","Nueva York u otras metrópolis","Francia o Italia","Japón o Asia","Ambientación exótica"] },
  { title: "Temáticas / Themes", chips: ["Arte, cultura y estética","Dinero, clase y poder","Identidad y reinvención","Historia y política","Amor y relaciones complejas","Pérdida, nostalgia y memoria","Familia y herencia","Filosofía y moral","Ambición y declive","Secretos y mentiras","Espionaje e inteligencia","Guerra y conflicto bélico","Crimen organizado"] },
  { title: "Estructura narrativa / Structure", chips: ["Historia lineal y fluida","Estructura experimental","Novela epistolar o de documentos","Saga familiar o generacional","Relatos dentro de relatos","Ritmo lento y contemplativo","Ritmo ágil con giros","Varias voces narradoras"] },
  { title: "Género / Genre", chips: ["Novela histórica","Realismo literario","Realismo mágico","Autoficción o biográfico","Thriller o espionaje","Policial literario","Cuentos o relatos cortos","Ensayo narrativo"] },
  { title: "Idioma original / Language", chips: ["Inglés","Español","Ruso o Europa del Este","Francés o italiano","Alemán o nórdico","Japonés o asiático","Cualquier idioma"] },
  { title: "Longitud y reconocimiento / Length", chips: ["Novelas largas (500+ págs.)","Novelas cortas o medianas","Clásicos conocidos","Joyas poco conocidas","Premios Booker, Pulitzer, etc.","Publicados últimos 10 años"] },
];

// ── State ─────────────────────────────────────────────────────
const activeChips = new Set();
let qty = 5;
let loading = false;
let booksInput, moviesInput;

// ── Historial de libros ya vistos (localStorage) ──────────────
const SEEN_KEY = "verso_seen_books";
const SEEN_MAX = 60; // máximo de títulos a recordar

function getSeenBooks() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { return []; }
}

function addSeenBooks(libros) {
  const seen = getSeenBooks();
  libros.forEach(b => {
    const entry = `${b.titulo} de ${b.autor}`;
    if (!seen.includes(entry)) seen.push(entry);
  });
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-SEEN_MAX)));
  updateSeenCounter();
}

function clearSeenBooks() {
  localStorage.removeItem(SEEN_KEY);
  updateSeenCounter();
}

function updateSeenCounter() {
  const count = getSeenBooks().length;
  const el = qs("#seen-counter");
  if (!el) return;
  if (count > 0) {
    el.textContent = `${count} libro${count !== 1 ? "s" : ""} en historial`;
    el.style.display = "inline";
    qs("#clear-seen-btn").style.display = "inline";
  } else {
    el.style.display = "none";
    qs("#clear-seen-btn").style.display = "none";
  }
}

// ── Init tag inputs ──────────────────────────────────────────
function initInputs() {
  const booksWrap = qs("#books-input-wrap");
  booksInput = createTagInput(booksWrap, {
    placeholder: "Título · Enter para agregar",
    type: "book",
  });

  const moviesWrap = qs("#movies-input-wrap");
  moviesInput = createTagInput(moviesWrap, {
    placeholder: "Título · Enter para agregar",
    type: "movie",
  });

  // Watch for changes to update search button
  const observer = new MutationObserver(updateSearchBtn);
  observer.observe(booksWrap, { childList: true });
  observer.observe(moviesWrap, { childList: true });
  qs("#free-text").addEventListener("input", updateSearchBtn);
}

// ── Build filter chips ───────────────────────────────────────
function buildFilters() {
  const container = qs("#filter-groups");
  FILTER_GROUPS.forEach(group => {
    const div = document.createElement("div");
    div.innerHTML = `<div class="filter-group-title">${escHtml(group.title)}</div><div class="chips-wrap"></div>`;
    const wrap = div.querySelector(".chips-wrap");
    group.chips.forEach(chip => {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.textContent = chip;
      btn.addEventListener("click", () => {
        if (activeChips.has(chip)) { activeChips.delete(chip); btn.classList.remove("active"); }
        else { activeChips.add(chip); btn.classList.add("active"); }
      });
      wrap.appendChild(btn);
    });
    container.appendChild(div);
  });
}

// ── Qty range ─────────────────────────────────────────────────
function initQty() {
  const range = qs("#qty-range");
  const display = qs("#qty-display");
  range.addEventListener("input", () => { qty = Number(range.value); display.textContent = qty; });
}

// ── Search button state ──────────────────────────────────────
function updateSearchBtn() {
  const hasInput = booksInput?.getTags().length > 0
    || moviesInput?.getTags().length > 0
    || qs("#free-text").value.trim().length > 0;

  const btn = qs("#search-btn");
  btn.disabled = !hasInput || loading;

  const summary = qs("#selection-summary");
  const parts = [];
  const b = booksInput?.getTags().length || 0;
  const m = moviesInput?.getTags().length || 0;
  if (b > 0) parts.push(`${b} libro${b !== 1 ? "s" : ""}`);
  if (m > 0) parts.push(`${m} película${m !== 1 ? "s" : ""}`);
  if (qs("#free-text").value.trim()) parts.push("texto libre");
  summary.textContent = parts.length > 0 ? `Buscando por: ${parts.join(" + ")}` : "";
}

// ── Build prompt ──────────────────────────────────────────────
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
  const filterPart = chips.length > 0 ? ` Preferencias: ${chips.join(", ")}.` : "";
  return `Sos un crítico literario y cinéfilo experto. ${context}${filterPart} Recomendá exactamente ${qty} libros. Respondé SOLO con JSON válido (sin backticks ni markdown). Cada por_que: máximo 2 oraciones.` +
    ` Formato: {"analisis":"una oración sobre el perfil del lector","libros":[{"titulo":"...","autor":"...","anio":"...","por_que":"...","conexion":"...","tags":["t1","t2","t3"]}]}`;
}

// ── Parse AI response ─────────────────────────────────────────
function parseResponse(raw) {
  const clean = raw.replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); } catch {}
  const lb = clean.lastIndexOf("},");
  if (lb > 0) {
    try { return JSON.parse(clean.slice(0, lb + 1) + "\n]\n}"); } catch {}
  }
  throw new Error("Respuesta incompleta. Intentá de nuevo.");
}

// ── Render results ────────────────────────────────────────────
function renderResults(data) {
  qs("#results-analysis").textContent = data.analisis || "";
  const list = qs("#results-list");
  list.innerHTML = "";

  (data.libros || []).forEach((book, i) => {
    const card = document.createElement("div");
    card.className = "book-card fade-up";
    card.style.animationDelay = `${i * 0.06}s`;
    card.innerHTML = `
      <div class="book-card-num">${String(i + 1).padStart(2, "0")}</div>
      <div class="book-card-body">
        <div class="book-card-title">${escHtml(book.titulo)}</div>
        <div class="book-card-meta">${escHtml(book.autor)} · ${escHtml(String(book.anio))}</div>
        <div class="book-card-why">${escHtml(book.por_que)}</div>
        ${book.conexion ? `<div class="book-card-conexion">${escHtml(book.conexion)}</div>` : ""}
        <div class="book-card-footer">
          <div class="tags">${(book.tags || []).map(t => `<span class="tag">${escHtml(t)}</span>`).join("")}</div>
          <a href="https://openlibrary.org/search?q=${encodeURIComponent(book.titulo + " " + book.autor)}"
             target="_blank" rel="noreferrer"
             style="font-size:0.75rem;color:var(--muted);text-decoration:none;white-space:nowrap;font-family:var(--font-mono);letter-spacing:0.08em;">
            Open Library ↗
          </a>
        </div>
      </div>`;
    list.appendChild(card);
  });
}

// ── Show/hide states ──────────────────────────────────────────
function setState(state) {
  const ids = ["empty-state", "loading-state", "error-state", "results-container"];
  ids.forEach(id => qs(`#${id}`)?.classList.add("hidden"));
  if (state) qs(`#${state}`)?.classList.remove("hidden");
}

// ── Search ────────────────────────────────────────────────────
async function doSearch() {
  if (loading) return;
  const books = booksInput.getTags();
  const movies = moviesInput.getTags();
  const freeText = qs("#free-text").value.trim();
  const chips = [...activeChips];

  if (!books.length && !movies.length && !freeText) return;

  loading = true;
  updateSearchBtn();
  setState("loading-state");

  try {
    const excludedBooks = getSeenBooks();
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ books, movies, freeText, chips, qty, excludedBooks }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    if (data.libros?.length) addSeenBooks(data.libros);
    renderResults(data);
    setState("results-container");
  } catch (err) {
    qs("#error-message").textContent = err.message || "No fue posible completar la búsqueda.";
    setState("error-state");
  } finally {
    loading = false;
    updateSearchBtn();
  }
}

// ── Boot ─────────────────────────────────────────────────────
initInputs();
buildFilters();
initQty();
setState("empty-state");
updateSeenCounter();

qs("#search-btn").addEventListener("click", doSearch);
qs("#retry-btn").addEventListener("click", doSearch);
qs("#clear-seen-btn")?.addEventListener("click", () => {
  clearSeenBooks();
  toast("Historial borrado — la IA ya no excluye libros anteriores.");
});
