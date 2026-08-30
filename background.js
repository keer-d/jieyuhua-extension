// background.js — Service worker：右键菜单、流式对话、JSON 任务（分析／出题／批改）、网页正文抓取。
// 专精 OpenAI GPT 接口，稳定持久，永久记忆 API Key。

importScripts("lib/prompts.js", "lib/fr-grammar.js", "lib/en-grammar.js", "lib/store.js", "lib/stream.js");

const MENU_EXPLAIN = "jieyuhua-explain";
const MENU_SAVE = "jieyuhua-save";
const MENU_FILL = "jieyuhua-fill";

const DEFAULT_CONFIG = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
  hoverModel: "gpt-4o-mini",
  baseUrl: "https://api.openai.com/v1",
  systemPrompt: "",
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_EXPLAIN, title: 'FluentLoop: Explain "%s"', contexts: ["selection"] });
    chrome.contextMenus.create({ id: MENU_SAVE, title: "FluentLoop: Save to Vault", contexts: ["selection"] });
    chrome.contextMenus.create({ id: MENU_FILL, title: "FluentLoop: Fill Input", contexts: ["selection"] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab?.id == null || !info.selectionText) return;
  if (info.menuItemId === MENU_EXPLAIN) {
    chrome.tabs.sendMessage(tab.id, { type: "EXPLAIN_INLINE", text: info.selectionText }).catch(() => {});
  } else if (info.menuItemId === MENU_SAVE) {
    chrome.tabs.sendMessage(tab.id, { type: "SAVE_INLINE", text: info.selectionText }).catch(() => {});
  } else if (info.menuItemId === MENU_FILL) {
    chrome.storage.local.set({ pendingComposer: info.selectionText, pendingComposerAppend: true }).catch(() => {});
    chrome.runtime.sendMessage({ type: "FILL_COMPOSER", text: info.selectionText, append: true }).catch(() => {});
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }
});

/* ============ 设置与 Key 永久持久化 ============ */
async function loadSettings() {
  try {
    const d = await chrome.storage.local.get(["settings", "openai_api_key_backup"]);
    const s = Object.assign({}, DEFAULT_CONFIG, d.settings || {});
    // 双重保险：如果 settings 里的 key 丢了，自动从备份恢复
    if (!s.apiKey && d.openai_api_key_backup) {
      s.apiKey = d.openai_api_key_backup;
      await chrome.storage.local.set({ settings: s });
    } else if (s.apiKey && s.apiKey !== d.openai_api_key_backup) {
      await chrome.storage.local.set({ openai_api_key_backup: s.apiKey });
    }
    return s;
  } catch (_) {
    return Object.assign({}, DEFAULT_CONFIG);
  }
}

function resolve(s) { return JYH_STREAM.resolveCfg(s); }

function needsKey(s) {
  return !s.apiKey || !s.apiKey.trim();
}

function withModelName(system, cfg) { return JYH_STREAM.withModelName(system, cfg); }

function systemFor(mode, extra) { return JYH_STREAM.systemFor(mode, extra); }

async function fetchWithTimeout(url, options, ms = 45000) {
  return JYH_STREAM.fetchWithTimeout(url, options, ms);
}

/* ============ 流式对话（长连接 Port） ============ */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "explain-stream") return;
  port.onMessage.addListener(async (msg) => {
    if (msg?.type !== "start") return;
    let finished = false;
    const finish = (payload) => {
      if (finished) return;
      finished = true;
      post(port, payload);
    };
    try {
      const s = await loadSettings();
      if (needsKey(s)) return finish({ type: "need-key" });
      const cfg = resolve(s);
      const explainLang = await JYH_STORE.getLang();
      const prepared = JYH_STREAM.prepareExplain({
        mode: msg.mode,
        messages: msg.messages,
        rawFirst: msg.rawFirst,
        tenseSource: msg.tenseSource,
        wordExample: msg.wordExample,
        extra: cfg.extra,
        lang: explainLang,
      });
      await JYH_STREAM.keepAliveDuring(
        JYH_STREAM.streamOpenAI(cfg, withModelName(prepared.system, cfg), prepared.messages, (chunk) => {
          post(port, { type: "chunk", text: chunk });
        })
      );
      finish({ type: "done" });
    } catch (err) {
      finish({ type: "error", message: err.message || String(err) });
    }
  });
});
function post(port, data) { try { port.postMessage(data); } catch (_) {} }

