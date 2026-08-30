// study.js — Fullscreen Studio for FluentLoop. Shares chrome.storage with sidepanel.

const $ = (id) => document.getElementById(id);
const { speak, bindSpeakers } = JYH_MD;
const Q = JYH_STORE.Q;

const VIEWS = { overview: $("overviewView"), read: $("readView"), practice: $("practiceView") };
const ask = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, (res) =>
  r(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : res || { ok: false, error: "No response received." })
));

let doc = null;
let folderTag = null;

boot();

async function boot() {
  try { JYH_CAMELLIA.applyCursor(document); } catch (_) {}
  bindNav();
  bindRead();
  bindPractice();
  bindData();
  await renderLangSwitch();
  await renderOverview();
  await routeHash();
  window.addEventListener("hashchange", routeHash);
}

// Language switch
async function renderLangSwitch() {
  const active = await JYH_STORE.getLang();
  JYH_MD.setSpeakLang(active);
  const el = $("langSwitch");
  el.innerHTML = Object.entries(JYH_STORE.LANGS)
    .map(([code, meta]) => `<button class="lang-btn ${code === active ? "is-on" : ""}" data-lang="${code}">${meta.short}</button>`)
    .join("");
  el.querySelectorAll(".lang-btn").forEach((b) =>
    b.addEventListener("click", async () => {
      if (b.dataset.lang === active) return;
      await JYH_STORE.setLang(b.dataset.lang);
      doc = null; folderTag = null;
      $("readDoc")?.classList.add("hidden");
      $("readIntake")?.classList.remove("hidden");
      await renderLangSwitch();
      go("overview");
    })
  );
}

/* ============ Navigation ============ */
function bindNav() {
  document.querySelectorAll(".nav-link").forEach((b) => b.addEventListener("click", () => {
    go(b.dataset.view);
    if (b.dataset.view === "practice") renderPracticeHome();
  }));
  document.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => {
    go(b.dataset.goto);
    if (b.dataset.goto === "practice") renderPracticeHome();
  }));
  $("navDue").addEventListener("click", () => { go("practice"); startPractice("due"); });
  $("backToWall").addEventListener("click", () => { folderTag = null; renderOverview(); });
}

function go(name) {
  Object.entries(VIEWS).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
  document.querySelectorAll(".nav-link").forEach((b) => b.classList.toggle("is-on", b.dataset.view === name));
  window.scrollTo({ top: 0, behavior: "instant" });
  if (name === "overview") renderOverview();
  if (name === "read" && !doc) renderRecent();
}

async function routeHash() {
  const m = location.hash.match(/#card=([\w]+)/);
  if (!m) return;
  const card = await JYH_STORE.getCard(m[1]);
  if (card) openDoc(card, true);
}

let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 2200);
}

