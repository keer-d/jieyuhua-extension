// lib/stream.js — Shared OpenAI-compatible streaming helpers (sidepanel + service worker).

var JYH_STREAM = (function () {
  function resolveCfg(s) {
    return {
      baseUrl: (s.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, ""),
      model: s.model || "gpt-4o-mini",
      apiKey: s.apiKey || "",
      extra: s.systemPrompt || "",
    };
  }

  function openaiHeaders(cfg) {
    const h = { "Content-Type": "application/json" };
    if (cfg.apiKey) h.Authorization = `Bearer ${cfg.apiKey.trim()}`;
    return h;
  }

  function chatUrl(cfg) {
    return `${cfg.baseUrl}/chat/completions`;
  }

  function withModelName(system, cfg) {
    const name = cfg.model || "OpenAI GPT";
    return `${system}\n\n当前模型：${name}。`;
  }

  function systemFor(mode, extra) {
    const base = mode === "long" ? JYH_PROMPTS.SYSTEM_LONG : JYH_PROMPTS.SYSTEM_BASE;
    return extra ? `${base}\n\n用户附加要求：${extra}` : base;
  }

  function prepareExplain({ mode, messages, rawFirst, tenseSource, wordExample, extra, lang }) {
    const msgs = (messages || []).map((m) => ({ role: m.role, content: m.content }));

    if (mode === "tense" && msgs.length) {
      const sentence = tenseSource || rawFirst || msgs.filter((m) => m.role === "user").pop()?.content || "";
      msgs[msgs.length - 1].content = JYH_PROMPTS.tenseAnalysis(sentence, lang);
    } else if (mode === "word-example" && wordExample && msgs.length) {
      const w = wordExample;
      msgs[msgs.length - 1].content = JYH_PROMPTS.wordExample(w.word, w.context, lang, w.ipa);
    } else if (rawFirst && msgs[0]) {
      msgs[0].content = JYH_PROMPTS.explain(rawFirst, lang);
    }

    const system = rawFirst && mode === "explain"
      ? (JYH_PROMPTS.SYSTEM_EXPLAIN + (extra ? `\n\n用户附加要求：${extra}` : ""))
      : mode === "tense"
        ? (JYH_PROMPTS.SYSTEM_EXPLAIN + "\n\n你是法语时态专家，只输出准确时态分析。" + (extra ? `\n\n用户附加要求：${extra}` : ""))
        : systemFor(mode, extra);

    return { system, messages: msgs };
  }

  async function fetchWithTimeout(url, options, ms = 45000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("Request timed out (45s). Please check your network/proxy, API Key, and Base URL.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
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
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith("data:")) handle(t.slice(5).trim());
      }
    }
  }

  async function safeErr(res) {
    try {
      const text = await res.text();
      try {
        const j = JSON.parse(text);
        if (j.error?.message) return j.error.message;
      } catch (_) {}
      return text.slice(0, 300);
    } catch {
      return res.statusText;
    }
  }

  async function streamOpenAI(cfg, system, msgs, onChunk) {
    const payload = {
      model: cfg.model,
      stream: true,
      max_tokens: 1200,
      messages: [{ role: "system", content: system }, ...msgs],
    };
    let res = await fetchWithTimeout(chatUrl(cfg), {
      method: "POST",
      headers: openaiHeaders(cfg),
      body: JSON.stringify(payload),
    }, 45000);

    if (!res.ok) {
      payload.stream = false;
      res = await fetchWithTimeout(chatUrl(cfg), {
        method: "POST",
        headers: openaiHeaders(cfg),
        body: JSON.stringify(payload),
      }, 45000);
      if (!res.ok) throw new Error(`${res.status} ${await safeErr(res)}`);
      const j = await res.json();
      const text = j.choices?.[0]?.message?.content || "";
      if (text) onChunk(text);
      return;
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/event-stream") && !ct.includes("ndjson")) {
      try {
        const j = await res.json();
        const text = j.choices?.[0]?.message?.content || "";
        if (text) onChunk(text);
        return;
      } catch (_) {}
    }

    await readSSE(res, (data) => {
      if (data === "[DONE]") return;
      try {
        const d = JSON.parse(data).choices?.[0]?.delta?.content;
        if (d) onChunk(d);
      } catch (_) {}
    });
  }

  function keepAliveDuring(promise) {
    const tick = () => {
      try { chrome.runtime.getPlatformInfo(() => {}); } catch (_) {}
    };
    tick();
    const id = setInterval(tick, 15000);
    return Promise.resolve(promise).finally(() => clearInterval(id));
  }

  return {
    resolveCfg,
    withModelName,
    systemFor,
    prepareExplain,
    streamOpenAI,
    keepAliveDuring,
    fetchWithTimeout,
    openaiHeaders,
    chatUrl,
    safeErr,
    completeOnce: async (cfg, system, user, maxTokens = 4096, temperature) => {
      const body = {
        model: cfg.model,
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      };
      if (typeof temperature === "number") body.temperature = temperature;
      const res = await fetchWithTimeout(chatUrl(cfg), {
        method: "POST",
        headers: openaiHeaders(cfg),
        body: JSON.stringify(body),
      }, 45000);
      if (!res.ok) throw new Error(`${res.status} ${await safeErr(res)}`);
      const j = await res.json();
      return j.choices?.[0]?.message?.content || "";
    },
  };
})();