/* ============ 一次性消息 ============ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "OPEN_PANEL") {
    if (sender.tab?.id != null) chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
    return false;
  }
  if (msg?.type === "OPEN_STUDY") {
    const url = chrome.runtime.getURL("study.html") + (msg.cardId ? `#card=${msg.cardId}` : "");
    chrome.tabs.create({ url }).catch(() => {});
    return false;
  }
  if (msg?.type === "AI_JSON") {
    handleJSON(msg).then(sendResponse).catch((e) => sendResponse({ ok: false, error: errText(e) }));
    return true;
  }
  if (msg?.type === "SAVE_SELECTION") {
    saveSelection(msg, sender).then(sendResponse).catch((e) => sendResponse({ ok: false, error: errText(e) }));
    return true;
  }
  if (msg?.type === "SAVE_SINGLE_WORD") {
    const row = {
      en: String(msg.word || "").trim(),
      ipa: msg.ipa || "",
      zh: msg.zh || "",
      sense: msg.sense || "",
      example: (msg.example || "").slice(0, 300),
      url: msg.url || sender.tab?.url || "",
      pageTitle: msg.pageTitle || sender.tab?.title || "",
      tags: ["Saved Words"],
    };
    JYH_STORE.addLookup(row).then((card) => sendResponse({ ok: true, card })).catch((e) => sendResponse({ ok: false, error: errText(e) }));
    return true;
  }
  if (msg?.type === "HOVER_WORD") {
    hoverWord(msg, sender).then(sendResponse).catch((e) => sendResponse({ ok: false, error: errText(e) }));
    return true;
  }
  if (msg?.type === "FILL_COMPOSER") {
    const text = String(msg.text || "").trim();
    if (text) {
      const append = msg.append !== false;
      chrome.storage.local.set({ pendingComposer: text, pendingComposerAppend: append }).catch(() => {});
      chrome.runtime.sendMessage({ type: "FILL_COMPOSER", text, append }).catch(() => {});
      if (msg.open && sender.tab?.id != null) chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
    }
    sendResponse({ ok: true });
    return false;
  }
  if (msg?.type === "LOG_LOOKUP") {
    JYH_STORE.addLookup(msg).then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: errText(e) }));
    return true;
  }
  if (msg?.type === "PAGE_TEXT") {
    grabPageText(msg.tabId).then(sendResponse).catch((e) => sendResponse({ ok: false, error: errText(e) }));
    return true;
  }
  return false;
});

const errText = (e) => e?.message || String(e);

/* ============ JSON Task: Analysis / Quiz / Grading / Summary ============ */
async function handleJSON(msg) {
  const s = await loadSettings();
  if (needsKey(s)) return { ok: false, error: "OpenAI API Key is missing. Please click Settings (top right) to enter your Key." };
  const cfg = resolve(s);
  const p = msg.payload || {};

  let prompt, wantJSON = true;
  const lang = await JYH_STORE.getLang();
  if (msg.task === "analyze") prompt = JYH_PROMPTS.analyze(p.text, p.existingTags || [], lang);
  else if (msg.task === "study") prompt = JYH_PROMPTS.study(p.text, p.existingTags || [], lang);
  else if (msg.task === "distill") prompt = JYH_PROMPTS.distill(p.text, p.existingTags || [], lang);
  else if (msg.task === "quiz") prompt = JYH_PROMPTS.quiz(p.cards || [], p.count || 6, p.avoid || []);
  else if (msg.task === "grade") prompt = JYH_PROMPTS.grade(p.question, p.reference, p.userAnswer, p.kind);
  else if (msg.task === "summarize") { prompt = JYH_PROMPTS.summarize(p.text); wantJSON = false; }
  else return { ok: false, error: "Unknown task: " + msg.task };

  const maxTokens = msg.task === "study" ? 8192 : msg.task === "quiz" ? 2500 : 4096;
  const raw = await JYH_STREAM.completeOnce(cfg, "You are a precise data generator. Output only requested content.", prompt, maxTokens, 0.3);
  if (!wantJSON) return { ok: true, data: raw.trim() };

  const data = parseJSON(raw);
  if (!data) return { ok: false, error: "Model did not return valid JSON. Please try again." };
  if ((msg.task === "analyze" || msg.task === "study" || msg.task === "distill") && Array.isArray(data.words) && lang === "en" && typeof JYH_EN !== "undefined") {
    data.words = JYH_EN.filterHardWords(data.words);
  }
  return { ok: true, data };
}

function parseJSON(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0);
  if (!starts.length) return null;
  const first = Math.min(...starts);
  const last = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (last <= first) return null;
  try { return JSON.parse(cleaned.slice(first, last + 1)); } catch (_) { return null; }
}