function bloom(size, ratio) {
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  const lit = Math.round(Math.max(0, Math.min(1, ratio)) * angles.length);
  const petals = angles.map((a, i) =>
    `<ellipse cx="24" cy="11.5" rx="5.4" ry="10.4" transform="rotate(${a} 24 24)" fill="${i < lit ? "#d4af37" : "rgba(196,165,116,0.18)"}"/>`
  ).join("");
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">
    ${petals}<circle cx="24" cy="24" r="4" fill="#f7f1e6"/><circle cx="24" cy="24" r="1.8" fill="#100e0c"/></svg>`;
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const { escapeRe, wordRe, shuffle, sample, uniq, localQuiz, sanitizeQuizList } = JYH_QUIZ;
const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

function highlight(sentence, word) {
  return esc(sentence).replace(new RegExp(`(${escapeRe(word)})`, "i"), "<mark>$1</mark>");
}
function wordState(srs) {
  if (JYH_STORE.isMastered(srs)) return { cls: "mastered", text: "Mastered" };
  if (srs.seen === 0) return { cls: "", text: "New" };
  return { cls: "", text: JYH_STORE.humanInterval(srs) };
}

/* ============ Overview ============ */
async function renderOverview() {
  const s = await JYH_STORE.stats();

  $("heroLine").textContent = s.words ? `${s.mastered} Words Mastered` : "Ready to Begin";
  $("heroSub").textContent = s.words
    ? `${s.cards} scrolls, ${s.words} vocabulary items, ${s.streak} day streak. ${s.due ? `${s.due} words due for spaced review today.` : "No words due today."}`
    : "Paste an article into Deep Read to extract vocabulary and grammar structures.";

  $("figures").innerHTML = [
    [s.cards, "Scrolls"], [s.folders, "Realms"], [s.words, "Words"], [s.streak, "Day Streak"],
  ].map(([n, l]) => `<div class="fig"><b>${n}</b><span>${l}</span></div>`).join("");

  $("navDue").classList.toggle("hidden", !s.due);
  $("navDue").textContent = `${s.due} due`;

  if (folderTag) return renderFolder(folderTag);
  $("cardListSection").classList.add("hidden");

  const folders = await JYH_STORE.folders();
  if (!folders.length) {
    $("wall").innerHTML = `<div class="blank" style="color:var(--ink-2)">Vault is currently empty.<br>Go to "Deep Read" to analyze an article, or select text on any webpage.</div>`;
    return;
  }
  $("wall").innerHTML = folders.map((f) => {
    const r = f.words ? f.mastered / f.words : 0;
    return `<button class="mod" data-tag="${esc(f.tag)}">
      <span class="bloom">${bloom(38, r)}</span>
      <div class="m-tag">${esc(f.tag)}</div>
      <div class="m-meta">${f.cards} scrolls · ${f.mastered}/${f.words} mastered</div>
      <div class="m-bar"><i style="width:${Math.round(r * 100)}%"></i></div>
    </button>`;
  }).join("");
  $("wall").querySelectorAll(".mod").forEach((b) =>
    b.addEventListener("click", () => { folderTag = b.dataset.tag; renderFolder(folderTag); })
  );
}

async function renderFolder(tag) {
  const cards = await JYH_STORE.listCards(tag);
  $("folderName").textContent = tag;
  $("cardRows").innerHTML = cards.map((c) => `
    <button class="row" data-id="${c.id}">
      <div class="r-title">${esc(c.title)}</div>
      <div class="r-sum">${esc(c.summary)}</div>
      <div class="r-meta">${c.words.length} words · ${c.concepts.length} concepts · ${fmtDate(c.ts)}</div>
    </button>`).join("");
  $("cardRows").querySelectorAll(".row").forEach((r) =>
    r.addEventListener("click", async () => openDoc(await JYH_STORE.getCard(r.dataset.id), true))
  );
  $("cardListSection").classList.remove("hidden");
  $("cardListSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ============ Deep Read ============ */
function bindRead() {
  const input = $("articleInput");
  input.addEventListener("input", () => { $("analyzeBtn").disabled = input.value.trim().length < 120; });
  $("analyzeBtn").addEventListener("click", analyze);
  $("backToIntake").addEventListener("click", () => {
    doc = null;
    history.replaceState(null, "", location.pathname);
    $("readDoc").classList.add("hidden");
    $("readIntake").classList.remove("hidden");
    renderRecent();
  });
  $("saveCardBtn").addEventListener("click", saveDoc);
  $("docTabs").addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (!t) return;
    document.querySelectorAll("#docTabs .tab").forEach((x) => x.classList.toggle("is-on", x === t));
    ["vocab", "econ", "bilingual", "cloze", "inflect", "translate", "makeup", "grammar", "notes"].forEach((p) =>
      $(`pane-${p}`).classList.toggle("hidden", p !== t.dataset.pane)
    );
  });
}

async function renderRecent() {
  const cards = (await JYH_STORE.listCards()).slice(0, 5);
  $("recentPick").innerHTML = !cards.length ? "" : `
    <h3 class="h3" style="margin:24px 0 12px">Or continue reading from Vault:</h3>
    <div class="rows">${cards.map((c) => `
      <button class="row" data-id="${c.id}">
        <div class="r-title">${esc(c.title)}</div>
        <div class="r-meta">${c.tags.join(" · ")} · ${c.words.length} words · ${fmtDate(c.ts)}</div>
      </button>`).join("")}</div>`;
  $("recentPick").querySelectorAll(".row").forEach((r) =>
    r.addEventListener("click", async () => openDoc(await JYH_STORE.getCard(r.dataset.id), true))
  );
}

async function analyze() {
  const text = $("articleInput").value.trim();
  $("analyzeBtn").disabled = true;
  $("analyzeBtn").textContent = "Analyzing…";
  $("intakeHint").textContent = "Extracting vocabulary, insights, and grammar exercises…";

  const res = await ask({ task: "study", type: "AI_JSON", payload: { text, existingTags: await JYH_STORE.allTags() } });

  $("analyzeBtn").disabled = false;
  $("analyzeBtn").textContent = "Analyze Article";
  if (!res.ok) { $("intakeHint").textContent = res.error; return; }
  $("intakeHint").textContent = "Typically takes 15 to 30 seconds.";

  const d = res.data;
  openDoc({
    id: null, title: d.title, summary: d.summary, tags: d.tags || [],
    words: (d.words || []).map((w) => ({ ...w, srs: JYH_STORE.freshSrs() })),
    concepts: d.concepts || [], bilingual: d.bilingual || [], grammar: d.grammar || [], cloze: d.cloze || [],
    inflect: d.inflect || [], translate: d.translate || [], makeup: d.makeup || [],
    notes: "", practice: {}, excerpt: text, source: {},
  }, false);
}

function openDoc(card, saved) {
  if (!card) return;
  doc = { ...card, practice: card.practice || {}, notes: card.notes || "" };
  doc.saved = saved;

  go("read");
  $("readIntake").classList.add("hidden");
  $("readDoc").classList.remove("hidden");

  $("docTags").textContent = (doc.tags || []).join(" · ");
  $("docTitle").textContent = doc.title;
  $("docSummary").textContent = doc.summary;
  $("saveCardBtn").classList.toggle("hidden", saved);
  $("saveHint").textContent = saved ? `In Vault · ${fmtDate(doc.ts)}` : "";

  renderVocab(); renderEcon(); renderBilingual(); renderCloze(); renderInflect(); renderTranslate(); renderMakeup(); renderGrammar(); renderNotes();
  document.querySelectorAll("#docTabs .tab").forEach((x, i) => x.classList.toggle("is-on", i === 0));
  ["vocab", "econ", "bilingual", "cloze", "inflect", "translate", "makeup", "grammar", "notes"].forEach((p, i) => $(`pane-${p}`).classList.toggle("hidden", i !== 0));
}

async function saveDoc() {
  if (!doc || doc.saved) return;
  const card = await JYH_STORE.addCard({
    title: doc.title, summary: doc.summary, tags: doc.tags,
    words: doc.words, concepts: doc.concepts,
    bilingual: doc.bilingual, grammar: doc.grammar, cloze: doc.cloze,
    inflect: doc.inflect, translate: doc.translate, makeup: doc.makeup,
    notes: doc.notes, excerpt: doc.excerpt,
  });
  await JYH_STORE.updateCard(card.id, { practice: doc.practice });
  doc.id = card.id; doc.ts = card.ts; doc.saved = true;
  $("saveCardBtn").classList.add("hidden");
  $("saveHint").textContent = "Saved to Vault";
  toast(`"${card.title}" saved. ${card.words.length} words added to practice queue.`);
  renderVocab();
}

function renderVocab() {
  $("pane-vocab").innerHTML = (doc.words || []).map((w) => {
    const st = wordState(w.srs || JYH_STORE.freshSrs());
    return `<div class="word" style="margin-bottom:12px;padding:10px;background:var(--surface-2);border-radius:10px;">
      <div class="word-head" style="display:flex;align-items:baseline;gap:8px;">
        <span class="word-en" style="font-weight:700;color:#fff;">${esc(w.en)}</span>
        ${w.ipa ? `<span class="word-ipa" style="color:var(--accent-cyan);font-family:var(--ipa);font-size:13px;">${esc(w.ipa)}</span>` : ""}
        <button class="spk" data-t="${esc(w.en)}" title="Pronounce">🔊</button>
        <span class="word-state ${st.cls}" style="font-size:11px;color:var(--accent-aqua);margin-left:auto;">${st.text}</span>
      </div>
      <div class="word-zh" style="font-size:13px;color:var(--ink-2);margin-top:2px;">${esc(w.zh)}${w.sense ? ` <em>· ${esc(w.sense)}</em>` : ""}</div>
      ${w.example ? `<div class="word-ex" style="font-size:12px;color:var(--ink-3);margin-top:4px;">${highlight(w.example, w.en)}</div>` : ""}
    </div>`;
  }).join("") || `<div class="blank">No vocabulary extracted from this article.</div>`;
  bindSpeakers($("pane-vocab"));
}

function renderEcon() {
  $("pane-econ").innerHTML = (doc.concepts || []).map((k) => `
    <div class="concept" style="margin-bottom:12px;padding:10px;background:var(--surface-2);border-radius:10px;">
      <div><span class="c-name" style="font-weight:700;color:#fff;">${esc(k.name)}</span><span class="c-en" style="color:var(--accent-cyan);margin-left:8px;font-size:13px;">${esc(k.en || "")}</span></div>
      <div class="c-ex" style="font-size:13px;color:var(--ink-2);margin-top:3px;">${esc(k.explain)}</div>
      ${k.why ? `<div class="c-why" style="font-size:12px;color:var(--ink-3);margin-top:2px;font-style:italic;">Context: ${esc(k.why)}</div>` : ""}
    </div>`).join("") || `<div class="blank">No concepts extracted.</div>`;
}

function renderBilingual() {
  $("pane-bilingual").innerHTML = (doc.bilingual || []).map((b) => `
    <div class="bi" style="margin-bottom:14px;padding:10px;background:var(--surface-2);border-radius:10px;">
      <div class="bi-en" style="color:#fff;font-size:14px;line-height:1.6;">${esc(b.en)}</div>
      <div class="bi-zh" style="color:var(--ink-2);font-size:13px;margin-top:4px;">${esc(b.zh)}</div>
    </div>`
  ).join("") || `<div class="blank">No bilingual alignment available.</div>`;
}

function renderCloze() {
  const items = doc.cloze || [];
  if (!items.length) { $("pane-cloze").innerHTML = `<div class="blank">No cloze exercises generated.</div>`; return; }
  $("pane-cloze").innerHTML = items.map((c, i) => `
    <div class="cloze" style="margin-bottom:14px;padding:12px;background:var(--surface-2);border-radius:10px;">
      <div class="cl-s" style="font-size:14px;color:#fff;margin-bottom:8px;">${esc(c.sentence)}</div>
      <div class="cl-row" style="display:flex;align-items:center;gap:8px;">
        <input class="inp" id="cl-${i}" placeholder="Fill in gap" autocomplete="off" spellcheck="false" style="background:var(--bg);border:1px solid var(--line);color:#fff;padding:6px 10px;border-radius:8px;font-size:13px;" />
        <button class="btn btn-quiet btn-small" data-i="${i}">Check</button>
        ${c.hint ? `<span class="cl-hint" style="font-size:11px;color:var(--ink-3);">${esc(c.hint)}</span>` : ""}
        <span class="mark" id="mk-${i}"></span>
      </div>
    </div>`).join("") + `<div class="q-actions" style="margin-top:14px;"><button class="btn" id="checkAll">Check All</button></div>`;

  const check = (i) => {
    const c = items[i];
    const el = $(`cl-${i}`);
    const ok = el.value.trim().toLowerCase() === String(c.answer).trim().toLowerCase();
    el.style.borderColor = ok ? "var(--ok)" : "var(--no)";
    $(`mk-${i}`).className = `mark ${ok ? "right" : "wrong"}`;
    $(`mk-${i}`).textContent = ok ? "✓" : `Expected: ${c.answer}`;
    return ok;
  };
  $("pane-cloze").querySelectorAll("button[data-i]").forEach((b) => b.addEventListener("click", () => check(+b.dataset.i)));
  $("checkAll").addEventListener("click", () => {
    const right = items.map((_, i) => check(i)).filter(Boolean).length;
    toast(`${right} / ${items.length} Correct`);
  });
}

function renderInflect() {
  const items = doc.inflect || [];
  if (!items.length) { $("pane-inflect").innerHTML = `<div class="blank">No inflection exercises generated.</div>`; return; }
  $("pane-inflect").innerHTML = items.map((it, i) => `
    <div class="cloze" style="margin-bottom:14px;padding:12px;background:var(--surface-2);border-radius:10px;">
      <div class="cl-s" style="font-size:14px;color:#fff;margin-bottom:8px;">${esc(it.sentence)} <span style="color:var(--accent-cyan)">(${esc(it.base)})</span></div>
      <div class="cl-row" style="display:flex;align-items:center;gap:8px;">
        <input class="inp" id="inf-${i}" placeholder="Correct form" autocomplete="off" spellcheck="false" style="background:var(--bg);border:1px solid var(--line);color:#fff;padding:6px 10px;border-radius:8px;font-size:13px;" />
        <button class="btn btn-quiet btn-small" data-i="${i}">Check</button>
        ${it.hint ? `<span class="cl-hint" style="font-size:11px;color:var(--ink-3);">${esc(it.hint)}</span>` : ""}
        <span class="mark" id="ifm-${i}"></span>
      </div>
    </div>`).join("") + `<div class="q-actions" style="margin-top:14px;"><button class="btn" id="checkAllInf">Check All</button></div>`;

  const check = (i) => {
    const it = items[i];
    const el = $(`inf-${i}`);
    const ok = el.value.trim().toLowerCase() === String(it.answer).trim().toLowerCase();
    el.style.borderColor = ok ? "var(--ok)" : "var(--no)";
    $(`ifm-${i}`).className = `mark ${ok ? "right" : "wrong"}`;
    $(`ifm-${i}`).textContent = ok ? "✓" : `Expected: ${it.answer}`;
    return ok;
  };
  $("pane-inflect").querySelectorAll("button[data-i]").forEach((b) => b.addEventListener("click", () => check(+b.dataset.i)));
  $("checkAllInf").addEventListener("click", () => {
    const right = items.map((_, i) => check(i)).filter(Boolean).length;
    toast(`${right} / ${items.length} Correct`);
  });
}

function renderTranslate() {
  const items = doc.translate || [];
  if (!items.length) { $("pane-translate").innerHTML = `<div class="blank">No translation exercises generated.</div>`; return; }
  $("pane-translate").innerHTML = items.map((it, i) => `
    <div class="subjective" style="margin-bottom:14px;padding:12px;background:var(--surface-2);border-radius:10px;">
      <div class="sj-prompt" style="font-size:14px;color:#fff;margin-bottom:6px;">${esc(it.zh)}</div>
      ${it.hint ? `<div class="sj-hint" style="font-size:11.5px;color:var(--ink-3);margin-bottom:6px;">Hint: ${esc(it.hint)}</div>` : ""}
      <textarea class="inp sj-input" id="tr-${i}" rows="2" placeholder="Write in target language..." style="width:100%;background:var(--bg);border:1px solid var(--line);color:#fff;padding:8px;border-radius:8px;font-size:13px;"></textarea>
      <div class="cl-row" style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <button class="btn btn-quiet btn-small" data-i="${i}">Grade with AI</button>
        <span class="mark" id="trm-${i}"></span>
      </div>
      <div class="sj-ref hidden" id="trr-${i}" style="font-size:12px;color:var(--accent-cyan);margin-top:6px;"><b>Reference: </b>${esc(it.en)}</div>
    </div>`).join("");
  bindSubjective("pane-translate", items, "tr", "translate");
}

function renderMakeup() {
  const items = doc.makeup || [];
  if (!items.length) { $("pane-makeup").innerHTML = `<div class="blank">No sentence composition exercises.</div>`; return; }
  $("pane-makeup").innerHTML = items.map((it, i) => `
    <div class="subjective" style="margin-bottom:14px;padding:12px;background:var(--surface-2);border-radius:10px;">
      <div class="sj-prompt" style="font-size:14px;color:#fff;margin-bottom:6px;">Compose a sentence with <b>${esc(it.word)}</b> <span style="font-size:12px;color:var(--ink-3);">(${esc(it.zh)})</span>
        <button class="spk" data-t="${esc(it.word)}" title="Pronounce">🔊</button></div>
      ${it.example ? `<div class="sj-hint" style="font-size:11.5px;color:var(--ink-3);margin-bottom:6px;">Example: ${esc(it.example)}</div>` : ""}
      <textarea class="inp sj-input" id="mk-${i}" rows="2" placeholder="Write sentence here..." style="width:100%;background:var(--bg);border:1px solid var(--line);color:#fff;padding:8px;border-radius:8px;font-size:13px;"></textarea>
      <div class="cl-row" style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <button class="btn btn-quiet btn-small" data-i="${i}">Grade with AI</button>
        <span class="mark" id="mkm-${i}"></span>
      </div>
    </div>`).join("");
  bindSpeakers($("pane-makeup"));
  bindSubjective("pane-makeup", items, "mk", "makeup");
}

function bindSubjective(paneId, items, prefix, kind) {
  $(paneId).querySelectorAll("button[data-i]").forEach((b) =>
    b.addEventListener("click", async () => {
      const i = +b.dataset.i;
      const val = $(`${prefix}-${i}`).value.trim();
      if (!val) return;
      const markEl = $(`${prefix}m-${i}`);
      b.disabled = true; markEl.textContent = "Grading with AI…"; markEl.className = "mark";
      const it = items[i];
      const question = kind === "translate" ? `Translate this sentence: ${it.zh}` : `Make a sentence with "${it.word}"`;
      const reference = kind === "translate" ? it.en : (it.example || it.word);
      const res = await ask({ type: "AI_JSON", task: "grade", payload: { question, reference, userAnswer: val, kind } });
      b.disabled = false;
      if (!res.ok) { markEl.className = "mark wrong"; markEl.textContent = res.error || "Grading failed"; return; }
      const ok = res.data.score >= 60;
      markEl.className = `mark ${ok ? "right" : "wrong"}`;
      markEl.textContent = `${res.data.verdict} · ${res.data.score} pts · ${res.data.feedback}`;
      $(`${prefix}r-${i}`)?.classList.remove("hidden");
    })
  );
}

function renderGrammar() {
  const pats = doc.grammar || [];
  if (!pats.length) { $("pane-grammar").innerHTML = `<div class="blank">No syntax patterns extracted.</div>`; return; }
  $("pane-grammar").innerHTML = pats.map((g, i) => `
    <div class="gram" style="margin-bottom:14px;padding:12px;background:var(--surface-2);border-radius:10px;">
      <div class="g-pat" style="font-weight:700;color:var(--accent-cyan);">${esc(g.pattern)}</div>
      <div class="g-zh" style="font-size:13px;color:var(--ink-2);margin-top:2px;">${esc(g.zh || "")}</div>
      ${g.example ? `<div class="g-ex" style="font-size:12px;color:var(--ink-3);margin:4px 0 8px;">${esc(g.example)}</div>` : ""}
      <textarea rows="2" data-i="${i}" placeholder="Practice this pattern with your own sentence..." style="width:100%;background:var(--bg);border:1px solid var(--line);color:#fff;padding:8px;border-radius:8px;font-size:13px;">${esc(doc.practice[i] || "")}</textarea>
    </div>`).join("") + `<div class="saved-flag" id="gramFlag"></div>`;

  $("pane-grammar").querySelectorAll("textarea").forEach((t) =>
    t.addEventListener("input", debounce(async () => {
      doc.practice[t.dataset.i] = t.value;
      if (doc.saved) { await JYH_STORE.updateCard(doc.id, { practice: doc.practice }); $("gramFlag").textContent = "Saved"; }
      else $("gramFlag").textContent = "Will save when added to Vault";
    }, 500))
  );
}

function renderNotes() {
  $("pane-notes").innerHTML = `
    <textarea class="notes-area" id="notesArea" placeholder="Write personal reflections, vocabulary notes, or questions…" style="width:100%;min-height:160px;background:var(--surface-2);border:1px solid var(--line);color:#fff;padding:12px;border-radius:10px;font-size:14px;">${esc(doc.notes || "")}</textarea>
    <div class="saved-flag" id="noteFlag" style="font-size:11px;color:var(--accent-cyan);margin-top:6px;"></div>`;
  $("notesArea").addEventListener("input", debounce(async () => {
    doc.notes = $("notesArea").value;
    if (doc.saved) { await JYH_STORE.updateCard(doc.id, { notes: doc.notes }); $("noteFlag").textContent = "Saved"; }
    else $("noteFlag").textContent = "Will save when added to Vault";
  }, 500));
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ============ Data Export / Import ============ */
function bindData() {
  $("exportBtn").addEventListener("click", async () => {
    const url = URL.createObjectURL(new Blob([await JYH_STORE.exportJSON()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `fluentloop-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  });
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { toast(`Imported ${await JYH_STORE.importJSON(await f.text())} scrolls`); renderOverview(); }
    catch (err) { toast("Import failed: " + err.message); }
    e.target.value = "";
  });
}


