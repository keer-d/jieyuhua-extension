// sidepanel.js — FluentLoop: Studio / Vault / Ebbinghaus Practice / Settings.
// Treasure map aesthetic, glassmorphic fluid mechanics, and monthly study ledger.

const DEFAULT_CONFIG = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
  hoverModel: "gpt-4o-mini",
  baseUrl: "https://api.openai.com/v1",
  systemPrompt: "",
};

const $ = (id) => document.getElementById(id);
const { render: md, speak, bindSpeakers, bindWordSavers, bindWordExamples, esc } = JYH_MD;

const VIEWS = { chat: $("chatView"), shelf: $("shelfView"), practice: $("practiceView"), settings: $("settingsView") };

let settings = {};
let history = [];
let streaming = false;
let calState = { year: new Date().getFullYear(), month: new Date().getMonth() };

init();

async function init() {
  settings = await loadSettings();
  paintCamellias();
  paintOrnaments();
  try { JYH_CAMELLIA.applyCursor(document); } catch (_) {}
  fillSettingsForm(settings);
  bindEvents();
  await renderLangSwitch();
  await JYH_STORE.syncAllLookups();
  await refreshBadges();
  await updateDailyReward();
  await consumePendingComposer();
}

function paintOrnaments() {
  const astrolabe = $("emptyAstrolabe");
  if (astrolabe) astrolabe.innerHTML = JYH_CAMELLIA.svgCompass(54);
  const mapCompass = $("mapCompass");
  if (mapCompass) mapCompass.innerHTML = JYH_CAMELLIA.svgCompass(32);
}

function smartJoinCaption(existing, incoming) {
  const a = String(existing || "").trimEnd();
  const b = String(incoming || "").trim();
  if (!a) return b;
  if (!b) return a;
  if (a === b || a.endsWith(b)) return a;
  if (b.startsWith(a)) return b;

  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  let overlap = 0;
  for (let n = Math.min(aWords.length, bWords.length); n > 0; n--) {
    const tail = aWords.slice(-n).join(" ").toLowerCase();
    const head = bWords.slice(0, n).join(" ").toLowerCase();
    if (tail === head) {
      overlap = n;
      break;
    }
  }
  if (overlap > 0) {
    const rest = bWords.slice(overlap).join(" ");
    return rest ? `${a} ${rest}` : a;
  }

  if (/[.!?…]["'”’)]*$/.test(a) && /^[A-Z"“‘(]/.test(b)) return `${a} ${b}`;
  return `${a} ${b}`;
}

function applyComposerText(text, opts = {}) {
  if (!text) return;
  show("chat");
  const el = $("input");
  const incoming = String(text).replace(/\s+/g, " ").trim();
  if (!incoming) return;

  const append = opts.append !== false;
  const current = el.value.replace(/\s+/g, " ").trim();

  if (!current) el.value = incoming;
  else if (!append) el.value = incoming;
  else if (current === incoming || current.endsWith(incoming)) return;
  else el.value = smartJoinCaption(current, incoming);

  autoGrow();
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
}

async function consumePendingComposer() {
  try {
    const d = await chrome.storage.local.get(["pendingComposer", "pendingComposerAppend"]);
    if (d.pendingComposer) {
      applyComposerText(d.pendingComposer, { append: d.pendingComposerAppend !== false });
      await chrome.storage.local.remove(["pendingComposer", "pendingComposerAppend"]);
    }
  } catch (_) {}
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "FILL_COMPOSER" && msg.text) {
    applyComposerText(msg.text, { append: msg.append !== false });
  }
});

/* ============ Language Switcher ============ */
async function renderLangSwitch() {
  const active = await JYH_STORE.getLang();
  JYH_MD.setSpeakLang(active);
  document.querySelectorAll("#quizType .fr-only").forEach((opt) => {
    opt.hidden = active !== "fr";
    opt.disabled = active !== "fr";
  });
  $("composerActions")?.classList.toggle("hidden", active !== "fr");
  const quizType = $("quizType");
  if (quizType && active !== "fr" && (quizType.value === "tense" || quizType.value === "inflect")) {
    quizType.value = "mixed";
  }
  const el = $("langSwitch");
  el.innerHTML = Object.entries(JYH_STORE.LANGS)
    .map(([code, meta]) => `<button class="lang-btn ${code === active ? "is-on" : ""}" data-lang="${code}" title="${esc(meta.label)}">${meta.short}</button>`)
    .join("");
  el.querySelectorAll(".lang-btn").forEach((b) =>
    b.addEventListener("click", async () => {
      if (b.dataset.lang === active) return;
      await JYH_STORE.setLang(b.dataset.lang);
      history = [];
      chatSavedCardId = null;
      $("saveChatBar")?.remove();
      const empty = $("emptyState");
      [...$("messages").children].forEach((c) => { if (c !== empty) c.remove(); });
      if (empty) { empty.style.display = ""; $("messages").appendChild(empty); }
      await renderLangSwitch();
      await refreshBadges();
      await updateDailyReward();
      show("chat");
    })
  );
}