/* ============ 划词直接入库 ============ */
async function saveSelection(msg, sender) {
  const existingTags = await JYH_STORE.allTags();
  const task = msg.deep ? "study" : "analyze";
  const res = await handleJSON({ task, payload: { text: msg.text, existingTags } });
  if (!res.ok) return res;
  const d = res.data;
  const card = await JYH_STORE.addCard({
    title: d.title, summary: d.summary, tags: d.tags,
    words: d.words, concepts: d.concepts,
    bilingual: d.bilingual, grammar: d.grammar, cloze: d.cloze,
    inflect: d.inflect, translate: d.translate, makeup: d.makeup,
    excerpt: msg.text,
    url: msg.url || sender.tab?.url || "",
    pageTitle: msg.pageTitle || sender.tab?.title || "",
  });
  return { ok: true, card };
}

/* ============ 悬浮取词：缓存优先，短请求 ============ */
const HOVER_DICT_KEY = "hoverDict";
const HOVER_DICT_CAP = 1200;

function parseHoverLine(word, line) {
  const ipaM = String(line || "").match(/\/[^/]{1,40}\//);
  const ipa = ipaM ? ipaM[0] : "";
  let rest = String(line || "").replace(/^.*?\/[^/]+\//, "").trim();
  const posM = rest.match(/^(n\.|v\.|vt\.|vi\.|adj\.|adv\.|prep\.|conj\.|pron\.|interj\.|art\.|num\.|phr\.|mod\.|专有名词|名词|动词|形容词|副词|介词|连词|代词|感叹词|短语)\s*/);
  const pos = posM ? posM[1] : "";
  if (pos) rest = rest.slice(posM[0].length).trim();
  const parts = rest.split(/[—–]/).map((s) => s.trim()).filter(Boolean);
  const zhRaw = (parts[0] || rest).slice(0, 20);
  return {
    en: word,
    ipa,
    pos,
    zh: pos ? `${pos} ${zhRaw}`.trim().slice(0, 24) : zhRaw,
    sense: (parts[1] || "").slice(0, 30),
    example: "",
  };
}

async function readHoverDict(key) {
  try {
    const d = await chrome.storage.local.get(HOVER_DICT_KEY);
    return d[HOVER_DICT_KEY]?.[key] || null;
  } catch (_) { return null; }
}
async function writeHoverDict(key, text) {
  try {
    const d = await chrome.storage.local.get(HOVER_DICT_KEY);
    const dict = d[HOVER_DICT_KEY] && typeof d[HOVER_DICT_KEY] === "object" ? d[HOVER_DICT_KEY] : {};
    dict[key] = text;
    const keys = Object.keys(dict);
    if (keys.length > HOVER_DICT_CAP) keys.slice(0, keys.length - HOVER_DICT_CAP).forEach((k) => delete dict[k]);
    await chrome.storage.local.set({ [HOVER_DICT_KEY]: dict });
  } catch (_) {}
}

async function hoverWord(msg, sender) {
  const word = String(msg.word || "").trim();
  if (!word) return { ok: false, error: "empty" };
  const key = word.toLowerCase();
  const cached = await readHoverDict(key);
  if (cached) {
    const parsed = parseHoverLine(word, cached);
    parsed.example = (msg.context || "").slice(0, 200);
    parsed.url = sender?.tab?.url || "";
    parsed.pageTitle = sender?.tab?.title || "";
    const lang = await JYH_STORE.getLang();
    const row = lang === "fr" ? JYH_FR.normalizeWord(parsed, lang) : parsed;
    JYH_STORE.addLookup(row).catch(() => {});
    return { ok: true, text: cached, cached: true };
  }

  const s = await loadSettings();
  if (needsKey(s)) return { ok: false, error: "no-key" };
  const cfg = resolve(s);
  if (s.hoverModel) cfg.model = s.hoverModel;
  const lang = await JYH_STORE.getLang();
  const prompt = JYH_PROMPTS.hover(word, msg.context, lang);
  const text = (await JYH_STREAM.completeOnce(cfg, "Output only the single requested line, nothing else.", prompt, 120, 0)).trim().split("\n")[0];
  await writeHoverDict(key, text);
  const parsed = parseHoverLine(word, text);
  parsed.example = (msg.context || "").slice(0, 200);
  parsed.url = sender?.tab?.url || "";
  parsed.pageTitle = sender?.tab?.title || "";
  const row = lang === "fr" ? JYH_FR.normalizeWord(parsed, lang) : parsed;
  JYH_STORE.addLookup(row).catch(() => {});
  return { ok: true, text };
}

/* ============ Grab Active Page Content ============ */
async function grabPageText(tabId) {
  const tab = tabId != null
    ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.id) return { ok: false, error: "Current tab not found." };

  const [hit] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const pick = document.querySelector("article, main, [role=main]") || document.body;
      return (pick.innerText || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 20000);
    },
  });
  const text = hit?.result;
  if (!text) return { ok: false, error: "Cannot extract readable text from this page. Try another page or select text manually." };
  return { ok: true, text, url: tab.url, pageTitle: tab.title };
}