/* ============ Practice ============ */
let lastPracticeMode = "auto";
let exam = null;

function bindPractice() {
  $("startExam").addEventListener("click", () => startPractice("auto"));
  $("btnReviewDue")?.addEventListener("click", () => startPractice("due"));
  $("btnReviewAll")?.addEventListener("click", () => startPractice("all"));
  $("btnReviewHard")?.addEventListener("click", () => startPractice("hard"));
}

async function renderPracticeHome() {
  JYH_PRACTICE_KEYS.cleanup();
  $("practiceHome").classList.remove("hidden");
  $("examRoot").classList.add("hidden");
  $("reviewRoot")?.classList.add("hidden");

  const s = await JYH_STORE.stats();
  const folders = await JYH_STORE.folders();
  $("practiceSub").textContent = s.words
    ? `Vault contains ${s.words} items, ${s.due} due today. Practice puts each word in a sentence.`
    : "Vault is empty. Analyze an article in Deep Read first.";

  const cur = $("scope").value;
  $("scope").innerHTML = [`<option value="">All Realms · ${s.words} words</option>`]
    .concat(folders.map((f) => `<option value="${esc(f.tag)}">${esc(f.tag)} · ${f.words} words (${f.due} due)</option>`)).join("");
  if (cur) $("scope").value = cur;

  $("dueCount").textContent = s.due ? ` · ${s.due}` : "";
  $("startExam").disabled = !s.words;
  $("practiceHint").textContent = s.due
    ? "Due words first. Correct answers wait longer; misses come back sooner."
    : "Nothing due. Practice All Words anytime — SM-2 still updates.";
  $("navDue").classList.toggle("hidden", !s.due);
  $("navDue").textContent = `${s.due} due`;
}

