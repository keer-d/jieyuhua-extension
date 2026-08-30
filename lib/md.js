// lib/md.js — 轻量 Markdown 渲染 + 智能单词发音与一键收进书架体系。划词气泡和侧边栏共用。
// 核心动作：智能识别各种形式的 `word /ipa/`（包含带引号、粗体、反引号、括号等形式），自动构造成带有发音 🔊 与 📥 收录按钮的灵动徽牌。

var JYH_MD = (function () {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 国际音标全兼容匹配引擎（兼容：带引号 "word" /ipa/、**word** /ipa/、`word` /ipa/、word (/ipa/)、word [ipa] 等）
  const L = "\\p{L}\\p{M}";
  const WORD_CHARS = `[${L}](?:[${L}'\\u2019.\\-]|(?:\\s+[${L}])){0,45}?[${L}.]?`;
  const POS_RE = "(?:n\\.|v\\.|vt\\.|vi\\.|adj\\.|adv\\.|prep\\.|conj\\.|pron\\.|interj\\.|art\\.|num\\.|phr\\.|mod\\.|专有名词|名词|动词|形容词|副词|介词|连词|代词|感叹词|短语)";
  const IPA_FULL_RE = new RegExp(
    `["'“‘\`*]*(${WORD_CHARS})["'”’\`*]*\\s*(?:[:：\\-—–]\\s*)?(?:[\\(（\\[【]\\s*)?([\\/\\[][^\\/\\n<>\\[\\]]{1,48}[\\/\\]])[\\)）\\]】]?\\s*(?:(${POS_RE})\\s*)?`,
    "gu"
  );

  const SVG_SPEAK = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>';
  const SVG_SAVE = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M6 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6H6zm7 1.5L18.5 7H13V3.5zM6 4h5v7l2-1.2L15 11V4h1v16H6V4z"/></svg>';
  const SVG_SAVED = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';
  const SVG_EX = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h16v2H4v-2z"/></svg>';

  function chip(word, ipa, pos) {
    const wClean = esc(word.trim());
    let rawIpa = (ipa || "").trim();
    if (rawIpa.startsWith("[") && rawIpa.endsWith("]")) {
      rawIpa = "/" + rawIpa.slice(1, -1).trim() + "/";
    }
    const ipaClean = esc(rawIpa);
    const posClean = esc((pos || "").trim());
    return `<span class="w" data-word="${wClean}" data-ipa="${ipaClean}"${posClean ? ` data-pos="${posClean}"` : ""}>` +
           `<b>${wClean}</b>${ipaClean ? ` <i>${ipaClean}</i>` : ""}` +
           (posClean ? ` <span class="pos">${posClean}</span>` : "") +
           `<button type="button" class="spk" data-t="${wClean}" title="Pronounce" aria-label="Pronounce ${wClean}">${SVG_SPEAK}</button>` +
           `<button type="button" class="btn-word-ex" data-word="${wClean}" data-ipa="${ipaClean}" title="Example sentence" aria-label="Example for ${wClean}">${SVG_EX}</button>` +
           `<button type="button" class="btn-save-word" data-word="${wClean}" data-ipa="${ipaClean}" title="Save word to Vault" aria-label="Save to Vault">${SVG_SAVE}</button>` +
           `</span>`;
  }

  function render(src) {
    let s = esc(src || "");
    const blocks = [], chips = [];

    // 1. 代码块优先保护
    s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, l, c) => {
      blocks.push(`<pre><code>${c.replace(/\n$/, "")}</code></pre>`);
      return `\u0000${blocks.length - 1}\u0000`;
    });

    // 2. 单词 + 音标智能芯片化转换（先于通用 markdown，防止引号/粗体破坏结构）
    s = s.replace(IPA_FULL_RE, (_, w, ipa, pos) => {
      chips.push(chip(w.trim(), ipa, pos));
      return `\u0001${chips.length - 1}\u0001`;
    });

    // 3. 通用 Markdown 解析
    s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    let out = "", listOpen = false;
    for (const line of s.split("\n")) {
      const li = line.match(/^\s*[-*]\s+(.*)/) || line.match(/^\s*\d+\.\s+(.*)/);
      if (li) {
        if (!listOpen) { out += "<ul>"; listOpen = true; }
        out += `<li>${li[1]}</li>`;
      } else {
        if (listOpen) { out += "</ul>"; listOpen = false; }
        const t = line.trim();
        if (!t) continue;
        if (/^\u0000\d+\u0000$/.test(t)) out += t;
        else out += `<p>${line.replace(/^#{1,6}\s*/, "")}</p>`;
      }
    }
    if (listOpen) out += "</ul>";

    return out
      .replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[i])
      .replace(/\u0001(\d+)\u0001/g, (_, i) => chips[i]);
  }

  /* ---------- 发音 ---------- */
  const LANG_TAG = { en: "en-US", fr: "fr-FR" };
  let speakLang = "en";
  function setSpeakLang(lang) { if (lang) speakLang = lang; }

  function speak(text, lang) {
    try {
      const synth = window.speechSynthesis;
      if (!synth || !text) return;
      synth.cancel();
      const tag = LANG_TAG[lang || speakLang] || lang || speakLang || "en-US";
      const prefix = tag.slice(0, 2).toLowerCase();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = tag;
      u.rate = 0.92;
      const voices = synth.getVoices();
      const re = new RegExp(`^${prefix}`, "i");
      const v = voices.find((x) => re.test(x.lang) && /Google|Natural|Samantha|Aria|Amelie|Thomas|Audrey/i.test(x.name))
             || voices.find((x) => re.test(x.lang));
      if (v) u.voice = v;
      synth.speak(u);
    } catch (_) {}
  }
  function stop() { try { window.speechSynthesis?.cancel(); } catch (_) {} }

  function bindSpeakers(root) {
    root.querySelectorAll(".spk").forEach((b) => {
      if (b.dataset.bound) return;
      b.dataset.bound = "1";
      b.addEventListener("click", (e) => { e.stopPropagation(); speak(b.dataset.t); });
    });
  }

  /* ---------- 单词单独落入书架提取与绑定 ---------- */
  function extractWordMeta(btn) {
    const word = btn.dataset.word || "";
    const ipa = btn.dataset.ipa || "";
    const pos = btn.dataset.pos || "";
    const container = btn.closest(".w")?.parentElement || btn.closest("li, p, .msg") || btn.parentElement;
    let rawText = container ? container.textContent : "";
    rawText = rawText
      .replace(word, "")
      .replace(ipa, "")
      .replace(/[🔊📥✓✨]/g, "")
      .replace(/^[:：\s—–-]+/, "")
      .trim();

    let zh = "";
    let sense = "";

    const meanMatch = rawText.match(/(?:意为|意思是|指|翻译为|表示|means|meaning|defined as|refers to)[“"']?([^”"'\n]+)["']?/i);
    if (meanMatch) {
      zh = meanMatch[1].trim();
    }

    const parts = rawText.split(/[—–]/).map((s) => s.trim()).filter(Boolean);
    if (!zh && parts.length) {
      zh = parts[0].split(/[，,。；;]/)[0].trim();
      sense = parts[1] || "";
    }

    if (!zh) {
      zh = rawText.split(/[，,。；;]/)[0].trim().slice(0, 30);
    }
    if (pos && zh && !zh.startsWith(pos)) zh = `${pos} ${zh}`.trim();
    if (!sense && parts.length > 1) {
      sense = parts[1].slice(0, 60);
    } else if (!sense) {
      sense = rawText.slice(0, 60);
    }

    return { word, ipa, zh: zh.slice(0, 30), sense: sense.slice(0, 60), pos: (btn.dataset.pos || btn.closest(".w")?.dataset?.pos || "").trim() };
  }

  function extractWordFromChip(el) {
    const w = el?.closest?.(".w");
    if (!w) return extractWordMeta(el);
    return {
      word: w.dataset.word || "",
      ipa: w.dataset.ipa || "",
      pos: w.dataset.pos || "",
      zh: "",
      sense: "",
    };
  }

  function bindWordExamples(root, onExample) {
    root.querySelectorAll(".btn-word-ex").forEach((btn) => {
      if (btn.dataset.boundEx) return;
      btn.dataset.boundEx = "1";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!onExample) return;
        const meta = extractWordMeta(btn.closest(".w")?.querySelector(".btn-save-word") || btn);
        onExample(meta, btn);
      });
    });
  }

  function bindWordSavers(root, onSave) {
    root.querySelectorAll(".btn-save-word").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (btn.classList.contains("is-saved")) return;

        const meta = extractWordMeta(btn);
        btn.classList.add("is-saved");
        btn.innerHTML = SVG_SAVED;
        btn.title = "Saved to Vault";

        if (onSave) {
          try {
            await onSave(meta, btn);
          } catch (_) {}
        }
      });
    });
  }

  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.getVoices();

  return { render, speak, setSpeakLang, stop, bindSpeakers, bindWordSavers, bindWordExamples, extractWordMeta, extractWordFromChip, chip, esc, SVG_SPEAK, SVG_SAVE, SVG_SAVED, SVG_EX };
})();

if (typeof module !== "undefined") module.exports = JYH_MD;