/* ============ Camellia & Ornaments ============ */
function camelliaSVG(size, lit = 1) {
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  const on = Math.round(Math.max(0, Math.min(1, lit)) * angles.length);
  const petals = angles.map((a, i) =>
    `<ellipse cx="24" cy="11.5" rx="5.4" ry="10.4" transform="rotate(${a} 24 24)"
      fill="${i < on ? "#f7f1e6" : "none"}" stroke="#d4af37" stroke-width="${i < on ? 0 : 1}" opacity="${i < on ? 1 : .32}"/>`
  ).join("");
  const inner = [22, 112, 202, 292].map((a) =>
    `<ellipse cx="24" cy="15" rx="3.7" ry="7" fill="#e8c872" transform="rotate(${a} 24 24)" opacity="${on >= 6 ? 1 : .35}"/>`
  ).join("");
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">
    <g>${petals}</g><g>${inner}</g>
    <circle cx="24" cy="24" r="3.6" fill="#d4af37"/><circle cx="24" cy="24" r="1.5" fill="#8a6d2b"/></svg>`;
}

function paintCamellias() {
  document.querySelectorAll("[data-camellia]").forEach((el) => {
    el.innerHTML = JYH_CAMELLIA.svgMarkup(+el.dataset.camellia);
  });
}

function canCall() {
  return !!settings.apiKey && !!settings.apiKey.trim();
}

/* ============ Daily Bloom Reward ============ */
async function updateDailyReward() {
  const today = await JYH_STORE.getTodayStats();
  const drTitle = $("drTitle");
  const drStatus = $("drStatus");
  if (drTitle) drTitle.textContent = `Collected Today: ${today.count} words`;
  if (drStatus) drStatus.textContent = today.milestone;

  document.querySelectorAll(".dr-stage").forEach((el) => {
    const min = +el.dataset.min;
    el.classList.toggle("is-unlocked", today.count >= min);
  });
}

/* ============ Settings Storage ============ */
async function loadSettings() {
  try {
    const d = await chrome.storage.local.get(["settings", "openai_api_key_backup"]);
    const s = Object.assign({}, DEFAULT_CONFIG, d.settings || {});
    if (!s.apiKey && d.openai_api_key_backup) {
      s.apiKey = d.openai_api_key_backup;
      await chrome.storage.local.set({ settings: s });
    }
    return s;
  } catch (_) {
    return Object.assign({}, DEFAULT_CONFIG);
  }
}

function fillSettingsForm(s) {
  $("apiKey").value = s.apiKey || "";
  $("model").value = s.model || DEFAULT_CONFIG.model;
  $("hoverModel").value = s.hoverModel || "";
  $("baseUrl").value = s.baseUrl || DEFAULT_CONFIG.baseUrl;
  $("systemPrompt").value = s.systemPrompt || "";
}

async function onSave() {
  const apiKey = $("apiKey").value.trim();
  settings = {
    provider: "openai",
    apiKey,
    model: $("model").value.trim() || DEFAULT_CONFIG.model,
    hoverModel: $("hoverModel").value.trim() || DEFAULT_CONFIG.hoverModel,
    baseUrl: ($("baseUrl").value.trim() || DEFAULT_CONFIG.baseUrl).replace(/\/+$/, ""),
    systemPrompt: $("systemPrompt").value.trim(),
  };

  await chrome.storage.local.set({
    settings,
    openai_api_key_backup: apiKey,
  });

  $("saveHint").textContent = "✓ Settings Saved";
  setTimeout(() => ($("saveHint").textContent = ""), 2000);
  setTimeout(() => show("chat"), 600);
}

/* ============ View Navigation ============ */
function show(name, fresh = true) {
  Object.entries(VIEWS).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-on", t.dataset.view === name));
  if (name === "shelf") {
    renderShelf();
    renderCalendar();
  }
  if (name === "practice" && fresh) renderPracticeHome();
}

function bindEvents() {
  $("tabs").addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (t) show(t.dataset.view);
  });
  $("settingsBtn").addEventListener("click", () => show(VIEWS.settings.classList.contains("hidden") ? "settings" : "chat"));
  $("newChatBtn").addEventListener("click", newChat);
  $("studioBtn").addEventListener("click", () => chrome.runtime.sendMessage({ type: "OPEN_STUDY" }));
  $("pasteClose").addEventListener("click", closePasteModal);
  $("pasteOverlay").addEventListener("click", (e) => { if (e.target === $("pasteOverlay")) closePasteModal(); });
  $("pasteInput").addEventListener("input", () => { $("pasteGo").disabled = $("pasteInput").value.trim().length < 40; });
  $("pasteGo").addEventListener("click", submitPastedArticle);

  // 在 pasteInput 里选文字后，显示「Fill to Input」浮动按钮
  (function bindPasteSelectionFill() {
    const overlay = $("pasteOverlay");
    const pasteInput = $("pasteInput");
    let fillBtn = null;

    function removeFillBtn() {
      if (fillBtn) { fillBtn.remove(); fillBtn = null; }
    }

    function showFillBtn(sel, rect) {
      removeFillBtn();
      fillBtn = document.createElement("button");
      fillBtn.textContent = "Fill to Input ↗";
      fillBtn.style.cssText = `
        position:fixed; z-index:99999;
        background:linear-gradient(135deg,#e8c872,#c4a574); color:#100e0c;
        border:none; border-radius:999px; padding:5px 13px;
        font:700 11.5px -apple-system,sans-serif; letter-spacing:.05em;
        cursor:pointer; box-shadow:0 4px 14px rgba(212,175,55,.45);
        transition:transform .12s;
        left:${Math.min(rect.left + rect.width / 2 - 60, window.innerWidth - 160)}px;
        top:${rect.top - 40}px;
      `;
      fillBtn.addEventListener("mousedown", (e) => e.preventDefault());
      fillBtn.addEventListener("click", () => {
        const text = sel.trim();
        if (!text) return;
        removeFillBtn();
        closePasteModal();
        applyComposerText(text, { append: false });
        show("chat");
        $("input").focus();
      });
      document.body.appendChild(fillBtn);
    }

    pasteInput.addEventListener("mouseup", () => {
      setTimeout(() => {
        const start = pasteInput.selectionStart;
        const end = pasteInput.selectionEnd;
        if (typeof start === "number" && start < end) {
          const sel = pasteInput.value.slice(start, end).trim();
          if (sel.length >= 2) {
            const rect = pasteInput.getBoundingClientRect();
            showFillBtn(sel, rect);
            return;
          }
        }
        removeFillBtn();
      }, 10);
    });

    pasteInput.addEventListener("keyup", () => {
      const start = pasteInput.selectionStart;
      const end = pasteInput.selectionEnd;
      if (typeof start !== "number" || start >= end) removeFillBtn();
    });

    overlay.addEventListener("mousedown", (e) => {
      if (e.target !== fillBtn) removeFillBtn();
    });
    $("pasteClose").addEventListener("click", removeFillBtn, { passive: true });
  })();
  $("saveBtn").addEventListener("click", onSave);

  $("sendBtn").addEventListener("click", onSend);
  $("btnTenseAnalysis")?.addEventListener("click", sendTenseAnalysis);
  $("input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  });
  $("input").addEventListener("input", autoGrow);

  document.querySelectorAll(".quick .chip").forEach((c) =>
    c.addEventListener("click", () => quickAction(c.dataset.act))
  );

  $("backToFolders").addEventListener("click", backToWall);
  $("backToCards").addEventListener("click", () => (shelfState.tag ? openFolder(shelfState.tag) : backToWall()));
  $("exportBtn").addEventListener("click", doExport);
  $("exportCsvBtn")?.addEventListener("click", doExportCsv);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", doImport);

  $("startExam").addEventListener("click", () => startPractice("auto"));
  $("btnReviewDue")?.addEventListener("click", () => startPractice("due"));
  $("btnReviewAll")?.addEventListener("click", () => startPractice("all"));
  $("btnReviewHard")?.addEventListener("click", () => startPractice("hard"));

  // Calendar Heatmap Nav
  $("calPrevBtn")?.addEventListener("click", () => {
    calState.month -= 1;
    if (calState.month < 0) { calState.month = 11; calState.year -= 1; }
    renderCalendar();
  });
  $("calNextBtn")?.addEventListener("click", () => {
    calState.month += 1;
    if (calState.month > 11) { calState.month = 0; calState.year += 1; }
    renderCalendar();
  });
  $("calTodayBtn")?.addEventListener("click", () => {
    const now = new Date();
    calState.year = now.getFullYear();
    calState.month = now.getMonth();
    renderCalendar();
  });
}

function autoGrow() {
  const el = $("input");
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}

async function refreshBadges() {
  const s = await JYH_STORE.stats();
  $("dueDot").classList.toggle("hidden", s.due === 0);
}

/* ============ Studio Dialogue ============ */
const EXAM_RE = /^\s*(\/exam|quiz|test|exam|考我|考核|测试)\s*$/i;
const REVIEW_RE = /^\s*(\/review|review|srs|flashcards|复习|背单词)\s*$/i;

function shouldUseExplainMode(text) {
  if (EXAM_RE.test(text) || REVIEW_RE.test(text)) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const latinChars = (trimmed.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  const ratio = latinChars / trimmed.length;
  // Single word / short phrase lookup (e.g. prisée, digue, cabines de plage)
  if (words.length <= 4 && trimmed.length <= 40 && latinChars >= 2 && ratio >= 0.55) return true;
  if (trimmed.length < 6) return false;
  if (latinChars < 6) return false;
  // Subtitle / selected sentence: mostly Latin script → structured explain with word chips
  if (ratio >= 0.45) return true;
  // First turn with a clear foreign phrase
  return history.length === 0 && latinChars >= 8;
}

function onSend() {
  const val = $("input").value.trim();
  if (!val || streaming) return;

  if (EXAM_RE.test(val) || REVIEW_RE.test(val)) {
    $("input").value = "";
    autoGrow();
    return examFromChat();
  }

  $("input").value = "";
  autoGrow();
  send(val, shouldUseExplainMode(val) ? "explain" : "chat");
}

function quickAction(act) {
  if (act === "paste-article") return openPasteModal();
  if (act === "exam" || act === "review") return examFromChat();
  if (act === "studio") return chrome.runtime.sendMessage({ type: "OPEN_STUDY" });
  if (act === "summarize") return summarizePage();
  if (act === "save-page") return savePage();
}

function lastSourceSentence() {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role !== "user") continue;
    const text = (m.raw || m.content || "").trim();
    if (text && shouldUseExplainMode(text)) return text;
  }
  return "";
}

async function sendTenseAnalysis() {
  const sentence = lastSourceSentence();
  if (!sentence) {
    $("input").focus();
    return;
  }
  if (streaming) return;
  await send(sentence, "tense", "⏱ Tense analysis", { tenseSource: sentence });
}

function bindChatBubble(bubble) {
  bindSpeakers(bubble);
  bindWordSavers(bubble, async (meta, btn) => {
    try {
      JYH_CAMELLIA.flyToShelf(btn, $("shelfTab"), `"${meta.word}" saved to Vault`);
    } catch (_) {}

    const prevUser = bubble.previousElementSibling?.classList.contains("user")
      ? bubble.previousElementSibling.textContent.trim()
      : "";
    const example = prevUser || meta.word;

    await JYH_STORE.addLookup({
      en: meta.word,
      ipa: meta.ipa,
      zh: meta.zh,
      sense: meta.sense,
      pos: meta.pos,
      example,
      tags: ["Saved Words"],
    });

    await refreshBadges();
    await updateDailyReward();
  });
  bindWordExamples(bubble, async (meta) => {
    if (streaming) return;
    const ctx = lastSourceSentence() || meta.word;
    await send(meta.word, "word-example", `例句 · ${meta.word}`, {
      wordExample: { word: meta.word, ipa: meta.ipa, context: ctx },
    });
  });
}

async function send(content, mode, displayText, opts = {}) {
  if (!canCall()) return needKey();
  hideEmpty();
  const turn = { role: "user", content };
  if (mode === "explain") turn.raw = content;
  history.push(turn);
  addBubble("user", displayText || content);

  const bubble = addBubble("ai", "");
  bubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  streaming = true;
  $("sendBtn").disabled = true;

  const rawFirst = mode === "explain" ? content : null;
  let full = "";
  await streamViaPort(mode, history, {
    rawFirst,
    tenseSource: opts.tenseSource,
    wordExample: opts.wordExample,
    onChunk: (t) => { full += t; bubble.innerHTML = md(full); bindChatBubble(bubble); scrollToBottom(); },
    onNeedKey: () => { bubble.parentElement?.remove(); needKey(); },
    onError: (m) => { bubble.innerHTML = `<div class="error-note">${esc(m)}</div>`; },
  });

  bindChatBubble(bubble);
  if (full.trim()) history.push({ role: "assistant", content: full });
  else history.pop();
  streaming = false;
  $("sendBtn").disabled = false;
  $("input").focus();
  maybeOfferSaveChat(mode);
}

function needKey() {
  hideEmpty();
  addBubble("ai", `<div class="error-note">OpenAI API Key is missing. Please click Settings (top right) to enter your Key.</div>`);
  show("settings");
}

function addBubble(role, html) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.innerHTML = typeof html === "string" ? html : "";
  $("messages").appendChild(el);
  scrollToBottom();
  return el;
}

let chatSavedCardId = null;
function maybeOfferSaveChat(mode) {
  if (chatSavedCardId || mode !== "explain" || history.length < 2) return;
  $("saveChatBar")?.remove();
  const bar = document.createElement("div");
  bar.id = "saveChatBar";
  bar.className = "save-chat-bar";
  bar.innerHTML = `<span class="scb-hint">✨ Analysis complete. Save to Vault?</span>
    <button class="scb-btn" id="scbSave">Save to Vault</button>`;
  $("messages").appendChild(bar);
  scrollToBottom();

  bar.querySelector("#scbSave").addEventListener("click", async () => {
    const btn = bar.querySelector("#scbSave");
    btn.disabled = true;
    btn.textContent = "Analyzing & Saving…";
    const userText = history[0]?.content || "";
    const res = await chrome.runtime.sendMessage({
      type: "AI_JSON",
      task: "study",
      payload: { text: userText, existingTags: await JYH_STORE.allTags() },
    });
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = "Save to Vault";
      alert("Save failed: " + res.error);
      return;
    }
    const d = res.data;
    const card = await JYH_STORE.addCard({
      title: d.title, summary: d.summary, tags: d.tags,
      words: d.words, concepts: d.concepts,
      bilingual: d.bilingual, grammar: d.grammar, cloze: d.cloze,
      inflect: d.inflect, translate: d.translate, makeup: d.makeup,
      excerpt: userText,
    });
    chatSavedCardId = card.id;

    JYH_CAMELLIA.flyToShelf(btn, $("shelfTab"), "Saved to Vault");

    bar.innerHTML = `<span class="scb-done">✓ Saved to Vault (${card.words.length} words)</span>
      <button class="scb-link" id="scbOpen">View Scroll</button>`;
    bar.querySelector("#scbOpen")?.addEventListener("click", () => {
      show("shelf");
      openCard(card.id);
    });
    await refreshBadges();
    await updateDailyReward();
  });
}

function streamViaPort(mode, msgs, { rawFirst, tenseSource, wordExample, onChunk, onNeedKey, onError }) {
  return streamChatDirect(mode, msgs, { rawFirst, tenseSource, wordExample, onChunk, onNeedKey, onError });
}

async function streamChatDirect(mode, msgs, { rawFirst, tenseSource, wordExample, onChunk, onNeedKey, onError }, retry = 0) {
  if (!canCall()) { onNeedKey?.(); return; }

  let received = "";
  const cfg = JYH_STREAM.resolveCfg(settings);

  try {
    const explainLang = await JYH_STORE.getLang();
    const prepared = JYH_STREAM.prepareExplain({
      mode,
      messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      rawFirst,
      tenseSource,
      wordExample,
      extra: cfg.extra,
      lang: explainLang,
    });

    await JYH_STREAM.streamOpenAI(
      cfg,
      JYH_STREAM.withModelName(prepared.system, cfg),
      prepared.messages,
      (chunk) => {
        received += chunk;
        onChunk?.(chunk);
      }
    );
  } catch (err) {
    const msg = err?.message || String(err);
    if (!received.trim() && retry < 1 && /timed out|network|fetch|failed/i.test(msg)) {
      await streamChatDirect(mode, msgs, { rawFirst, tenseSource, wordExample, onChunk, onNeedKey, onError }, retry + 1);
      return;
    }
    if (!received.trim()) onError?.(msg);
  }
}

async function summarizePage() {
  if (!canCall()) return needKey();
  hideEmpty();
  addBubble("user", "Digest Page Core");
  const b = addBubble("ai", '<div class="typing"><span></span><span></span><span></span></div>');
  const page = await chrome.runtime.sendMessage({ type: "PAGE_TEXT" });
  if (!page.ok) { b.innerHTML = `<div class="error-note">${esc(page.error)}</div>`; return; }
  const res = await chrome.runtime.sendMessage({ type: "AI_JSON", task: "summarize", payload: { text: page.text } });
  b.innerHTML = res.ok ? md(`**${page.pageTitle || "Current Page"}**\n\n${res.data}`) : `<div class="error-note">${esc(res.error)}</div>`;
  if (res.ok) bindChatBubble(b);
}

function openPasteModal() {
  $("pasteOverlay").classList.remove("hidden");
  $("pasteInput").value = "";
  $("pasteGo").disabled = true;
  $("pasteGo").textContent = "Import to Vault";
  setTimeout(() => $("pasteInput").focus(), 50);
}
function closePasteModal() { $("pasteOverlay").classList.add("hidden"); }

async function submitPastedArticle() {
  const text = $("pasteInput").value.trim();
  if (text.length < 40) return;
  $("pasteGo").disabled = true;
  $("pasteGo").textContent = "Analyzing & Extracting…";
  if (!canCall()) { closePasteModal(); return needKey(); }

  closePasteModal();
  hideEmpty();
  addBubble("user", "Import Long Article");
  const b = addBubble("ai", '<div class="typing"><span></span><span></span><span></span></div>');
  const existingTags = await JYH_STORE.allTags();
  const res = await chrome.runtime.sendMessage({ type: "AI_JSON", task: "study", payload: { text, existingTags } });
  if (!res.ok) { b.innerHTML = `<div class="error-note">${esc(res.error)}</div>`; return; }

  const d = res.data;
  const c = await JYH_STORE.addCard({
    title: d.title, summary: d.summary, tags: d.tags,
    words: d.words, concepts: d.concepts,
    bilingual: d.bilingual, grammar: d.grammar, cloze: d.cloze,
    inflect: d.inflect, translate: d.translate, makeup: d.makeup,
    excerpt: text,
  });

  JYH_CAMELLIA.flyToShelf(null, $("shelfTab"), "Article saved to Vault");

  b.innerHTML = `<p><strong>${esc(c.title)}</strong> saved to Vault.</p>
    <p style="color:var(--text-dim);font-size:12.5px">${esc(c.summary)}</p>
    <div style="margin-top:8px">${c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ")}</div>`;
  await refreshBadges();
  await updateDailyReward();
}

async function savePage() {
  if (!canCall()) return needKey();
  hideEmpty();
  addBubble("user", "Save Entire Page");
  const b = addBubble("ai", '<div class="typing"><span></span><span></span><span></span></div>');
  const page = await chrome.runtime.sendMessage({ type: "PAGE_TEXT" });
  if (!page.ok) { b.innerHTML = `<div class="error-note">${esc(page.error)}</div>`; return; }
  const existingTags = await JYH_STORE.allTags();
  const res = await chrome.runtime.sendMessage({ type: "AI_JSON", task: "study", payload: { text: page.text, existingTags } });
  if (!res.ok) { b.innerHTML = `<div class="error-note">${esc(res.error)}</div>`; return; }
  const d = res.data;
  const c = await JYH_STORE.addCard({
    title: d.title, summary: d.summary, tags: d.tags,
    words: d.words, concepts: d.concepts,
    bilingual: d.bilingual, grammar: d.grammar, cloze: d.cloze,
    inflect: d.inflect, translate: d.translate, makeup: d.makeup,
    excerpt: page.text,
    url: page.url, pageTitle: page.pageTitle,
  });

  JYH_CAMELLIA.flyToShelf(null, $("shelfTab"), "Page saved to Vault");

  b.innerHTML = `<p><strong>${esc(c.title)}</strong> saved to Vault.</p>
    <p style="color:var(--text-dim);font-size:12.5px">${esc(c.summary)}</p>
    <div style="margin-top:8px">${c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ")}</div>`;
  await refreshBadges();
  await updateDailyReward();
}

function newChat() {
  history = [];
  chatSavedCardId = null;
  const empty = $("emptyState");
  $("saveChatBar")?.remove();
  [...$("messages").children].forEach((c) => { if (c !== empty) c.remove(); });
  if (empty) {
    empty.style.display = "";
    $("messages").appendChild(empty);
    paintOrnaments();
  }
  show("chat");
}
function hideEmpty() { const e = $("emptyState"); if (e) e.style.display = "none"; }
function scrollToBottom() { $("messages").scrollTop = $("messages").scrollHeight; }

/* ============ Vault & Heatmap ============ */
const shelfState = { tag: null, cardId: null };

function swapShelf(which) {
  $("shelfRoot").classList.toggle("hidden", which !== "root");
  $("shelfCards").classList.toggle("hidden", which !== "cards");
  $("shelfDetail").classList.toggle("hidden", which !== "detail");
}

function backToWall() {
  shelfState.tag = null;
  renderShelf();
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmtDate = (ts) => {
  const d = new Date(ts);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
};
const fmtDay = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

async function renderShelf() {
  const s = await JYH_STORE.stats();
  $("wallStats").innerHTML = [
    [s.cards, "Scrolls"], [s.folders, "Realms"], [s.words, "Words"], [s.mastered, "Mastered"],
  ].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");

  const folders = await JYH_STORE.folders();
  $("shelfSub").textContent = folders.length
    ? "Knowledge realms are auto-organized by topic tags. Each realm has its dedicated Ebbinghaus curve."
    : "Select words on pages or video subtitles to populate your knowledge realms.";

  // Vocabulary Ledger Stream
  const ledger = await JYH_STORE.ledgerAll();
  const lang = await JYH_STORE.getLang();
  const ledgerRows = ledger.filter((w) => w.lang === lang).slice(0, 40);
  const ledgerEl = $("ledgerList");
  if (ledgerEl) {
    ledgerEl.innerHTML = ledgerRows.length
      ? ledgerRows.map((w) => `
          <div class="ledger-row">
            <span class="ld-date">${fmtDate(w.addedAt)}</span>
            <span class="ld-cat">${esc(w.category || "Lookups")}</span>
            <span class="en">${esc(w.en)}</span>
            <span class="zh">${esc(w.zh || w.sense || "")}</span>
          </div>`).join("")
      : `<div class="hint" style="text-align:center;padding:12px;">Vault is ready. Looked up or saved words will stream here.</div>`;
  }

  // Realms Folder Grid
  if (folders.length) {
    $("folders").innerHTML = folders.map((f) => {
      const ratio = f.words ? f.mastered / f.words : 0;
      const pct = Math.round(ratio * 100);
      return `<button class="folder" data-tag="${esc(f.tag)}">
        <span class="bloom">${camelliaSVG(30, ratio)}</span>
        <div class="f-tag">${esc(f.tag)}</div>
        <div class="f-meta">${f.cards} scrolls · ${f.words} words · ${pct}% mastered</div>
        <div class="f-bar"><i style="width:${pct}%"></i></div>
      </button>`;
    }).join("");

    $("folders").querySelectorAll(".folder").forEach((b) =>
      b.addEventListener("click", () => openFolder(b.dataset.tag))
    );
  } else {
    $("folders").innerHTML = "";
  }

  swapShelf("root");
  paintOrnaments();
}

async function renderCalendar() {
  const grid = $("calGrid");
  if (!grid) return;
  const { year, month, startWeekday, daysInMonth, dayCounts, totalMonthWords, activeDays } =
    await JYH_STORE.getMonthHeatmap(calState.year, calState.month);

  const titleEl = $("calMonthTitle");
  if (titleEl) titleEl.textContent = `${MONTH_NAMES[month]} ${year} · Study Heatmap`;

  const statsEl = $("calMonthStats");
  if (statsEl) statsEl.textContent = `${totalMonthWords} words logged · ${activeDays} active days this month`;

  let html = "";
  for (let i = 0; i < startWeekday; i++) {
    html += `<div class="cal-cell is-empty"></div>`;
  }

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
  const todayDate = now.getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const count = dayCounts[d] || 0;
    let lvl = "lvl-0";
    if (count >= 7) lvl = "lvl-3";
    else if (count >= 3) lvl = "lvl-2";
    else if (count >= 1) lvl = "lvl-1";

    const isToday = isCurrentMonth && d === todayDate ? "is-today" : "";
    const tip = `${MONTH_SHORT[month]} ${d} · ${count} words`;
    html += `<div class="cal-cell ${lvl} ${isToday}" title="${tip}"><span>${d}</span></div>`;
  }

  grid.innerHTML = html;
}

async function openFolder(tag) {
  shelfState.tag = tag;
  const cards = await JYH_STORE.listCards(tag);
  $("folderTitle").textContent = `Realm · ${tag}`;
  $("cards").innerHTML = cards.map((c) => `
    <div class="card-row" data-id="${c.id}">
      <div class="c-title">${esc(c.title)}</div>
      <div class="c-sum">${esc(c.summary)}</div>
      <div class="c-meta">
        ${(c.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
        <span>${(c.words || []).length} words</span><span>${fmtDate(c.ts)}</span>
      </div>
    </div>`).join("");
  $("cards").querySelectorAll(".card-row").forEach((r) =>
    r.addEventListener("click", () => openCard(r.dataset.id))
  );
  swapShelf("cards");
}

async function openCard(id) {
  const c = await JYH_STORE.getCard(id);
  if (!c) return backToWall();
  shelfState.cardId = id;

  const words = (c.words || []).map((w) => `
    <div class="word-row">
      <div class="word-top">
        <span class="en">${esc(w.en)}</span>
        ${w.ipa ? `<span class="ipa">${esc(w.ipa)}</span>` : ""}
        <button class="spk" data-t="${esc(w.en)}" title="Pronounce">🔊</button>
        <span class="lvl">${levelLabel(w.srs)}</span>
      </div>
      <div class="word-zh">${esc(w.zh)}${w.sense ? ` · ${esc(w.sense)}` : ""}</div>
      ${w.example ? `<div class="word-ex">${highlight(w.example, w.en)}</div>` : ""}
      ${w.addedAt ? `<div class="word-date" style="font-size:10px;color:var(--text-faint);margin-top:2px;">Saved on ${fmtDay(w.addedAt)}</div>` : ""}
    </div>`).join("");

  const concepts = (c.concepts || []).map((k) => `
    <div class="concept">
      <div><span class="k-name">${esc(k.name)}</span><span class="k-en">${esc(k.en || "")}</span></div>
      <div class="k-ex">${esc(k.explain || "")}</div>
      ${k.why ? `<div class="k-why">Context: ${esc(k.why)}</div>` : ""}
    </div>`).join("");

  $("detail").innerHTML = `
    <div class="detail-title">${esc(c.title)}</div>
    <div class="detail-sum">${esc(c.summary)}</div>
    <div class="detail-src">${c.source?.url ? `<a href="${esc(c.source.url)}" target="_blank" rel="noreferrer">${esc(c.source.pageTitle || c.source.url)}</a>` : ""}
      <span style="color:var(--text-faint)"> · ${fmtDate(c.ts)}</span></div>
    ${(c.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join(" ")}
    ${words ? `<div class="sub-h">Vocabulary List</div>${words}` : ""}
    ${concepts ? `<div class="sub-h">Core Concepts & Insights</div>${concepts}` : ""}
    <div class="detail-actions">
      <button class="primary-btn" id="openStudio">Open in Full Studio</button>
      <button class="danger-btn" id="delCard">Remove from Vault</button>
    </div>`;

  bindSpeakers($("detail"));
  $("openStudio").addEventListener("click", () => chrome.runtime.sendMessage({ type: "OPEN_STUDY", cardId: id }));
  $("delCard").addEventListener("click", async () => {
    await JYH_STORE.deleteCard(id);
    await refreshBadges();
    await updateDailyReward();
    const remaining = shelfState.tag ? await JYH_STORE.listCards(shelfState.tag) : [];
    remaining.length ? openFolder(shelfState.tag) : backToWall();
  });
  swapShelf("detail");
}

const levelLabel = (srs) => {
  if (JYH_STORE.isMastered(srs)) return "Mastered";
  if (!srs || srs.seen === 0) return "New";
  return JYH_STORE.humanInterval(srs);
};

function highlight(sentence, word) {
  const safe = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return esc(sentence).replace(new RegExp(`(${safe})`, "i"), "<mark>$1</mark>");
}

async function doExport() {
  const json = await JYH_STORE.exportJSON();
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `fluentloop-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function doExportCsv() {
  const csv = await JYH_STORE.exportCSV();
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `fluentloop-vocabulary-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function doImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const n = await JYH_STORE.importJSON(text);
    JYH_CAMELLIA.celebrateMilestone("Backup Restored", `Successfully restored ${n} scrolls!`);
    renderShelf();
    renderCalendar();
    refreshBadges();
    updateDailyReward();
  } catch (err) {
    alert("Import failed: " + err.message);
  }
  e.target.value = "";
}

/* ============ Practice Arena (SM-2 & Quiz) ============ */
async function renderPracticeHome() {
  JYH_PRACTICE_KEYS.cleanup();
  $("practiceHome").classList.remove("hidden");
  $("examRoot").classList.add("hidden");
  $("reviewRoot").classList.add("hidden");

  const s = await JYH_STORE.stats();
  const folders = await JYH_STORE.folders();
  $("practiceSub").textContent = s.words
    ? `Vault currently holds ${s.words} words. ${s.due} words due for spaced review today.`
    : "Lookup or save words on any webpage to build your practice queue.";

  const cur = $("scope").value;
  $("scope").innerHTML = [`<option value="">All Realms (${s.words} words)</option>`]
    .concat(folders.map((f) => `<option value="${esc(f.tag)}">${esc(f.tag)} (${f.words} words)</option>`)).join("");
  if (cur) $("scope").value = cur;

  $("dueCount").textContent = s.due ? `· ${s.due}` : "";
  $("startExam").disabled = !s.words;
  $("practiceHint").textContent = s.due
    ? `${s.due} words due — practice shows each word, you pick the meaning (simple words skipped).`
    : "Nothing due today. Practice All Words anytime; answers still update the forgetting curve.";
  await refreshBadges();
}

let lastPracticeMode = "auto";

async function startPractice(mode = "auto") {
  lastPracticeMode = mode;
  $("input")?.blur();
  const scope = $("scope").value;
  const quizSource = $("quizSource")?.value || "local";
  let quizType = $("quizType")?.value || "cloze";
  if (quizType === "mixed" || quizType === "sense" || quizType === "cloze") quizType = "mixed";
  const words = await JYH_STORE.reviewWords(scope, mode);
  if (!words.length) {
    $("practiceHint").textContent = mode === "due"
      ? "No words due today. Try All Words."
      : "No words in this realm yet. Save a few from subtitles first.";
    return;
  }

  $("practiceHome").classList.add("hidden");
  $("reviewRoot").classList.add("hidden");
  $("examRoot").classList.remove("hidden");

  const root = $("examRoot");
  root.innerHTML = `<div class="typing" style="padding:40px;justify-content:center"><span></span><span></span><span></span></div><p class="hint" style="text-align:center;margin-top:12px">Building ${words.length} word questions…</p>`;

  const queue = words.filter((w) => {
    const head = JYH_QUIZ.cleanEn(w.en);
    if (typeof JYH_EN !== "undefined" && JYH_EN.isSimpleWord(head)) return false;
    return !!JYH_QUIZ.meaningOf(w);
  });
  if (!queue.length) {
    root.innerHTML = `<div class="error-note">No practice-ready words yet. Save words with meanings from subtitles or web pages — simple words like "big/the" are skipped automatically.</div>
      <button class="ghost-btn" id="examBack" style="margin-top:14px">Back to Practice</button>`;
    root.querySelector("#examBack").addEventListener("click", renderPracticeHome);
    return;
  }
  const cards = await JYH_STORE.listCards(scope);
  const lang = await JYH_STORE.getLang();
  const avoid = await JYH_QUIZ.recentWords();
  let questions = [];

  if (quizSource === "ai" && canCall() && queue.length <= 30) {
    try {
      const res = await chrome.runtime.sendMessage({
        type: "AI_JSON",
        task: "quiz",
        payload: { cards: cards.slice(0, 20), count: queue.length, avoid: [...avoid] },
      });
      if (res.ok && Array.isArray(res.data?.questions)) {
        questions = JYH_QUIZ.sanitizeQuizList(res.data.questions).map((q) => {
          const hit = queue.find((w) => (w.en || "").toLowerCase() === String(q.en || q.answer || "").toLowerCase().trim());
          return hit ? { ...q, cardId: hit.cardId, en: hit.en } : q;
        });
      }
    } catch (_) {}
  }

  if (!questions.length) {
    questions = JYH_QUIZ.localQuiz(queue, [], cards, queue.length, avoid, quizType, lang);
  }

  if (!questions.length) {
    root.innerHTML = `<div class="error-note">Not enough words with meanings yet. Save a few more from subtitles, then try again.</div>
      <button class="ghost-btn" id="examBack" style="margin-top:14px">Back to Practice</button>`;
    root.querySelector("#examBack").addEventListener("click", renderPracticeHome);
    return;
  }

  await JYH_QUIZ.rememberWords(questions);
  renderExamQuestion(questions, 0, []);
}

async function startReview(mode = "auto") { return startPractice(mode); }
async function startExam() { return startPractice(lastPracticeMode || "auto"); }

function renderExamQuestion(questions, idx, answers) {
  JYH_PRACTICE_KEYS.cleanup();
  const root = $("examRoot");
  if (idx >= questions.length) {
    renderExamResult(questions, answers);
    return;
  }

  const q = questions[idx];
  if (!JYH_QUIZ.isValidWordQuestion?.(q)) {
    renderExamQuestion(questions, idx + 1, answers);
    return;
  }
  const typeLabel = "Word meaning";
  const choices = Array.isArray(q.choices) ? q.choices : (Array.isArray(q.options) ? q.options : []);
  const isInput = false;
  let examAnswered = false;
  let graded = false;

  const speakText = JYH_QUIZ.cleanEn(q.prompt || q.en || "");
  const contextHtml = q.context
    ? `<div class="exam-context">
        <div class="exam-context-label">Context · 语境</div>
        <div class="exam-context-sent">${esc(q.context).replace(/___/g, '<span class="exam-blank">___</span>')}</div>
      </div>`
    : "";

  const controlsHtml = `<p class="exam-meaning-prompt">Choose the meaning · 选择释义</p>
    <div class="exam-options">
      ${choices.map((opt, i) => `
        <button class="opt-btn" data-opt="${esc(opt)}" data-i="${i}">
          <span class="opt-idx">${["A","B","C","D"][i] || i+1}</span>
          <span class="opt-text">${esc(opt)}</span>
        </button>`).join("")}
    </div>`;

  root.innerHTML = `
    <div class="exam-card" tabindex="-1">
      <div class="exam-prog">Question ${idx + 1} of ${questions.length} · ${typeLabel}</div>
      <div class="exam-word-head">
        <div class="exam-prompt-word">${esc(q.prompt)}</div>
        ${q.ipa ? `<div class="srs-ipa">${esc(q.ipa)} <button class="spk" data-t="${esc(speakText)}" title="Pronounce">🔊</button></div>` : `<div class="exam-word-speak"><button class="spk" data-t="${esc(speakText)}" title="Pronounce">🔊</button></div>`}
      </div>
      ${controlsHtml}
      ${contextHtml}
      <div id="examFeedback" class="exam-feedback hidden"></div>
      <button class="primary-btn exam-next-btn hidden" id="examNext">Next Question →</button>
      <button class="srs-remove" id="examRemove"><kbd>0</kbd> Too Easy · Remove from Vault</button>
      <div class="key-hint" id="examKeyHint">${JYH_PRACTICE_KEYS.HINT_EXAM_CHOICE}</div>
    </div>`;

  bindSpeakers(root);
  $("input")?.blur();
  setTimeout(() => root.querySelector(".exam-card")?.focus(), 40);

  const fbEl = root.querySelector("#examFeedback");
  const nextBtn = root.querySelector("#examNext");
  const hintEl = root.querySelector("#examKeyHint");

  const goNext = () => renderExamQuestion(questions, idx + 1, answers);

  const gradeSrs = async (correct) => {
    if (graded || !q.cardId || !q.en) return;
    graded = true;
    await JYH_STORE.gradeWord(q.cardId, q.en, correct ? JYH_STORE.Q.GOOD : JYH_STORE.Q.FORGOT);
  };

  const showResult = (correct, chosenText) => {
    examAnswered = true;
    answers.push({ question: q, chosen: chosenText, correct });
    gradeSrs(correct);
    fbEl.classList.remove("hidden");
    fbEl.classList.toggle("fb-correct", correct);
    fbEl.classList.toggle("fb-wrong", !correct);

    const ansDisplay = String(q.answer);
    fbEl.innerHTML = correct
      ? `<div><b>✓ Correct!</b> ${esc(ansDisplay)}</div>` + (q.explain ? `<div style="margin-top:4px;color:var(--text-dim)">💡 ${esc(q.explain)}</div>` : "")
      : `<div><b>✗</b> Answer: <b>${esc(ansDisplay)}</b></div>` + (q.explain ? `<div style="margin-top:4px;color:var(--text-dim)">💡 ${esc(q.explain)}</div>` : "");

    nextBtn.classList.remove("hidden");
    nextBtn.onclick = goNext;
    if (hintEl) hintEl.textContent = JYH_PRACTICE_KEYS.HINT_EXAM_NEXT;

    if (correct) {
      setTimeout(() => {
        if (!nextBtn.classList.contains("hidden")) goNext();
      }, 1100);
    }
  };

  const removeWord = async () => {
    if (q.cardId && q.en) await JYH_STORE.removeWord(q.cardId, q.en);
    goNext();
  };

  const pickChoice = (i) => {
    if (examAnswered) return;
    const btn = root.querySelectorAll(".opt-btn")[i];
    if (!btn) return;
    btn.classList.add("kb-focus");
    btn.click();
  };

  JYH_PRACTICE_KEYS.bindExam({
    answered: () => examAnswered,
    isInput: () => false,
    choiceCount: () => choices.length,
    onChoice: pickChoice,
    onNext: () => nextBtn?.click(),
    onRemove: removeWord,
    onExit: renderPracticeHome,
  });

  root.querySelector("#examRemove")?.addEventListener("click", removeWord);

  root.querySelectorAll(".opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (examAnswered) return;
        examAnswered = true;
        const chosen = btn.dataset.opt;
        const target = String(q.answer).trim();
        const correct = chosen.toLowerCase().trim() === target.toLowerCase().trim();
        btn.classList.add(correct ? "opt-correct" : "opt-wrong");
        if (!correct) {
          root.querySelectorAll(".opt-btn").forEach((b) => {
            if (b.dataset.opt.toLowerCase().trim() === target.toLowerCase().trim()) b.classList.add("opt-correct");
          });
        }
        showResult(correct, chosen);
      });
    });
}

function renderExamResult(questions, answers) {
  JYH_PRACTICE_KEYS.cleanup();
  const root = $("examRoot");
  const scored = answers.filter((a) => typeof a.correct === "boolean");
  const correctCount = scored.filter((a) => a.correct).length;
  const total = questions.length;
  root.innerHTML = `
    <div class="result-card">
      <div class="result-h">Practice complete</div>
      <p class="result-p">${correctCount} / ${total} correct · SM-2 intervals updated</p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
        <button class="primary-btn" id="examAgain">Practice again</button>
        <button class="ghost-btn" id="examDone">Back</button>
      </div>
    </div>`;
  root.querySelector("#examAgain").addEventListener("click", () => startPractice(lastPracticeMode));
  root.querySelector("#examDone").addEventListener("click", renderPracticeHome);
}

function examFromChat() {
  show("practice", false);
  startPractice("auto");
}