async function startPractice(mode = "auto") {
  lastPracticeMode = mode;
  go("practice");
  const tag = $("scope").value || null;
  const words = await JYH_STORE.reviewWords(tag, mode);
  if (!words.length) {
    await renderPracticeHome();
    $("practiceHint").textContent = mode === "due" ? "No words due today." : "No words in this realm yet.";
    return;
  }

  $("practiceHome").classList.add("hidden");
  const root = $("examRoot");
  root.classList.remove("hidden");
  root.innerHTML = `<p class="sub">Building ${words.length} word questions…</p>`;

  const queue = words.filter((w) => {
    const head = JYH_QUIZ.cleanEn(w.en);
    if (typeof JYH_EN !== "undefined" && JYH_EN.isSimpleWord(head)) return false;
    return !!JYH_QUIZ.meaningOf(w);
  });
  if (!queue.length) {
    root.innerHTML = `<h1 class="h1">No words ready</h1><p class="sub">Save words with meanings from subtitles or web pages — simple words like "big" or "the" are skipped automatically.</p>
      <div class="q-actions"><button class="btn" id="backHome">Back</button></div>`;
    $("backHome").addEventListener("click", renderPracticeHome);
    return;
  }
  const cards = await JYH_STORE.listCards(tag);
  const lang = await JYH_STORE.getLang();
  const avoid = await JYH_QUIZ.recentWords();
  let questions = [];
  const src = $("quizSource")?.value || "local";
  if (src === "ai" && queue.length <= 30) {
    const res = await ask({ type: "AI_JSON", task: "quiz", payload: { cards: sample(cards, 8), count: queue.length, avoid: [...avoid] } });
    if (res.ok) {
      questions = sanitizeQuizList(res.data.questions).map((q) => {
        const hit = queue.find((w) => w.en.toLowerCase() === String(q.en || q.answer || "").toLowerCase().trim());
        return hit ? { ...q, cardId: hit.cardId, en: hit.en } : q;
      });
    }
  }
  if (!questions.length) questions = localQuiz(queue, [], cards, queue.length, avoid, "mixed", lang);
  if (!questions.length) {
    root.innerHTML = `<h1 class="h1">Not enough words</h1><p class="sub">Add a few more saved words with Chinese meanings, then try again.</p>
      <div class="q-actions"><button class="btn" id="backHome">Back</button></div>`;
    $("backHome").addEventListener("click", renderPracticeHome);
    return;
  }
  exam = { questions, i: 0, right: 0, wrong: [] };
  JYH_QUIZ.rememberWords(questions);
  renderQuestion();
}

