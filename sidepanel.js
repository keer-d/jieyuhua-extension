// sidepanel.js —— 侧边栏逻辑

/* ============ 服务商预设 ============ */
const PRESETS = {
  openai:     { baseUrl: "https://api.openai.com/v1",                         model: "gpt-4o-mini",                  format: "openai" },
  deepseek:   { baseUrl: "https://api.deepseek.com/v1",                       model: "deepseek-chat",                format: "openai" },
  moonshot:   { baseUrl: "https://api.moonshot.cn/v1",                        model: "moonshot-v1-8k",               format: "openai" },
  zhipu:      { baseUrl: "https://open.bigmodel.cn/api/paas/v4",              model: "glm-4-plus",                   format: "openai" },
  doubao:     { baseUrl: "https://ark.cn-beijing.volces.com/api/v3",          model: "doubao-seed-1-6-251015",       format: "openai" },
  qwen:       { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus",                    format: "openai" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1",                      model: "openai/gpt-4o-mini",           format: "openai" },
  anthropic:  { baseUrl: "https://api.anthropic.com/v1",                      model: "claude-3-5-sonnet-20241022",   format: "anthropic" },
  custom:     { baseUrl: "https://api.openai.com/v1",                         model: "gpt-4o-mini",                  format: "openai" },
};

/* ============ DOM ============ */
const $ = (id) => document.getElementById(id);
const chatView = $("chatView");
const settingsView = $("settingsView");
const messagesEl = $("messages");
const emptyState = $("emptyState");
const inputEl = $("input");
const sendBtn = $("sendBtn");

/* ============ 会话状态 ============ */
let history = [];        // [{role:'user'|'assistant', content:'...'}]
let settings = {};
let streaming = false;

/* ============ 初始化 ============ */
init();

async function init() {
  settings = await loadSettings();
  fillSettingsForm(settings);
  bindEvents();
  await checkPendingSelection();
}

/* ============ 设置存取 ============ */
async function loadSettings() {
  const data = await chrome.storage.local.get("settings");
  return Object.assign(
    { provider: "openai", apiKey: "", model: "", baseUrl: "", systemPrompt: "" },
    data.settings || {}
  );
}
async function saveSettings(s) {
  await chrome.storage.local.set({ settings: s });
}
function fillSettingsForm(s) {
  $("provider").value = s.provider || "openai";
  $("apiKey").value = s.apiKey || "";
  $("model").value = s.model || PRESETS[s.provider || "openai"].model;
  $("baseUrl").value = s.baseUrl || PRESETS[s.provider || "openai"].baseUrl;
  $("systemPrompt").value = s.systemPrompt || "";
}

/* ============ 事件绑定 ============ */
function bindEvents() {
  $("settingsBtn").addEventListener("click", toggleSettings);
  $("newChatBtn").addEventListener("click", newChat);
  $("saveBtn").addEventListener("click", onSave);

  $("provider").addEventListener("change", (e) => {
    const p = PRESETS[e.target.value];
    if (p) {
      $("baseUrl").value = p.baseUrl;
      if (!$("model").value.trim()) $("model").value = p.model;
    }
  });

  sendBtn.addEventListener("click", onSend);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  });
  inputEl.addEventListener("input", autoGrow);

  // 侧边栏已打开时,后台推送来的新划词
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "NEW_SELECTION" && msg.payload) {
      explainSelection(msg.payload);
    }
  });
}

function autoGrow() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
}

function toggleSettings() {
  const showSettings = settingsView.classList.contains("hidden");
  settingsView.classList.toggle("hidden", !showSettings);
  chatView.classList.toggle("hidden", showSettings);
}

async function onSave() {
  settings = {
    provider: $("provider").value,
    apiKey: $("apiKey").value.trim(),
    model: $("model").value.trim() || PRESETS[$("provider").value].model,
    baseUrl: ($("baseUrl").value.trim() || PRESETS[$("provider").value].baseUrl).replace(/\/+$/, ""),
    systemPrompt: $("systemPrompt").value.trim(),
  };
  await saveSettings(settings);
  const hint = $("saveHint");
  hint.textContent = "已保存 ✓";
  setTimeout(() => (hint.textContent = ""), 1800);
  setTimeout(toggleSettings, 500);
}

/* ============ 划词解释 ============ */
async function checkPendingSelection() {
  const { pendingSelection } = await chrome.storage.local.get("pendingSelection");
  if (pendingSelection && Date.now() - pendingSelection.ts < 15000) {
    await chrome.storage.local.remove("pendingSelection");
    explainSelection(pendingSelection);
  }
}

function explainSelection(payload) {
  const text = (payload.text || "").trim();
  if (!text) return;
  // 显示来源上下文小标签
  const chip = document.createElement("div");
  chip.className = "context-chip";
  chip.textContent = "选中内容:" + text;
  ensureChatVisible();
  hideEmpty();
  messagesEl.appendChild(chip);
  const prompt = `请用简体中文清楚地解释下面这段内容,先给一句话概括,再展开说明:\n\n"""${text}"""`;
  send(prompt, `请解释:${text.slice(0, 40)}${text.length > 40 ? "…" : ""}`);
}

