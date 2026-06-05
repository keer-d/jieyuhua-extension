// background.js —— Service Worker:右键菜单 + 为内联气泡做流式请求(带健壮的错误回传)

const MENU_ID = "jieyuhua-explain";

const PRESETS = {
  openai:     { baseUrl: "https://api.openai.com/v1",                         model: "gpt-4o-mini",                format: "openai" },
  deepseek:   { baseUrl: "https://api.deepseek.com/v1",                       model: "deepseek-chat",              format: "openai" },
  moonshot:   { baseUrl: "https://api.moonshot.cn/v1",                        model: "moonshot-v1-8k",             format: "openai" },
  zhipu:      { baseUrl: "https://open.bigmodel.cn/api/paas/v4",              model: "glm-4-plus",                 format: "openai" },
  doubao:     { baseUrl: "https://ark.cn-beijing.volces.com/api/v3",          model: "doubao-seed-1-6-251015",     format: "openai" },
  qwen:       { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus",                  format: "openai" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1",                      model: "openai/gpt-4o-mini",         format: "openai" },
  anthropic:  { baseUrl: "https://api.anthropic.com/v1",                      model: "claude-3-5-sonnet-20241022", format: "anthropic" },
  custom:     { baseUrl: "https://api.openai.com/v1",                         model: "gpt-4o-mini",                format: "openai" },
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.contextMenus.create({ id: MENU_ID, title: "用解语花解释「%s」", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText || tab?.id == null) return;
  chrome.tabs.sendMessage(tab.id, { type: "EXPLAIN_INLINE", text: info.selectionText }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "OPEN_PANEL" && sender.tab?.id != null) {
    chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
  }
});

/* ============ 流式请求(经长连接 Port 推回内容脚本) ============ */
async function loadSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return Object.assign(
    { provider: "openai", apiKey: "", model: "", baseUrl: "", systemPrompt: "" },
    settings || {}
  );
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "explain-stream") return;
  port.onMessage.addListener(async (msg) => {
    if (msg?.type !== "start") return;
    // 整个流程包在 try 里,确保任何异常都会回传,绝不让气泡无限 load
    try {
      const s = await loadSettings();
      if (!s.apiKey) { post(port, { type: "need-key" }); return; }
      const preset = PRESETS[s.provider] || PRESETS.openai;
      const cfg = {
        format: preset.format,
        baseUrl: (s.baseUrl || preset.baseUrl).replace(/\/+$/, ""),
        model: s.model || preset.model,
        apiKey: s.apiKey,
        systemPrompt: s.systemPrompt,
      };
      await streamChat(cfg, msg.messages, (chunk) => post(port, { type: "chunk", text: chunk }));
      post(port, { type: "done" });
    } catch (err) {
      post(port, { type: "error", message: err.message || String(err) });
    }
  });
});

function post(port, data) { try { port.postMessage(data); } catch (_) {} }

async function streamChat(cfg, msgs, onChunk) {
  return cfg.format === "anthropic"
    ? streamAnthropic(cfg, msgs, onChunk)
    : streamOpenAI(cfg, msgs, onChunk);
}

async function streamOpenAI(cfg, msgs, onChunk) {
  const body = {
    model: cfg.model,
    stream: true,
    messages: cfg.systemPrompt ? [{ role: "system", content: cfg.systemPrompt }, ...msgs] : msgs,
  };
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await safeErr(res)}`);
  await readSSE(res, (data) => {
    if (data === "[DONE]") return;
    try { const d = JSON.parse(data).choices?.[0]?.delta?.content; if (d) onChunk(d); } catch (_) {}
  });
}

async function streamAnthropic(cfg, msgs, onChunk) {
  const body = { model: cfg.model, max_tokens: 2048, stream: true, messages: msgs };
  if (cfg.systemPrompt) body.system = cfg.systemPrompt;
  const res = await fetch(`${cfg.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await safeErr(res)}`);
  await readSSE(res, (data) => {
    try { const j = JSON.parse(data); if (j.type === "content_block_delta" && j.delta?.text) onChunk(j.delta.text); } catch (_) {}
  });
}

async function readSSE(res, handle) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) { const t = line.trim(); if (t.startsWith("data:")) handle(t.slice(5).trim()); }
  }
}

async function safeErr(res) {
  try { return (await res.text()).slice(0, 300); } catch { return res.statusText; }
}