function startExam() { return startPractice(lastPracticeMode || "auto"); }
function startReview() { return startPractice("auto"); }

function renderQuestion() {
  JYH_PRACTICE_KEYS.cleanup();
  const root = $("examRoot");
  const q = exam.questions[exam.i];
  if (!JYH_QUIZ.isValidWordQuestion?.(q)) {
    exam.i++;
    if (exam.i >= exam.questions.length) return finishExam();
    return renderQuestion();
  }
  const total = exam.questions.length;
  const speakText = JYH_QUIZ.cleanEn(q.prompt || q.en || "");
  const contextHtml = q.context
    ? `<div style="margin-top:16px;padding:12px 14px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;">
        <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2);margin-bottom:6px;">Context · 语境</div>
        <div style="font-size:14px;color:#fff;line-height:1.5;">${esc(q.context).replace(/___/g, '<span style="border-bottom:2px solid var(--accent-cyan);padding:0 8px;color:var(--accent-cyan);">___</span>')}</div>
      </div>`
    : "";

  const controls = `<p style="font-size:13px;color:var(--ink-2);margin:14px 0 8px;">Choose the meaning · 选择释义</p>
    <div class="choices" style="display:flex;flex-direction:column;gap:8px;">${(q.choices || []).map((c, i) => `<button class="choice" data-i="${i}" style="text-align:left;background:var(--surface-2);border:1px solid var(--line);color:#fff;padding:12px 16px;border-radius:10px;font-size:14px;cursor:pointer;"><span style="opacity:.55;margin-right:8px;font-family:var(--mono,monospace);">${["A","B","C","D"][i] || i + 1}</span>${esc(c)}</button>`).join("")}</div>`;

  root.innerHTML = `
    <div class="exam-focus" tabindex="-1">
    <div class="progress" style="margin-bottom:14px;">
      <span class="num" style="font-size:12px;color:var(--accent-cyan);font-weight:700;">${String(exam.i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span>
      <div class="bar" style="height:3px;background:var(--surface);border-radius:99px;margin-top:6px;"><i style="display:block;height:100%;background:linear-gradient(90deg,#e8c872,#d4af37);border-radius:99px;width:${(exam.i / total) * 100}%"></i></div>
    </div>
    <div class="q-kind" style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2);font-weight:700;">Word meaning</div>
    <div style="margin:16px 0 8px;">
      <div style="font-size:28px;font-weight:700;color:#fff;">${esc(q.prompt || q.en || "")}</div>
      ${q.ipa ? `<div style="font-size:14px;color:var(--ink-2);margin-top:6px;">${esc(q.ipa)} <button class="spk" data-t="${esc(speakText)}" title="Pronounce">🔊</button></div>` : `<div style="margin-top:6px;"><button class="spk" data-t="${esc(speakText)}" title="Pronounce">🔊</button></div>`}
    </div>
    ${controls}
    ${contextHtml}
    <div id="verdict" style="margin-top:16px;"></div>
    <button class="srs-remove" id="examRemove"><kbd>0</kbd> Too Easy · Remove from Vault</button>
    <div class="key-hint" id="examKeyHint">${JYH_PRACTICE_KEYS.HINT_EXAM_CHOICE}</div>
    </div>`;
  bindSpeakers(root);
  setTimeout(() => root.querySelector(".exam-focus")?.focus(), 40);

  const removeWord = async () => {
    if (q.cardId && q.en) await JYH_STORE.removeWord(q.cardId, q.en);
    toast(`Removed “${q.en || q.answer}”`);
    nextQuestion();
  };

  JYH_PRACTICE_KEYS.bindExam({
    answered: () => !!document.getElementById("nextQ"),
    isInput: () => false,
    choiceCount: () => (q.choices || []).length,
    onChoice: (i) => root.querySelectorAll(".choice")[i]?.click(),
    onNext: () => document.getElementById("nextQ")?.click(),
    onRemove: removeWord,
    onExit: renderPracticeHome,
  });

  $("examRemove")?.addEventListener("click", removeWord);
  root.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => answer(q, b, root)));
}

