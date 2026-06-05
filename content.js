// content.js —— 划词冒出山茶花;点击就地弹气泡(高奢质感),流式解释 + 追问;含超时/断连兜底

(function () {
  if (window.__jieyuhuaInjected) return;
  window.__jieyuhuaInjected = true;

  // ---------- 山茶花 SVG(双层白瓣 + 淡金花心)----------
  function camellia(size) {
    const outer = [0, 45, 90, 135, 180, 225, 270, 315]
      .map((a) => `<ellipse cx="24" cy="11.5" rx="5.4" ry="10.4" fill="url(#camO)" transform="rotate(${a} 24 24)"/>`).join("");
    const inner = [22, 67, 112, 157, 202, 247, 292, 337]
      .map((a) => `<ellipse cx="24" cy="15" rx="3.7" ry="7" fill="url(#camI)" transform="rotate(${a} 24 24)"/>`).join("");
    return `
      <svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">
        <defs>
          <radialGradient id="camO" cx="50%" cy="36%" r="66%">
            <stop offset="0%" stop-color="#ffffff"/><stop offset="68%" stop-color="#f7f1e6"/><stop offset="100%" stop-color="#e4dac6"/>
          </radialGradient>
          <radialGradient id="camI" cx="50%" cy="40%" r="62%">
            <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#efe6d4"/>
          </radialGradient>
        </defs>
        <g>${outer}</g><g>${inner}</g>
        <circle cx="24" cy="24" r="3.6" fill="#c9b489"/><circle cx="24" cy="24" r="1.5" fill="#a98f59"/>
      </svg>`;
  }

  function mountHTML(root, str) {
    const doc = new DOMParser().parseFromString(str, "text/html");
    root.replaceChildren(...[...doc.head.childNodes, ...doc.body.childNodes]);
  }

  // ---------- Shadow DOM 根 ----------
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0;";
  const shadow = host.attachShadow({ mode: "open" });
  mountHTML(shadow, `
    <style>
      :host{ all:initial; }
      .flower{
        all:unset; position:fixed; display:none; place-items:center;
        width:32px; height:32px; border-radius:50%;
        background:#1b1813;
        box-shadow:0 4px 16px rgba(0,0,0,.32), inset 0 0 0 1px rgba(201,180,137,.55);
        cursor:pointer; transform-origin:center;
        animation:bloom .3s cubic-bezier(.34,1.4,.64,1);
        font-family:Georgia,"Songti SC",serif;
      }
      .flower:hover{ box-shadow:0 6px 20px rgba(0,0,0,.4), inset 0 0 0 1px rgba(201,180,137,.9); }
      .flower:active{ transform:scale(.9); }
      @keyframes bloom{ from{ transform:scale(.3) rotate(-30deg); opacity:0; } to{ transform:scale(1) rotate(0); opacity:1; } }

      .card{
        all:initial; position:fixed; display:none; width:344px; max-width:92vw;
        background:#f7f2e9; color:#241e16; border-radius:18px;
        box-shadow:0 18px 50px rgba(35,26,12,.26);
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
        font-size:14px; line-height:1.64; overflow:hidden;
        animation:pop .22s cubic-bezier(.34,1.4,.64,1);
      }
      @keyframes pop{ from{ transform:translateY(7px) scale(.97); opacity:0; } to{ transform:none; opacity:1; } }
      .head{ display:flex; align-items:center; gap:8px; padding:13px 15px 8px; }
      .head .name{ font-family:Georgia,"Songti SC",serif; font-weight:600; font-size:15px; letter-spacing:.14em;
                   color:#1f1a13; flex:1; }
      .head .x{ all:unset; cursor:pointer; color:#b3a88f; font-size:18px; line-height:1; padding:2px 5px; border-radius:7px; }
      .head .x:hover{ background:#ece2cd; color:#7a6b48; }
      .gold-line{ height:1px; margin:0 15px 8px; background:linear-gradient(90deg,transparent,#c9b489 35%,#c9b489 65%,transparent); opacity:.7; }
      .body{ max-height:46vh; overflow-y:auto; padding:2px 15px 12px; }
      .body::-webkit-scrollbar{ width:7px; } .body::-webkit-scrollbar-thumb{ background:#e2d6bf; border-radius:4px; }
      .quote{ font-size:12.5px; color:#8c7d5c; background:#efe6d3; border-radius:10px; padding:7px 10px; margin:4px 0 11px;
              display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      .ask-line{ font-size:13px; color:#7a6b48; margin:13px 0 4px; font-weight:600; font-family:Georgia,serif; }
      .ans :where(p,ul,ol){ margin:.5em 0; } .ans :where(p,ul,ol):first-child{ margin-top:0; }
      .ans code{ background:#efe6d3; padding:1px 5px; border-radius:5px; font-size:12.5px; }
      .ans pre{ background:#efe6d3; border-radius:10px; padding:10px 12px; overflow-x:auto; margin:.5em 0; }
      .ans pre code{ background:none; padding:0; } .ans strong{ color:#1a140d; }
      .err{ color:#9a5a3a; font-size:13px; }
      .setup{ font-size:13px; color:#6b5f48; } .setup .open{ all:unset; cursor:pointer; color:#a9824a; font-weight:600; text-decoration:underline; }
      .typing{ display:inline-flex; gap:5px; padding:6px 0; }
      .typing i{ width:6px; height:6px; border-radius:50%; background:#b89a5e; display:inline-block; animation:bl 1.1s infinite both; }
      .typing i:nth-child(2){ animation-delay:.18s; } .typing i:nth-child(3){ animation-delay:.36s; }
      @keyframes bl{ 0%,80%,100%{ opacity:.2; } 40%{ opacity:1; } }
      .ask{ display:flex; align-items:flex-end; gap:8px; padding:9px 12px 12px; background:#efe6d3; }
      .ask textarea{ all:unset; flex:1; background:#fffdf8; border-radius:11px; padding:9px 11px; font-size:13.5px;
                     line-height:1.5; max-height:90px; color:#241e16; box-sizing:border-box; }
      .ask textarea::placeholder{ color:#b3a88f; }
      .ask .send{ all:unset; cursor:pointer; width:34px; height:34px; flex-shrink:0; display:grid; place-items:center;
                  background:#1b1813; border-radius:11px; color:#f3ead6; }
      .ask .send:hover{ background:#2c271d; } .ask .send:active{ transform:scale(.92); }
    </style>
    <button class="flower" title="用解语花解释">${camellia(24)}</button>
    <div class="card">
      <div class="head">${camellia(20)}<span class="name">解 语 花</span><button class="x" title="关闭">×</button></div>
      <div class="gold-line"></div>
      <div class="body"></div>
      <div class="ask">
        <textarea rows="1" placeholder="继续追问…"></textarea>
        <button class="send" title="发送"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 12l16-8-6 8 6 8z" fill="currentColor"/></svg></button>
      </div>
    </div>`);
  document.documentElement.appendChild(host);

  const flower = shadow.querySelector(".flower");
  const card = shadow.querySelector(".card");
  const body = shadow.querySelector(".body");
  const askInput = shadow.querySelector(".ask textarea");
  const askSend = shadow.querySelector(".ask .send");

  let anchor = { x: 0, y: 0 };
  let pendingText = "";
  let history = [];
  let streaming = false;

  function selText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return "";
    return (sel.toString() || "").trim();
  }
  function placeFixed(el, x, y, w, h) {
    const vw = innerWidth, vh = innerHeight;
    el.style.bottom = "auto";
    if (y > vh * 0.55) { el.style.top = "auto"; el.style.bottom = (vh - y + 12) + "px"; }
    else el.style.top = Math.min(y + 14, vh - h - 8) + "px";
    el.style.left = Math.max(8, Math.min(x - 24, vw - w - 8)) + "px";
  }

  document.addEventListener("mouseup", (e) => {
    if (e.composedPath && e.composedPath().includes(host)) return;
    setTimeout(() => {
      const t = selText();
      if (t) { pendingText = t; anchor = { x: e.clientX, y: e.clientY }; showFlower(); }
      else flower.style.display = "none";
    }, 10);
  });
  document.addEventListener("mousedown", (e) => {
    if (e.composedPath && e.composedPath().includes(host)) return;
    flower.style.display = "none";
    if (card.style.display === "block") closeCard();
  });
  document.addEventListener("scroll", () => { flower.style.display = "none"; }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { flower.style.display = "none"; closeCard(); } });

  function showFlower() {
    flower.style.display = "grid";
    const vw = innerWidth, vh = innerHeight;
    let bx = anchor.x + 8, by = anchor.y - 40;
    if (by < 4) by = anchor.y + 12;
    flower.style.left = Math.max(4, Math.min(bx, vw - 36)) + "px";
    flower.style.top = Math.max(4, Math.min(by, vh - 36)) + "px";
    flower.style.animation = "none"; void flower.offsetWidth; flower.style.animation = "";
  }

  flower.addEventListener("mousedown", (e) => e.preventDefault());
  flower.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    const t = pendingText || selText();
    if (!t) return;
    flower.style.display = "none";
    openCardForExplain(t);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "EXPLAIN_INLINE" && msg.text) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const r = sel.getRangeAt(0).getBoundingClientRect();
        anchor = { x: r.left + r.width / 2, y: r.bottom };
      }
      openCardForExplain(msg.text);
    }
  });

  function openCardForExplain(text) {
    history = [{
      role: "user",
      content: `请用简体中文清楚地解释下面这段内容,先给一句话概括,再展开说明:\n\n"""${text}"""`,
      display: text,
    }];
    card.style.display = "block";
    placeFixed(card, anchor.x, anchor.y, 344, Math.min(innerHeight * 0.6, 360));
    startStream();
  }

  function closeCard() {
    card.style.display = "none";
    history = [];
    streaming = false;
  }
  shadow.querySelector(".head .x").addEventListener("click", closeCard);

  // ---------- 健壮的流式请求:超时 + 断连兜底 ----------
  function startStream() {
    history.push({ role: "assistant", content: "" });
    streaming = true;
    render(true);
    const last = history[history.length - 1];
    const apiMsgs = history.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

    let settled = false, port = null, watchdog = null;
    const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => fail("请求超时(30 秒无响应)。请检查网络或接口地址后重试。"), 30000); };
    const cleanup = () => { clearTimeout(watchdog); try { port && port.disconnect(); } catch (_) {} };
    const fail = (m) => { if (settled) return; settled = true; streaming = false; last.content = ""; last.error = m; render(false); cleanup(); };
    const finish = () => { if (settled) return; settled = true; streaming = false; render(false); cleanup(); };

    try {
      port = chrome.runtime.connect({ name: "explain-stream" });
    } catch (e) {
      return fail("扩展刚更新过,请刷新当前网页后再试。");
    }
    arm();
    port.onMessage.addListener((m) => {
      if (m.type === "chunk") { arm(); last.content += m.text; render(true); }
      else if (m.type === "done") { finish(); }
      else if (m.type === "error") { fail(m.message); }
      else if (m.type === "need-key") { if (settled) return; settled = true; streaming = false; last.content = ""; last.needKey = true; render(false); cleanup(); }
    });
    port.onDisconnect.addListener(() => {
      if (settled) return;
      const le = chrome.runtime.lastError;
      fail(le ? "连接中断,请刷新当前网页后再试。" : "连接意外关闭,请重试。");
    });
    try { port.postMessage({ type: "start", messages: apiMsgs }); }
    catch (e) { fail("发送失败,请刷新当前网页后再试。"); }
  }

  function render(isStreaming) {
    let html = "";
    history.forEach((m, i) => {
      if (m.role === "user") {
        html += i === 0
          ? `<div class="quote">${esc(m.display || m.content)}</div>`
          : `<div class="ask-line">${esc(m.display || m.content)}</div>`;
      } else if (m.needKey) {
        html += `<div class="setup">还没设置 API Key。点 <button class="open">打开设置</button>,在齿轮里填好服务商和 Key 后再划词即可。</div>`;
      } else if (m.error) {
        html += `<div class="err">出错了:${esc(m.error)}</div>`;
      } else if (!m.content && isStreaming && i === history.length - 1) {
        html += `<div class="typing"><i></i><i></i><i></i></div>`;
      } else {
        html += `<div class="ans">${md(m.content)}</div>`;
      }
    });
    mountHTML(body, html);
    const openBtn = body.querySelector(".setup .open");
    if (openBtn) openBtn.addEventListener("click", () => chrome.runtime.sendMessage({ type: "OPEN_PANEL" }));
    body.scrollTop = body.scrollHeight;
  }

  function sendFollowUp() {
    const q = askInput.value.trim();
    if (!q || streaming) return;
    askInput.value = ""; askInput.style.height = "auto";
    history.push({ role: "user", content: q });
    startStream();
  }
  askSend.addEventListener("click", sendFollowUp);
  askInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendFollowUp(); } });
  askInput.addEventListener("input", () => { askInput.style.height = "auto"; askInput.style.height = Math.min(askInput.scrollHeight, 90) + "px"; });

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function md(src) {
    let s = esc(src);
    const blocks = [];
    s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, l, c) => { blocks.push(`<pre><code>${c.replace(/\n$/, "")}</code></pre>`); return `\u0000${blocks.length - 1}\u0000`; });
    s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    let out = "", listOpen = false;
    for (const line of s.split("\n")) {
      const li = line.match(/^\s*[-*]\s+(.*)/) || line.match(/^\s*\d+\.\s+(.*)/);
      if (li) { if (!listOpen) { out += "<ul>"; listOpen = true; } out += `<li>${li[1]}</li>`; }
      else { if (listOpen) { out += "</ul>"; listOpen = false; } if (line.trim() === "") out += ""; else if (/^\u0000\d+\u0000$/.test(line.trim())) out += line.trim(); else out += `<p>${line}</p>`; }
    }
    if (listOpen) out += "</ul>";
    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[i]);
  }
})();