/* ============ 发送消息 ============ */
function onSend() {
  const val = inputEl.value.trim();
  if (!val || streaming) return;
  inputEl.value = "";
  autoGrow();
  send(val);
}

async function send(content, displayText) {
  if (!settings.apiKey) {
    addError("还没有填写 API Key,请先点右上角齿轮进入设置。");
    toggleSettings();
    return;
  }
  ensureChatVisible();
  hideEmpty();

  history.push({ role: "user", content });
  addBubble("user", displayText || content);

  const aiBubble = addBubble("ai", "");
  aiBubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  streaming = true;
  sendBtn.disabled = true;

  try {
    let full = "";
    await streamChat(history, (chunk) => {
      full += chunk;
      aiBubble.innerHTML = renderMarkdown(full);
      scrollToBottom();
    });
    if (!full.trim()) {
      aiBubble.innerHTML = renderMarkdown("(模型没有返回内容)");
    } else {
      history.push({ role: "assistant", content: full });
    }
  } catch (err) {
    aiBubble.outerHTML = `<div class="msg ai"><div class="error-note">出错了:${escapeHtml(err.message || String(err))}</div></div>`;
  } finally {
    streaming = false;
    sendBtn.disabled = false;
    scrollToBottom();
  }
}

/* ============ 流式请求 ============ */
async function streamChat(msgs, onChunk) {
  const fmt = PRESETS[settings.provider]?.format || "openai";
  return fmt === "anthropic"
    ? streamAnthropic(msgs, onChunk)
    : streamOpenAI(msgs, onChunk);
}

async function streamOpenAI(msgs, onChunk) {
  const body = {
    model: settings.model,
    stream: true,
    messages: settings.systemPrompt
      ? [{ role: "system", content: settings.systemPrompt }, ...msgs]
      : msgs,
  };
  const res = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await safeErr(res)}`);

  await readSSE(res, (data) => {
    if (data === "[DONE]") return;
    try {
      const json = JSON.parse(data);
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) onChunk(delta);
    } catch (_) {}
  });
}

async function streamAnthropic(msgs, onChunk) {
  const body = {
    model: settings.model,
    max_tokens: 2048,
    stream: true,
    messages: msgs,
  };
  if (settings.systemPrompt) body.system = settings.systemPrompt;

  const res = await fetch(`${settings.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await safeErr(res)}`);

  await readSSE(res, (data) => {
    try {
      const json = JSON.parse(data);
      if (json.type === "content_block_delta" && json.delta?.text) {
        onChunk(json.delta.text);
      }
    } catch (_) {}
  });
}

// 通用 SSE 读取:按 "data: " 行解析
async function readSSE(res, handleData) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        handleData(trimmed.slice(5).trim());
      }
    }
  }
}

async function safeErr(res) {
  try {
    const t = await res.text();
    return t.slice(0, 300);
  } catch {
    return res.statusText;
  }
}

/* ============ 渲染 ============ */
function addBubble(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  const label = role === "user" ? "你" : "解语花";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (role === "ai") bubble.innerHTML = renderMarkdown(text);
  else bubble.textContent = text;
  wrap.innerHTML = `<div class="msg-role">${label}</div>`;
  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  scrollToBottom();
  return bubble;
}

function addError(text) {
  ensureChatVisible();
  hideEmpty();
  const wrap = document.createElement("div");
  wrap.className = "msg ai";
  wrap.innerHTML = `<div class="error-note">${escapeHtml(text)}</div>`;
  messagesEl.appendChild(wrap);
  scrollToBottom();
}

function newChat() {
  history = [];
  messagesEl.innerHTML = "";
  messagesEl.appendChild(emptyState);
  emptyState.style.display = "";
}
function hideEmpty() { if (emptyState) emptyState.style.display = "none"; }
function ensureChatVisible() {
  settingsView.classList.add("hidden");
  chatView.classList.remove("hidden");
}
function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

/* 轻量 Markdown:转义后处理 代码块/行内代码/加粗/列表/段落 */
function renderMarkdown(src) {
  let s = escapeHtml(src);
  const blocks = [];
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    blocks.push(`<pre><code>${code.replace(/\n$/, "")}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  const lines = s.split("\n");
  let html = "", listOpen = false;
  for (let line of lines) {
    const li = line.match(/^\s*[-*]\s+(.*)/);
    const ol = line.match(/^\s*\d+\.\s+(.*)/);
    if (li || ol) {
      if (!listOpen) { html += "<ul>"; listOpen = true; }
      html += `<li>${(li || ol)[1]}</li>`;
    } else {
      if (listOpen) { html += "</ul>"; listOpen = false; }
      if (line.trim() === "") html += "";
      else if (/^\u0000\d+\u0000$/.test(line.trim())) html += line.trim();
      else html += `<p>${line}</p>`;
    }
  }
  if (listOpen) html += "</ul>";
  html = html.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[i]);
  return html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