function bindExamNextKeys() {
  const hint = document.getElementById("examKeyHint");
  if (hint) hint.textContent = JYH_PRACTICE_KEYS.HINT_EXAM_NEXT;
  JYH_PRACTICE_KEYS.bindExam({
    answered: () => true,
    onNext: () => $("nextQ")?.click(),
    onRemove: () => $("examRemove")?.click(),
    onExit: renderPracticeHome,
  });
}

async function answer(q, btn, root) {
  const chosen = q.choices[+btn.dataset.i];
  const correct = chosen === q.answer;
  root.querySelectorAll(".choice").forEach((b, idx) => {
    b.disabled = true;
    const text = q.choices[idx];
    if (text === q.answer) { b.style.borderColor = "var(--ok)"; b.style.background = "var(--ok-bg)"; }
    else if (b === btn) { b.style.borderColor = "var(--no)"; b.style.background = "var(--no-bg)"; }
  });
  if (correct) exam.right++; else exam.wrong.push(q);
  if (q.cardId && q.en) await JYH_STORE.gradeWord(q.cardId, q.en, correct ? Q.GOOD : Q.FORGOT);

  $("verdict").innerHTML = `
    <div class="verdict ${correct ? "ok" : "no"}" style="padding:12px;background:var(--surface-2);border-radius:10px;border:1px solid ${correct ? "var(--ok)" : "var(--no)"}">
      <div class="v-head" style="font-weight:700;color:${correct ? "var(--ok)" : "var(--no)"}">${correct ? "✓ Correct!" : `✗ ${esc(q.answer)}`}</div>
      ${q.explain ? `<div class="v-why" style="font-size:13px;color:var(--ink-2);margin-top:4px;">“${esc(q.explain)}”</div>` : ""}
    </div>
    <div class="q-actions" style="margin-top:14px;"><button class="btn" id="nextQ">${exam.i + 1 === exam.questions.length ? "View Score" : "Next Question →"}</button></div>`;
  $("nextQ").addEventListener("click", nextQuestion);
  bindExamNextKeys();
}

