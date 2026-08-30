// content.js — 划词浮标、内联解释气泡、发音、收藏进书架。
// 默认给出深度语境与精准释义；支持科技/AI、商业财经、专有名词与输入框划词。

(function () {
  if (window.__jieyuhuaInjected) return;
  window.__jieyuhuaInjected = true;

  /* ---------- 山茶花徽标 ---------- */
  function camellia(size) {
    return JYH_CAMELLIA.svgMarkup(size);
  }

  try { JYH_CAMELLIA.applyCursor(document); } catch (_) {}

  function mountHTML(root, str) {
    const doc = new DOMParser().parseFromString(str, "text/html");
    root.replaceChildren(...[...doc.head.childNodes, ...doc.body.childNodes]);
  }

  const { render: md, speak, esc, bindSpeakers, bindWordSavers, bindWordExamples } = JYH_MD;

  let activeLang = "en";
  try {
    chrome.storage?.local.get("activeLang", (d) => {
      if (d?.activeLang) {
        activeLang = d.activeLang;
        JYH_MD.setSpeakLang(activeLang);
        updateTenseBtn();
      }
    });
    chrome.storage?.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.activeLang) {
        activeLang = changes.activeLang.newValue || "en";
        JYH_MD.setSpeakLang(activeLang);
        updateTenseBtn();
      }
    });
  } catch (_) {}

  /* ---------- Shadow DOM ---------- */
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0;";
  const shadow = host.attachShadow({ mode: "open" });
  mountHTML(shadow, `
    <style>
      :host{ all:initial; }
      .flower{
        all:unset; position:fixed; display:none; place-items:center;
        width:32px; height:32px; border-radius:50%;
        background:#15110d;
        box-shadow:0 4px 18px rgba(0,0,0,.5), inset 0 0 0 1px rgba(212,175,55,.6);
        cursor:pointer; transform-origin:center;
        animation:bloom .28s cubic-bezier(.34,1.5,.64,1);
      }
      .flower:hover{ box-shadow:0 6px 24px rgba(0,0,0,.6), inset 0 0 0 1px rgba(212,175,55,.9); transform:scale(1.08); }
      .flower:active{ transform:scale(.92); }
      .sel-dock{
        all:initial; position:fixed; display:none; align-items:center; gap:6px;
        background:linear-gradient(135deg, rgba(22,18,14,0.95), rgba(14,11,8,0.98)); color:#f7f1e6;
        border-radius:999px; padding:4px 8px 4px 4px;
        box-shadow:0 12px 36px rgba(0,0,0,.6), inset 0 0 0 1px rgba(212,175,55,.45);
        font:11px/1.4 -apple-system,"SF Pro Display","Inter","Segoe UI",sans-serif;
        backdrop-filter:blur(16px); pointer-events:auto;
        animation:bloom .28s cubic-bezier(.34,1.5,.64,1);
      }
      .sel-btn{
        all:unset; cursor:pointer; display:grid; place-items:center;
        width:28px; height:28px; border-radius:50%;
        background:#15110d; box-shadow:inset 0 0 0 1px rgba(212,175,55,.45);
        transition:all .15s;
      }
      .sel-btn:hover{ transform:scale(1.08); box-shadow:inset 0 0 0 1px rgba(212,175,55,.85); }
      .sel-fill{
        all:unset; cursor:pointer; font-size:10.5px; letter-spacing:.05em; font-weight:700;
        color:#100e0c; background:linear-gradient(135deg,#e8c872,#c4a574); border-radius:999px;
        padding:5px 10px; white-space:nowrap;
        box-shadow:0 2px 10px rgba(212,175,55,0.35);
      }
      .sel-fill:hover{ filter:brightness(1.08); transform:scale(1.04); }
      @keyframes bloom{ from{ transform:scale(.3) rotate(-30deg); opacity:0; } to{ transform:scale(1) rotate(0); opacity:1; } }

      .card{
        all:initial; position:fixed; display:none; width:356px; max-width:92vw;
        background:linear-gradient(145deg, rgba(22, 18, 14, 0.98), rgba(14, 11, 8, 0.98));
        color:#f7f1e6; border-radius:18px;
        box-shadow:0 24px 70px rgba(0,0,0,.65), 0 0 24px rgba(212,175,55,0.18), inset 0 0 0 1px rgba(212,175,55,.35);
        font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter","Segoe UI",sans-serif;
        font-size:13.5px; line-height:1.6; overflow:hidden;
        animation:pop .24s cubic-bezier(.34,1.5,.64,1);
        backdrop-filter:blur(16px);
      }
      @keyframes pop{ from{ transform:translateY(8px) scale(.95); opacity:0; } to{ transform:none; opacity:1; } }
      .head{ display:flex; align-items:center; gap:8px; padding:12px 15px 7px; }
      .head .name{ font-family:-apple-system,sans-serif; font-weight:700; font-size:13px; letter-spacing:.2em; color:#f7f1e6; text-transform:uppercase; flex:1; }
      .head .x{ all:unset; cursor:pointer; color:#8a7c66; font-size:18px; line-height:1; padding:2px 6px; border-radius:7px; transition:all .15s; }
      .head .x:hover{ background:rgba(212,175,55,.18); color:#f7f1e6; }
      .gold-line{ height:1px; margin:0 15px 8px; background:linear-gradient(90deg,transparent,#d4af37 35%,#e8c872 65%,transparent); opacity:.75; }
      .body{ max-height:44vh; overflow-y:auto; padding:2px 15px 10px; }
      .body::-webkit-scrollbar{ width:5px; } .body::-webkit-scrollbar-thumb{ background:rgba(196,165,116,.25); border-radius:4px; }

      .quote{ font-size:12px; color:#c7b89f; background:#1a1612; border-radius:10px; padding:7px 10px; margin:4px 0 11px;
              border:1px solid rgba(196,165,116,0.18);
              display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      .ask-line{ font-size:13px; color:#e8c872; margin:13px 0 4px; font-weight:600; font-family:-apple-system,sans-serif; }
      .ans :where(p,ul,ol){ margin:.42em 0; } .ans :where(p,ul,ol):first-child{ margin-top:0; }
      .ans strong{ color:#ffffff; font-weight:600; }
      .ans code{ background:#1a1612; padding:1px 5px; border-radius:5px; font-size:12px; color:#e8c872; border:1px solid rgba(196,165,116,0.2); }

      .w{ display:inline-flex; align-items:baseline; gap:5px; background:#1b1713; border-radius:8px; padding:1px 6px 1px 7px; margin:1px 0; border:1px solid rgba(196,165,116,0.22); transition:all .15s; }
      .w:hover{ border-color:rgba(212,175,55,0.55); }
      .w b{ font-weight:600; color:#f7f1e6; }
      .w i{ font-style:normal; color:#d4af37; font-size:12px; font-family:"Charis SIL","Doulos SIL",Georgia,serif; }
      .w .pos{ font-style:normal; font-size:10.5px; color:#e8c872; background:rgba(212,175,55,0.15); border-radius:4px; padding:0 4px; font-weight:600; }
      .spk, .btn-save-word, .btn-word-ex{
        all:unset; cursor:pointer; display:inline-grid; place-items:center;
        width:22px; height:22px; border-radius:6px; color:#d4af37;
        background:transparent; border:1px solid rgba(196,165,116,0.28);
        transition:all .15s; flex-shrink:0;
      }
      .spk:hover, .btn-save-word:hover, .btn-word-ex:hover{ background:rgba(212,175,55,.2); border-color:rgba(212,175,55,.6); color:#fff; transform:scale(1.08); }
      .btn-save-word.is-saved{ color:#6abf69; border-color:rgba(106,191,105,.45); cursor:default; transform:none; }
      .spk svg, .btn-save-word svg{ display:block; pointer-events:none; }

      .err{ color:#c45c5c; font-size:13px; line-height:1.6; }
      .err .act-btn{ all:unset; cursor:pointer; color:#100e0c; background:linear-gradient(135deg,#e8c872,#c4a574);
                     border-radius:8px; padding:4px 12px; font-size:12px; margin-top:8px; display:inline-block; font-weight:700; }
      .err .act-btn:hover{ filter:brightness(1.1); color:#fff; }
      .setup{ font-size:13px; color:#c7b89f; line-height:1.6; }
      .setup .open{ all:unset; cursor:pointer; color:#e8c872; font-weight:600; text-decoration:underline; }
      .note{ font-size:12px; color:#c7b89f; background:#1b1713; border-radius:10px; padding:8px 11px; margin-top:8px; border:1px solid rgba(196,165,116,0.22); }
      .note b{ color:#e8c872; font-weight:600; }
      .tagrow{ display:flex; gap:5px; flex-wrap:wrap; margin-top:6px; }
      .tag{ font-size:10.5px; color:#d4af37; background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,.35); border-radius:99px; padding:1px 8px; }

      .typing{ display:inline-flex; gap:5px; padding:6px 0; }
      .typing i{ width:6px; height:6px; border-radius:50%; background:#e8c872; display:inline-block; animation:bl 1.1s infinite both; }
      .typing i:nth-child(2){ animation-delay:.18s; } .typing i:nth-child(3){ animation-delay:.36s; }
      @keyframes bl{ 0%,80%,100%{ opacity:.2; transform:scale(0.8); } 40%{ opacity:1; transform:scale(1.15); } }

      .tools{ display:flex; gap:6px; padding:0 15px 9px; }
      .tool{ all:unset; cursor:pointer; font-size:11.5px; font-family:-apple-system,sans-serif; font-weight:600; color:#c7b89f; border:1px solid rgba(196,165,116,.25); border-radius:8px; padding:4px 10px; transition:all .15s cubic-bezier(0.34,1.5,.64,1); }
      .tool:hover{ background:rgba(212,175,55,.15); color:#fff; border-color:#e8c872; transform:translateY(-1px); }
      .tool.t-tense{ color:#e8c872; border-color:rgba(212,175,55,.45); display:none; }
      .tool[disabled]{ opacity:.45; cursor:default; transform:none; }

      .ask{ display:flex; align-items:flex-end; gap:8px; padding:9px 12px 12px; background:#15110d; border-top:1px solid rgba(196,165,116,0.15); }
      .ask textarea{ all:unset; flex:1; background:#100e0c; border-radius:11px; padding:9px 11px; font-size:13px;
                     line-height:1.5; max-height:90px; color:#f7f1e6; box-sizing:border-box; border:1px solid rgba(196,165,116,.22); }
      .ask textarea::placeholder{ color:#8a7c66; }
      .ask textarea:focus{ border-color:rgba(212,175,55,.7); box-shadow:0 0 10px rgba(212,175,55,0.25); }
      .ask .send{ all:unset; cursor:pointer; width:34px; height:34px; flex-shrink:0; display:grid; place-items:center;
                  background:linear-gradient(135deg,#e8c872,#c4a574); border-radius:11px; color:#100e0c; transition:all .15s cubic-bezier(0.34,1.5,.64,1);
                  box-shadow:0 2px 10px rgba(212,175,55,0.35); }
      .ask .send:hover{ filter:brightness(1.1); transform:scale(1.06); }
      .ask .send:active{ transform:scale(.92); }
    </style>
    <div class="sel-dock">
      <button class="sel-btn flower" title="Explain (FluentLoop)">${camellia(24)}</button>
      <button class="sel-fill" title="Fill side panel input (Alt+Shift+F)">Fill Input</button>
    </div>
    <div class="card">
      <div class="head">${camellia(20)}<span class="name">FLUENTLOOP</span><button class="x" title="Close">×</button></div>
      <div class="gold-line"></div>
      <div class="body"></div>
      <div class="tools">
        <button class="tool t-tense" title="Break down verb tenses in this sentence">Tenses · 时态</button>
        <button class="tool t-long" title="Expand detailed breakdown">Detail</button>
        <button class="tool t-read" title="Read text aloud">Read</button>
        <button class="tool t-save" title="Analyze & save to vault">Save to Vault</button>
      </div>
      <div class="ask">
        <textarea rows="1" placeholder="Ask a follow-up…"></textarea>
        <button class="send" title="Send"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 12l16-8-6 8 6 8z" fill="currentColor"/></svg></button>
      </div>
    </div>`);
  document.documentElement.appendChild(host);

  const selDock = shadow.querySelector(".sel-dock");
  const flower = shadow.querySelector(".flower");
  const btnFill = shadow.querySelector(".sel-fill");
  const card = shadow.querySelector(".card");
  const body = shadow.querySelector(".body");
  const askInput = shadow.querySelector(".ask textarea");
  const askSend = shadow.querySelector(".ask .send");
  const btnLong = shadow.querySelector(".t-long");
  const btnRead = shadow.querySelector(".t-read");
  const btnSave = shadow.querySelector(".t-save");
  const btnTense = shadow.querySelector(".t-tense");

  function updateTenseBtn() {
    if (!btnTense) return;
    const show = activeLang === "fr" && sourceText && sourceText.trim().split(/\s+/).length >= 2;
    btnTense.style.display = show ? "" : "none";
  }

  let anchor = { x: 0, y: 0, yTop: 0 };
  let pendingText = "";
  let sourceText = "";
  let history = [];
  let streaming = false;
  let saveState = null;

  // 增强型选区获取：全面覆盖常规文本、输入框/textarea 内部选中文本、代码块
  const selText = () => {
    // 1. 检查当前获得焦点的输入框/文本域（如代码编辑器、聊天输入框、搜索框）
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      const start = active.selectionStart;
      const end = active.selectionEnd;
      if (typeof start === "number" && typeof end === "number" && start < end) {
        const val = (active.value || "").slice(start, end).trim();
        if (val) return val;
      }
    }
    // 2. 检查标准 DOM 选区
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      const s = (sel.toString() || "").trim();
      if (s) return s;
    }
    return "";
  };

  // 增强型选区与字幕浮标锚点计算，防止 Popover 越界
  function anchorFromSelection(e) {
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      const rect = active.getBoundingClientRect();
      const x = e?.clientX ?? (rect.left + rect.width / 2);
      const y = e?.clientY ?? rect.bottom;
      return { x, y: rect.bottom, yTop: rect.top };
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const rects = range.getClientRects();
      if (rects.length) {
        const last = rects[rects.length - 1];  // 选区末行：气泡朝下锚点
        const first = rects[0];                // 选区首行：气泡朝上锚点
        return {
          x: e?.clientX ?? (last.left + last.width / 2),
          y: last.bottom,
          yTop: first.top,
        };
      }
      const bound = range.getBoundingClientRect();
      if (bound.width || bound.height) {
        return {
          x: e?.clientX ?? (bound.left + bound.width / 2),
          y: bound.bottom,
          yTop: bound.top,
        };
      }
    }
    const y = e?.clientY ?? innerHeight / 2;
    return { x: e?.clientX ?? innerWidth / 2, y, yTop: y };
  }

  const GAP = 12, MARGIN = 8;
  function placeCard() {
    if (card.style.display !== "block") return;
    const vw = innerWidth, vh = innerHeight;
    const rect = card.getBoundingClientRect();
    const w = rect.width || 356;
    const h = rect.height || 200;

    const belowSpace = vh - anchor.y - GAP - MARGIN;
    const aboveSpace = anchor.yTop - GAP - MARGIN;

    let top;
    if (h <= belowSpace) {
      top = anchor.y + GAP;
    } else if (h <= aboveSpace) {
      top = anchor.yTop - GAP - h;
    } else {
      top = belowSpace >= aboveSpace ? anchor.y + GAP : MARGIN;
    }
    top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));

    let left = anchor.x - 24;
    left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));

    card.style.bottom = "auto";
    card.style.top = top + "px";
    card.style.left = left + "px";
  }

  document.addEventListener("mouseup", (e) => {
    if (e.composedPath && e.composedPath().includes(host)) return;
    setTimeout(() => {
      const t = selText();
      if (t && t.length >= 1) {
        pendingText = t;
        anchor = anchorFromSelection(e);
        autoCopy(t);
        showFlower();
      } else {
        selDock.style.display = "none";
      }
    }, 15);
  });

  function fillComposer(text) {
    const t = String(text || pendingText || selText()).trim();
    if (!t) return;
    selDock.style.display = "none";
    chrome.runtime.sendMessage({ type: "FILL_COMPOSER", text: t, open: true, append: true });
  }

  function autoCopy(text) {
    const p = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(text) : null;
    if (p && typeof p.catch === "function") p.catch(() => fallbackCopy(text));
    else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:-9999px;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    } catch (_) {}
  }

  document.addEventListener("mousedown", (e) => {
    if (e.composedPath && e.composedPath().includes(host)) return;
    selDock.style.display = "none";
    if (card.style.display === "block") closeCard();
  });
  document.addEventListener("scroll", () => { selDock.style.display = "none"; }, true);
  addEventListener("resize", () => { if (card.style.display === "block") placeCard(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { selDock.style.display = "none"; closeCard(); return; }
    if (e.altKey && e.shiftKey && e.key.toLowerCase() === "f") {
      const t = selText() || pendingText;
      if (t) { e.preventDefault(); fillComposer(t); }
    }
  });

  function showFlower() {
    selDock.style.display = "flex";
    const vw = innerWidth, vh = innerHeight;
    let bx = anchor.x + 8, by = anchor.y - 40;
    if (by < 4) by = anchor.y + 12;
    selDock.style.left = Math.max(4, Math.min(bx, vw - 140)) + "px";
    selDock.style.top = Math.max(4, Math.min(by, vh - 40)) + "px";
    selDock.style.animation = "none"; void selDock.offsetWidth; selDock.style.animation = "";
  }

  flower.addEventListener("mousedown", (e) => e.preventDefault());
  flower.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    const t = pendingText || selText();
    if (!t) return;
    selDock.style.display = "none";
    openCardForExplain(t);
  });

  btnFill.addEventListener("mousedown", (e) => e.preventDefault());
  btnFill.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    fillComposer();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg?.text) return;
    anchor = anchorFromSelection(null);
    if (msg.type === "EXPLAIN_INLINE") openCardForExplain(msg.text);
    else if (msg.type === "SAVE_INLINE") { openCardForExplain(msg.text); saveCard(msg.text); }
  });

  function openCardForExplain(text) {
    sourceText = text;
    saveState = null;
    history = [{ role: "user", content: text, display: text, raw: text }];
    card.style.display = "block";
    btnSave.disabled = false;
    btnSave.textContent = "Save to Vault";
    placeCard();
    requestAnimationFrame(placeCard);
    updateTenseBtn();
    startStream("explain");
  }

  function closeCard() {
    card.style.display = "none";
    history = []; sourceText = ""; streaming = false; saveState = null;
    JYH_MD.stop();
  }
  shadow.querySelector(".head .x").addEventListener("click", closeCard);

  /* ---------- Toolbar ---------- */
  btnRead.addEventListener("click", () => sourceText && speak(sourceText));

  btnLong.addEventListener("click", () => {
    if (streaming || !history.length) return;
    history.push({ role: "user", content: "Elaborate in detail on background, nuances, and deeper usage.", display: "Detailed breakdown" });
    startStream("long");
  });

  btnTense.addEventListener("click", () => {
    if (streaming || !sourceText) return;
    history.push({ role: "user", content: sourceText, display: "⏱ Tense analysis" });
    startStream("tense", { tenseSource: sourceText });
  });

  btnSave.addEventListener("click", () => sourceText && saveCard(sourceText));

  function saveCard(text) {
    if (saveState?.status === "saving") return;
    saveState = { status: "saving" };
    btnSave.disabled = true;
    btnSave.textContent = "Analyzing…";
    render(streaming);
    chrome.runtime.sendMessage(
      { type: "SAVE_SELECTION", text, url: location.href, pageTitle: document.title },
      (res) => {
        if (chrome.runtime.lastError) {
          saveState = { status: "error", error: "Extension updated. Please refresh this page." };
        } else if (!res?.ok) {
          saveState = { status: "error", error: res?.error || "Save failed." };
        } else {
          saveState = { status: "done", card: res.card };
          try {
            const rect = btnSave.getBoundingClientRect();
            JYH_CAMELLIA.createSparkleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
          } catch (_) {}
        }
        btnSave.disabled = saveState.status === "done";
        btnSave.textContent = saveState.status === "done" ? "✓ Saved" : "Save to Vault";
        render(streaming);
      }
    );
  }

  /* ---------- Stream Requests ---------- */
  async function startStream(mode, opts = {}) {
    history.push({ role: "assistant", content: "" });
    streaming = true;
    render(true);
    const last = history[history.length - 1];
    const apiMsgs = history.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
    const rawFirst = history[0]?.raw && mode === "explain" ? history[0].raw : null;

    let settled = false, port = null, watchdog = null;
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => fail("Request timed out (45s). Check network, proxy, or API Key."), 45000);
    };
    const cleanup = () => { clearTimeout(watchdog); try { port && port.disconnect(); } catch (_) {} };
    const fail = (m, canReload = false) => {
      if (settled) return;
      settled = true; streaming = false; last.content = ""; last.error = m; last.canReload = canReload;
      render(false); cleanup();
    };
    const finish = () => { if (settled) return; settled = true; streaming = false; render(false); cleanup(); };

    try {
      port = chrome.runtime.connect({ name: "explain-stream" });
    } catch (e) {
      return fail("Extension updated in background. Please refresh this webpage to continue.", true);
    }

    arm();
    port.onMessage.addListener((m) => {
      if (m.type === "chunk") { arm(); last.content += m.text; render(true); }
      else if (m.type === "done") finish();
      else if (m.type === "error") fail(m.message);
      else if (m.type === "need-key") { if (settled) return; settled = true; streaming = false; last.content = ""; last.needKey = true; render(false); cleanup(); }
    });
    port.onDisconnect.addListener(() => {
      if (settled) return;
      if (last.content.trim()) finish();
      else fail("Connection closed. Please refresh this page.", true);
    });

    try { port.postMessage({ type: "start", mode, messages: apiMsgs, rawFirst, tenseSource: opts.tenseSource, wordExample: opts.wordExample }); }
    catch (e) { fail("Failed to send request. Refresh page and try again.", true); }
  }

  /* ---------- Render ---------- */
  function render(isStreaming) {
    let html = "";
    history.forEach((m, i) => {
      if (m.role === "user") {
        html += i === 0
          ? `<div class="quote">${esc(m.display || m.content)}</div>`
          : `<div class="ask-line">${esc(m.display || m.content)}</div>`;
      } else if (m.needKey) {
        html += `<div class="setup">OpenAI API Key is required. Click <button class="open">Open Settings</button> to enter Key.</div>`;
      } else if (m.error) {
        html += `<div class="err">${esc(m.error)}${m.canReload ? '<br><button class="act-btn btn-reload">🔄 Reload Page</button>' : ''}</div>`;
      } else if (!m.content && isStreaming && i === history.length - 1) {
        html += `<div class="typing"><i></i><i></i><i></i></div>`;
      } else {
        html += `<div class="ans">${md(m.content)}</div>`;
      }
    });

    if (saveState?.status === "saving") html += `<div class="note">Extracting core vocabulary, concepts, and examples…</div>`;
    else if (saveState?.status === "error") html += `<div class="note"><b>Save failed: </b>${esc(saveState.error)}</div>`;
    else if (saveState?.status === "done") {
      const c = saveState.card;
      const tags = (c.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
      html += `<div class="note"><b>${esc(c.title)}</b> saved to Vault · ${c.words.length} words
                 <div class="tagrow">${tags}</div></div>`;
    }

    mountHTML(body, html);
    const openBtn = body.querySelector(".setup .open");
    if (openBtn) openBtn.addEventListener("click", () => chrome.runtime.sendMessage({ type: "OPEN_PANEL" }));
    const reloadBtn = body.querySelector(".err .btn-reload");
    if (reloadBtn) reloadBtn.addEventListener("click", () => location.reload());

    bindSpeakers(body);
    bindWordSavers(body, async (meta, btn) => {
      try {
        const rect = btn.getBoundingClientRect();
        JYH_CAMELLIA.createSparkleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
        JYH_CAMELLIA.showFloatingToast(rect.left + rect.width / 2, rect.top - 24, `"${meta.word}" saved to Vault`);
      } catch (_) {}

      chrome.runtime.sendMessage({
        type: "SAVE_SINGLE_WORD",
        word: meta.word,
        ipa: meta.ipa,
        zh: meta.zh,
        sense: meta.sense,
        pos: meta.pos,
        example: sourceText || pendingText || "",
        url: location.href,
        pageTitle: document.title,
      });
    });
    bindWordExamples(body, (meta) => {
      if (streaming) return;
      history.push({ role: "user", content: meta.word, display: `例句 · ${meta.word}` });
      startStream("word-example", {
        wordExample: { word: meta.word, ipa: meta.ipa, context: sourceText || pendingText || "" },
      });
    });
    body.scrollTop = body.scrollHeight;
    placeCard();
    updateTenseBtn();
  }

  function sendFollowUp() {
    const q = askInput.value.trim();
    if (!q || streaming) return;
    askInput.value = ""; askInput.style.height = "auto";
    history.push({ role: "user", content: q });
    startStream("chat");
  }
  askSend.addEventListener("click", sendFollowUp);
  askInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendFollowUp(); } });
  askInput.addEventListener("input", () => { askInput.style.height = "auto"; askInput.style.height = Math.min(askInput.scrollHeight, 90) + "px"; });

  /* ---------- 悬浮取词：按住 Shift 悬浮在词上，就地给一行释义 ---------- */
  const hoverTip = document.createElement("div");
  hoverTip.className = "jyh-hover-tip";
  hoverTip.style.cssText = "all:initial;position:fixed;z-index:2147483647;display:none;max-width:380px;" +
    "background:linear-gradient(135deg,rgba(22,18,14,0.97),rgba(14,11,8,0.99));color:#f7f1e6;border-radius:12px;padding:10px 14px;font:14px/1.6 -apple-system,'SF Pro Display','Inter',sans-serif;" +
    "box-shadow:0 16px 42px rgba(0,0,0,.7), inset 0 0 0 1px rgba(212,175,55,.45);backdrop-filter:blur(16px);pointer-events:auto;";
  document.documentElement.appendChild(hoverTip);

  const hoverTipStyle = document.createElement("style");
  hoverTipStyle.id = "jyh-hover-tip-style";
  hoverTipStyle.textContent = `
    .jyh-hover-tip .w{ display:inline-flex; align-items:center; gap:5px; flex-wrap:wrap; background:#1b1713; border-radius:8px; padding:2px 6px; border:1px solid rgba(196,165,116,0.22); }
    .jyh-hover-tip .w b{ font-weight:600; color:#f7f1e6; }
    .jyh-hover-tip .w i{ font-style:normal; color:#d4af37; font-size:13px; }
    .jyh-hover-tip .w .pos{ font-size:10.5px; color:#e8c872; background:rgba(212,175,55,0.15); border-radius:4px; padding:0 4px; font-weight:600; }
    .jyh-hover-tip .spk, .jyh-hover-tip .btn-save-word{
      all:unset; cursor:pointer; display:inline-grid; place-items:center;
      width:22px; height:22px; border-radius:6px; color:#d4af37;
      background:transparent; border:1px solid rgba(196,165,116,0.28); transition:all .15s;
    }
    .jyh-hover-tip .spk:hover, .jyh-hover-tip .btn-save-word:hover{ background:rgba(212,175,55,.2); border-color:rgba(212,175,55,.6); color:#fff; }
    .jyh-hover-tip .btn-save-word.is-saved{ color:#6abf69; border-color:rgba(106,191,105,.45); }
    .jyh-hover-tip .spk svg, .jyh-hover-tip .btn-save-word svg{ display:block; pointer-events:none; }
    .jyh-hover-tip p{ margin:.35em 0; font-size:13.5px; color:#c7b89f; }
  `;
  document.documentElement.appendChild(hoverTipStyle);

  const hoverCache = new Map();
  let hoverTimer = null, hoverLastWord = "", hoverSeq = 0;

  function wordAtPoint(x, y) {
    const pos = document.caretPositionFromPoint
      ? document.caretPositionFromPoint(x, y)
      : (document.caretRangeFromPoint ? (() => { const r = document.caretRangeFromPoint(x, y); return r && { offsetNode: r.startContainer, offset: r.startOffset }; })() : null);
    if (!pos || !pos.offsetNode || pos.offsetNode.nodeType !== Node.TEXT_NODE) return null;
    const text = pos.offsetNode.textContent;
    const isL = (ch) => /[\p{L}\p{M}'\u2019-]/u.test(ch || "");
    let a = pos.offset, b = pos.offset;
    if (!isL(text[a])) return null;
    while (a > 0 && isL(text[a - 1])) a--;
    while (b < text.length && isL(text[b])) b++;
    const word = text.slice(a, b).replace(/^['\u2019-]+|['\u2019-]+$/g, "");
    if (word.length < 2 || word.length > 50) return null;
    const ctx = text.slice(Math.max(0, a - 80), Math.min(text.length, b + 80));
    return { word, ctx };
  }

  function showHoverTip(x, y, html, opts) {
    hoverTip.innerHTML = html;
    hoverTip.style.display = "block";
    const w = Math.min(380, hoverTip.offsetWidth || 200);
    const h = hoverTip.offsetHeight || 40;
    let left = Math.max(6, Math.min(x + 12, innerWidth - w - 6));
    let top = y + 18;
    if (opts?.anchor === "caption" && capHost.style.display === "block") {
      const barRect = capHost.getBoundingClientRect();
      left = Math.max(6, Math.min(barRect.left, innerWidth - w - 6));
      top = Math.max(6, barRect.top - h - 10);
    } else if (top + h > innerHeight - 6) {
      top = y - h - 12;
    }
    hoverTip.style.left = left + "px";
    hoverTip.style.top = Math.max(6, top) + "px";
  }
  function hideHoverTip() {
    hoverTip.style.display = "none";
    hoverLastWord = "";
    clearTimeout(hoverTimer);
  }

  let captionDockTimer = null;
  const CAPTION_DOCK_MS = 1800;
  let lastCaptionWindow = null;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function isOverVideoDock(e) {
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(hoverTip) || path.includes(capHost)) return true;
    return false;
  }

  function isInCaptionDockZone(e) {
    if (isOverVideoDock(e)) return true;
    if (capHost.style.display !== "block") return false;
    const x = e?.clientX ?? lastMouseX;
    const y = e?.clientY ?? lastMouseY;
    const bar = capHost.getBoundingClientRect();
    const padX = 28;
    if (x >= bar.left - padX && x <= bar.right + padX && y >= bar.top - 12 && y <= bar.bottom + 12) return true;
    const win = lastCaptionWindow?.isConnected ? lastCaptionWindow.getBoundingClientRect() : null;
    if (!win) return false;
    const left = Math.min(bar.left, win.left) - padX;
    const right = Math.max(bar.right, win.right) + padX;
    const top = Math.min(bar.top, win.top) - 8;
    const bottom = Math.max(bar.bottom, win.bottom) + 8;
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  function cancelCaptionDockHide() {
    clearTimeout(captionDockTimer);
    captionDockTimer = null;
  }

  function scheduleCaptionDockHide() {
    cancelCaptionDockHide();
    captionDockTimer = setTimeout(() => {
      hideCaptionActions();
      hideHoverTip();
    }, CAPTION_DOCK_MS);
  }

  hoverTip.addEventListener("mouseenter", cancelCaptionDockHide);
  hoverTip.addEventListener("mouseleave", scheduleCaptionDockHide);

  const CAPTION_SEL = [
    ".ytp-caption-segment",
    ".caption-window",
    ".ytp-caption-window-container",
    ".bpx-player-subtitle-panel-text",
    ".bpx-player-subtitle-panel-wrap",
    ".bpx-player-subtitle-area",
    ".subtitle-item-text",
    ".bilibili-player-video-subtitle",
    ".bpx-player-subtitle",
  ].join(",");

  const CAPTION_WINDOW_SEL = [
    ".ytp-caption-window-container",
    ".caption-window",
    ".bpx-player-subtitle-panel-wrap",
    ".bpx-player-subtitle-area",
    ".bilibili-player-video-subtitle",
  ].join(",");

  function isVideoHost() {
    const h = location.hostname.replace(/^www\./, "");
    return /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)bilibili\.com$|(^|\.)bilibili\.tv$|(^|\.)b23\.tv$/.test(h);
  }
  function captionRoot(el) {
    return el && el.closest ? el.closest(CAPTION_SEL) : null;
  }
  function captionWindowFrom(el) {
    if (!el?.closest) return null;
    return el.closest(CAPTION_WINDOW_SEL) || captionRoot(el);
  }
  function captionWindowText(win) {
    if (!win) return "";
    return (win.innerText || win.textContent || "").replace(/\s+/g, " ").trim();
  }
  function captionLineFrom(el) {
    const win = captionWindowFrom(el);
    if (win) return captionWindowText(win);
    const root = captionRoot(el);
    if (!root) return "";
    return (root.innerText || "").replace(/\s+/g, " ").trim();
  }

  const capHost = document.createElement("div");
  capHost.style.cssText = "all:initial;position:fixed;z-index:2147483646;display:none;pointer-events:none;";
  const capShadow = capHost.attachShadow({ mode: "open" });
  mountHTML(capShadow, `
    <style>
      :host{ all:initial; }
      .dock{
        display:flex; flex-direction:column; align-items:center;
        pointer-events:auto; padding-bottom:58px; margin-bottom:-58px;
      }
      .bar{
        display:flex; align-items:center; gap:8px;
        background:linear-gradient(135deg, rgba(22,18,14,0.95), rgba(14,11,8,0.98)); color:#f7f1e6; border-radius:999px;
        padding:6px 10px 6px 14px;
        box-shadow:0 12px 36px rgba(0,0,0,.6), inset 0 0 0 1px rgba(212,175,55,.45);
        font:12px/1.4 -apple-system,"SF Pro Display","Inter","Segoe UI",sans-serif;
        backdrop-filter:blur(16px); pointer-events:auto;
      }
      .hint{ font-size:11px; font-weight:600; color:#c7b89f; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap; }
      .btn{
        all:unset; cursor:pointer; font-size:11.5px; letter-spacing:.06em;
        color:#100e0c; background:linear-gradient(135deg,#e8c872,#c4a574); border-radius:999px; padding:5px 12px; font-weight:700;
        box-shadow:0 2px 10px rgba(212,175,55,0.35); transition:all .15s;
      }
      .btn.ghost{ background:transparent; color:#d4af37; box-shadow:inset 0 0 0 1px rgba(212,175,55,.45); }
      .btn:hover{ transform:scale(1.05); filter:brightness(1.1); }
    </style>
    <div class="dock">
      <div class="bar">
        <span class="hint">Captions</span>
        <button class="btn ghost" data-act="fill" title="Append full caption block to input">Fill Input</button>
        <button class="btn" data-act="explain">Explain</button>
      </div>
    </div>`);
  document.documentElement.appendChild(capHost);
  capHost.addEventListener("mouseenter", cancelCaptionDockHide);
  capHost.addEventListener("mouseleave", scheduleCaptionDockHide);
  let lastCaption = "";

  function findVisibleCaptionEl() {
    let best = null, bestArea = 0;
    document.querySelectorAll(CAPTION_SEL).forEach((n) => {
      const t = (n.innerText || "").replace(/\s+/g, " ").trim();
      if (!t) return;
      const r = n.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea && r.bottom > 0 && r.top < innerHeight) {
        bestArea = area;
        best = n;
      }
    });
    return best;
  }

  function findVisibleCaptionWindow() {
    let best = null, bestArea = 0;
    document.querySelectorAll(CAPTION_WINDOW_SEL).forEach((n) => {
      const t = (n.innerText || "").replace(/\s+/g, " ").trim();
      if (!t) return;
      const r = n.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea && r.bottom > 0 && r.top < innerHeight) {
        bestArea = area;
        best = n;
      }
    });
    return best || findVisibleCaptionEl();
  }

  function positionCaptionActions(anchorEl) {
    const win = captionWindowFrom(anchorEl) || findVisibleCaptionWindow();
    if (!win) {
      capHost.style.display = "none";
      capHost.style.pointerEvents = "none";
      lastCaptionWindow = null;
      return;
    }
    lastCaptionWindow = win;
    const rect = win.getBoundingClientRect();
    capHost.style.display = "block";
    capHost.style.pointerEvents = "auto";
    capHost.style.left = `${Math.max(12, Math.min(rect.left + rect.width / 2, innerWidth - 12))}px`;
    capHost.style.top = `${Math.max(8, rect.top - 46)}px`;
    capHost.style.bottom = "auto";
    capHost.style.transform = "translateX(-50%)";
  }

  function hideCaptionActions() {
    capHost.style.display = "none";
    capHost.style.pointerEvents = "none";
    lastCaptionWindow = null;
  }

  capShadow.querySelector(".bar").addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act || !lastCaption) return;
    e.preventDefault(); e.stopPropagation();
    if (act === "explain") openCardForExplain(lastCaption);
    else chrome.runtime.sendMessage({ type: "FILL_COMPOSER", text: lastCaption, open: true, append: true });
  });

  function currentCaptionWindowText() {
    const win = findVisibleCaptionWindow();
    if (win) {
      const t = captionWindowText(win);
      if (t) return t;
    }
    let best = "";
    document.querySelectorAll(CAPTION_SEL).forEach((n) => {
      const t = (n.innerText || "").replace(/\s+/g, " ").trim();
      if (t.length > best.length) best = t;
    });
    return best;
  }

  if (isVideoHost()) {
    // Enlarge native captions; FluentLoop reads them without rendering a duplicate line.
    const capStyle = document.createElement("style");
    capStyle.id = "jyh-caption-enhance";
    capStyle.textContent = `
      .ytp-caption-segment, .caption-window, .ytp-caption-window-container .ytp-caption-segment {
        font-size: 145% !important; line-height: 1.45 !important;
        text-shadow: 0 1px 4px rgba(0,0,0,.85), 0 0 8px rgba(0,0,0,.6) !important;
      }
      .bpx-player-subtitle-panel-text, .bpx-player-subtitle-panel-wrap .subtitle-item-text,
      .subtitle-item-text, .bilibili-player-video-subtitle {
        font-size: 1.35em !important; line-height: 1.5 !important;
      }`;
    (document.head || document.documentElement).appendChild(capStyle);

    // 仅缓存当前字幕行，供悬停操作使用；不自动弹出重复字幕条
    let capTick = 0;
    const syncCaptionCache = () => {
      const t = currentCaptionWindowText();
      if (t) lastCaption = t;
    };
    const obs = new MutationObserver(() => {
      const now = Date.now();
      if (now - capTick < 180) return;
      capTick = now;
      syncCaptionCache();
    });
    const start = () => {
      if (document.body) obs.observe(document.body, { childList: true, subtree: true, characterData: true });
      syncCaptionCache();
    };
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
  }

  function bindHoverTipActions(hit) {
    bindSpeakers(hoverTip);
    bindWordSavers(hoverTip, (meta) => {
      chrome.runtime.sendMessage({
        type: "SAVE_SINGLE_WORD",
        word: meta.word,
        ipa: meta.ipa,
        zh: meta.zh,
        sense: meta.sense,
        example: hit?.ctx || lastCaption || "",
        url: location.href,
        pageTitle: document.title,
      });
    });
  }

  function formatHoverHtml(text) {
    return md(text);
  }

  function showHoverTipForCaption(x, y, html) {
    showHoverTip(x, y, html, { anchor: "caption" });
  }

  function lookupHover(hit, x, y, overCaption) {
    if (hit.word === hoverLastWord && hoverTip.style.display === "block") return;
    hoverLastWord = hit.word;
    const key = hit.word.toLowerCase();
    const tipShow = (html) => {
      if (overCaption) showHoverTipForCaption(x, y, html);
      else showHoverTip(x, y, html);
    };
    if (hoverCache.has(key)) {
      tipShow(hoverCache.get(key));
      bindHoverTipActions(hit);
      return;
    }
    const seq = ++hoverSeq;
    tipShow(`<span style="opacity:.65">${esc(hit.word)} …</span>`);
    chrome.runtime.sendMessage({ type: "HOVER_WORD", word: hit.word, context: hit.ctx }, (res) => {
      if (chrome.runtime.lastError || seq !== hoverSeq) return;
      if (!res || !res.ok) {
        if (res && res.error === "no-key") tipShow("Please enter OpenAI API Key in Settings");
        else hideHoverTip();
        return;
      }
      const html = formatHoverHtml(res.text);
      hoverCache.set(key, html);
      if (hoverLastWord === hit.word) {
        tipShow(html);
        bindHoverTipActions(hit);
      }
    });
  }

  document.addEventListener("mousemove", (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (e.composedPath && e.composedPath().includes(host)) return;
    const capWin = captionWindowFrom(e.target);
    const overCaption = !!capWin;
    const overDock = isInCaptionDockZone(e);
    const armed = e.shiftKey || overCaption;

    if (overDock) cancelCaptionDockHide();

    if (!armed && !overDock) {
      scheduleCaptionDockHide();
      return;
    }

    cancelCaptionDockHide();

    if (overCaption) {
      const text = captionWindowText(capWin) || currentCaptionWindowText();
      if (text) {
        lastCaption = text;
        positionCaptionActions(capWin);
      } else {
        hideCaptionActions();
      }
    }

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      const hit = wordAtPoint(e.clientX, e.clientY);
      if (!hit) {
        if (!overDock) hideHoverTip();
        return;
      }
      lookupHover(hit, e.clientX, e.clientY, overCaption || overDock);
    }, overCaption ? 160 : 350);
  });
  document.addEventListener("keyup", (e) => {
    if (e.key !== "Shift") return;
    if (isInCaptionDockZone(e)) return;
    scheduleCaptionDockHide();
  });
  document.addEventListener("scroll", () => scheduleCaptionDockHide(), true);

})();