function nextQuestion() {
  exam.i++;
  if (exam.i >= exam.questions.length) return finishExam();
  renderQuestion();
}

function finishExam() {
  JYH_PRACTICE_KEYS.cleanup();
  const total = exam.questions.length;
  const pct = Math.round((exam.right / total) * 100);
  $("examRoot").innerHTML = `
    <div class="score" style="text-align:center;padding:32px 0;">
      <div class="score-num" style="font-size:56px;font-weight:700;color:#fff;">${pct}%</div>
      <div class="score-lab" style="font-size:15px;color:var(--ink-2);">${exam.right} / ${total} Correct · SM-2 updated</div>
    </div>
    ${exam.wrong.length ? `<div class="rows" style="margin-top:24px">${exam.wrong.map((q) => `
      <div class="row" style="cursor:default;margin-bottom:8px;padding:10px;background:var(--surface-2);border-radius:10px;">
        <div class="r-title" style="font-weight:700;color:var(--no);">${esc(q.prompt || q.en || "")}</div>
        <div class="r-sum" style="font-size:13px;color:var(--ink-2);">${esc(q.answer || "")}${q.explain ? ` · “${esc(q.explain)}”` : ""}</div>
      </div>`).join("")}</div>` : `<p class="sub" style="text-align:center;color:var(--ok);">All correct.</p>`}
    <div class="q-actions" style="display:flex;gap:12px;margin-top:24px;justify-content:center;"><button class="btn" id="againBtn">Practice again</button>
    <button class="btn btn-quiet" id="homeBtn">Back</button></div>`;
  $("againBtn").addEventListener("click", () => startPractice(lastPracticeMode));
  $("homeBtn").addEventListener("click", renderPracticeHome);
}
