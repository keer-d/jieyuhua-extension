// lib/quiz.js — Context-first practice questions for SM-2 review.
// Prefer: word-in-sentence cloze, phrase meaning in context.
// Drop isolated definition matching and spelling-from-IPA.

var JYH_QUIZ = (function () {
  const escapeRe = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordRe = (w) => new RegExp(`(?<![\\p{L}\\p{M}])${escapeRe(w)}(?![\\p{L}\\p{M}])`, "iu");
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
  const sample = (a, n) => shuffle(a).slice(0, n);
  const uniq = (a) => [...new Set(a)];

  function gloss(zh) {
    return String(zh || "")
      .replace(/（.*?）/g, "")
      .replace(/\(.*?\)/g, "")
      .split(/[;；。]/)[0]
      .trim()
      .slice(0, 28);
  }

  function cleanEn(en) {
    return String(en || "")
      .replace(/^[\s\u4e00-\u9fff的了着过，。：:]+/g, "")
      .replace(/^是\s+/u, "")
      .trim();
  }

  function isPhrase(en) {
    return cleanEn(en).split(/\s+/).filter(Boolean).length >= 2;
  }

  function isJunkGloss(g) {
    const s = String(g || "").trim();
    if (s.length < 2 || s.length > 36) return true;
    if (/^(是|的|在|这|那|它|和|或|一个|这个|那个)$/.test(s)) return true;
    if (/这句话|这个话语|在这句|在这个话语|自动收录|搜词本|生词本/.test(s)) return true;
    if (/^[\s/.,;:：、]+$/.test(s)) return true;
    return false;
  }

  function isValidExample(ex, w) {
    if (!ex || typeof ex !== "string") return false;
    const s = ex.trim();
    if (s.length < 12) return false;
    if (/自动收录|搜词本|生词本|浏览网页|看视频|学习材料|词汇|经阁/.test(s)) return false;
    if (!/[a-zA-ZÀ-ÿ]{3,}/.test(s)) return false;
    if (!w) return true;
    const head = cleanEn(w);
    if (!head) return true;
    return wordRe(head).test(s) || s.toLowerCase().includes(head.toLowerCase());
  }

  function isUsableWord(w) {
    const en = cleanEn(w?.en);
    if (en.length < 2) return false;
    if (/^[\u4e00-\u9fff]/.test(en)) return false;
    if (en.split(/\s+/).length > 10) return false;
    return true;
  }

  function meaningOf(w) {
    if (!w) return "";
    const sense = gloss(w.sense);
    if (sense && !isJunkGloss(sense)) return sense;
    const zh = gloss(w.zh);
    if (zh && !isJunkGloss(zh)) return zh;
    const raw = String(w.sense || w.zh || "").trim();
    if (raw && !isJunkGloss(raw)) return raw.slice(0, 28);
    return "";
  }

  function distractors(pool, word, pick, n = 3) {
    const target = pick(word);
    if (!target) return [];
    const tKey = target.toLowerCase();
    const others = pool.filter((x) => cleanEn(x.en).toLowerCase() !== cleanEn(word.en).toLowerCase());
    const scored = others.map((x) => {
      const v = pick(x);
      if (!v || isJunkGloss(v) || v.toLowerCase() === tKey) return null;
      let score = Math.random();
      if (Math.abs(v.length - target.length) <= 6) score += 2;
      return { v, score };
    }).filter(Boolean);
    scored.sort((a, b) => b.score - a.score);
    return uniq(scored.map((s) => s.v)).slice(0, n);
  }

  function wordMeta(w) {
    return {
      cardId: w.cardId,
      en: w.en,
      zh: w.zh,
      ipa: isPhrase(w.en) ? "" : (w.ipa || ""),
    };
  }

  function blankExample(example, head) {
    const ex = String(example || "").trim();
    if (!ex || !head) return "";
    if (wordRe(head).test(ex)) return ex.replace(wordRe(head), "___");
    const re = new RegExp(escapeRe(head), "i");
    if (re.test(ex)) return ex.replace(re, "___");
    return "";
  }

  function makeWordMeaning(w, pool, lang) {
    const head = cleanEn(w.en);
    if (!head) return null;
    if (lang !== "fr" && typeof JYH_EN !== "undefined" && JYH_EN.isSimpleWord(head)) return null;
    const meaning = meaningOf(w);
    if (!meaning || isJunkGloss(meaning)) return null;
    const d = distractors(pool, w, meaningOf, 3);
    if (d.length < 2) return null;
    const ex = (w.example || "").trim();
    const context = isValidExample(ex, head) ? blankExample(ex, head) : "";
    return {
      type: "word",
      kind: "choice",
      prompt: head,
      promptStyle: "word",
      answer: meaning,
      choices: shuffle([meaning, ...d]),
      context,
      explain: ex || "",
      hideIpa: false,
      ...wordMeta(w),
    };
  }

  function isValidWordQuestion(q) {
    if (!q || q.type !== "word") return false;
    const word = String(q.prompt || "").trim();
    const answer = String(q.answer || "").trim();
    if (!word || !answer || isJunkGloss(answer)) return false;
    const choices = Array.isArray(q.choices) ? q.choices : [];
    return choices.length >= 2 && choices.some((c) => String(c).trim().toLowerCase() === answer.toLowerCase());
  }

  function makeContextQuestion(w, pool, lang) {
    return makeWordMeaning(w, pool, lang);
  }

  function makeQuestion(w, pool, quizType, inflectPool, lang) {
    if (!isUsableWord(w)) return null;

    if (quizType === "tense") {
      const fr = lang === "fr" && typeof JYH_FR !== "undefined";
      return (fr && makeTense(w)) || makeVerbConjugation(w) || makeInflect(w, inflectPool) || makeContextQuestion(w, pool, lang);
    }
    if (quizType === "inflect") {
      const fr = lang === "fr" && typeof JYH_FR !== "undefined";
      return (fr && (makeVerbConjugation(w) || makeInflect(w, inflectPool))) || makeContextQuestion(w, pool, lang);
    }
    return makeContextQuestion(w, pool, lang);
  }

  function makeTense(w) {
    if (typeof JYH_FR === "undefined") return null;
    const head = cleanEn(w.en);
    const ex = isValidExample(w.example, head) ? w.example.trim() : "";
    const tense = w.tense || JYH_FR.extractTense(`${w.zh || ""} ${w.sense || ""}`);
    if (!tense || !ex) return null;
    if (!JYH_FR.looksLikeVerb(head) && !/动词|v\./i.test(`${w.zh || ""} ${w.sense || ""}`)) return null;
    const d = JYH_FR.tenseDistractors(tense, 3);
    if (d.length < 2) return null;
    return {
      type: "tense",
      kind: "choice",
      prompt: `What tense is “${head}” in this sentence?\n“${ex}”`,
      answer: tense,
      choices: shuffle([tense, ...d]),
      explain: w.sense ? gloss(w.sense) : (w.base ? `Base: ${w.base}` : ""),
      hideIpa: true,
      ...wordMeta(w),
    };
  }

  function makeInflectFromItem(item, w) {
    if (!item?.sentence || !item?.answer) return null;
    const answer = String(item.answer).trim();
    const sentence = String(item.sentence).trim();
    if (!answer || (!sentence.includes("___") && !sentence.includes("_______"))) return null;
    const hint = String(item.hint || "").trim();
    const base = item.base || w?.base || JYH_FR?.inferVerbBase(answer) || "";
    let distractors = typeof JYH_FR !== "undefined" ? JYH_FR.conjugationDistractors(answer, base, 3) : [];
    if (distractors.length < 2) {
      distractors = uniq([
        answer.replace(/^n'/, "j'").replace(/ais$/, "ai").replace(/erait$/, "erais"),
        answer.replace(/ais$/, "erais").replace(/rai$/, "ais"),
        answer.replace(/ir$/, "irai"),
        base && base !== answer ? base : "",
      ].filter((v) => v && v.toLowerCase() !== answer.toLowerCase()));
    }
    const choices = shuffle(uniq([answer, ...distractors]).slice(0, 4));
    while (choices.length < 4) choices.push(`${answer}?`);
    const promptText = sentence.replace(/_{3,}/g, "___");
    const baseHint = base ? `${base}` : "";
    const tenseHint = w?.tense || hint || (typeof JYH_FR !== "undefined" ? JYH_FR.inferVerbMeta(answer)?.tenseLabel : "");
    return {
      type: "inflect",
      kind: "choice",
      prompt: base
        ? `Choose the correct form of ${base}:\n“${promptText}”`
        : `Choose the correct verb form:\n“${promptText}”`,
      answer,
      choices: shuffle(choices.slice(0, 4)),
      explain: [tenseHint, baseHint].filter(Boolean).join(" · "),
      hideIpa: true,
      ...wordMeta(w),
    };
  }

  function collectInflect(cards) {
    const out = [];
    for (const c of cards || []) {
      for (const it of c.inflect || []) {
        out.push({ item: it, cardId: c.id });
      }
    }
    return out;
  }

  function makeInflect(w, inflectPool) {
    const head = cleanEn(w.en);
    const ex = isValidExample(w.example, head) ? w.example.trim() : "";
    if (!ex) return null;

    const linked = (inflectPool || []).filter(({ item }) => {
      const blob = `${item.sentence || ""} ${item.answer || ""} ${item.base || ""}`.toLowerCase();
      const h = head.toLowerCase();
      return blob.includes(h) || h.includes(String(item.answer || "").toLowerCase());
    });
    if (linked.length) return makeInflectFromItem(linked[0].item, w);

    if (typeof JYH_FR === "undefined" || !JYH_FR.isVerbWord(w)) return null;
    if (!wordRe(head).test(ex)) return null;

    const base = w.base || JYH_FR.inferVerbBase(head) || head;
    const fake = {
      sentence: ex.replace(wordRe(head), "___"),
      answer: head,
      base,
      hint: w.tense || JYH_FR.inferVerbMeta(head)?.tenseLabel || JYH_FR.extractTense(`${w.zh || ""} ${w.sense || ""}`),
    };
    return makeInflectFromItem(fake, w);
  }

  function makeVerbConjugation(w) {
    if (typeof JYH_FR === "undefined" || !JYH_FR.isVerbWord(w)) return null;
    const head = cleanEn(w.en);
    const ex = isValidExample(w.example, head) ? w.example.trim() : "";
    if (!ex || !wordRe(head).test(ex)) return null;
    const base = w.base || JYH_FR.inferVerbBase(head);
    if (!base) return null;
    const distractors = JYH_FR.conjugationDistractors(head, base, 3);
    if (distractors.length < 2) return makeInflect(w, []);
    const blanked = ex.replace(wordRe(head), "___");
    const tense = w.tense || JYH_FR.inferVerbMeta(head)?.tenseLabel || "";
    return {
      type: "inflect",
      kind: "choice",
      prompt: `Pick the right ${base} form for this sentence:\n“${blanked}”`,
      answer: head,
      choices: shuffle([head, ...distractors.slice(0, 3)]),
      explain: tense ? `${base} · ${tense}` : base,
      hideIpa: true,
      ...wordMeta(w),
    };
  }

  function normalizeType(quizType) {
    if (quizType === "cloze" || quizType === "sense" || quizType === "tense" || quizType === "inflect") return quizType;
    return "mixed";
  }

  function isValidPracticeQuestion(q) {
    if (!q || !q.type) return false;
    if (q.type === "word") return isValidWordQuestion(q);
    if (q.type === "tense" || q.type === "inflect") {
      const answer = String(q.answer ?? "").trim();
      const choices = Array.isArray(q.choices) ? q.choices : [];
      return !!answer && choices.length >= 2 && choices.some((c) => String(c).trim().toLowerCase() === answer.toLowerCase());
    }
    return false;
  }

  function localQuiz(words, _concepts, cards, n = 12, avoid, quizType = "mixed", lang = "en") {
    quizType = normalizeType(quizType);
    const skip = avoid instanceof Set ? avoid : new Set(avoid || []);
    let pool = (words || []).filter(isUsableWord);
    if (!pool.length) return [];
    const inflectPool = collectInflect(cards);

    const fresh = pool.filter((w) => !skip.has(cleanEn(w.en).toLowerCase()));
    const ordered = (fresh.length ? fresh : pool).slice();
    const qs = [];
    const used = new Set();

    for (const w of ordered) {
      if (qs.length >= n) break;
      const key = cleanEn(w.en).toLowerCase();
      if (used.has(key)) continue;
      const q = makeQuestion(w, pool, quizType, inflectPool, lang);
      if (!q) continue;
      used.add(key);
      qs.push(q);
    }

    if (qs.length < Math.min(3, n)) {
      for (const w of pool) {
        if (qs.length >= n) break;
        const key = cleanEn(w.en).toLowerCase();
        if (used.has(key)) continue;
        const q = makeContextQuestion(w, pool, lang);
        if (!q) continue;
        used.add(key);
        qs.push(q);
      }
    }

    return qs.filter(isValidPracticeQuestion);
  }

  function sanitizeQuizItem(q) {
    if (!q || !q.type) return null;

    if (q.type === "translate" || q.type === "translate_zh_en" || q.type === "concept" || q.type === "spelling" || q.type === "sense" || q.type === "recall" || q.type === "cloze") {
      return null;
    }

    if (q.type === "spelling" || q.type === "summary" || q.type === "sent-translate" || q.type === "makeup") {
      return (q.prompt && (q.answer || q.reference)) ? q : null;
    }

    const answer = String(q.answer ?? "").trim();
    const rawChoices = Array.isArray(q.choices) ? q.choices : (Array.isArray(q.options) ? q.options : []);
    if (!answer || !rawChoices.length) return null;

    const seen = new Set();
    const choices = [];
    for (const c of rawChoices) {
      const s = String(c ?? "").trim();
      if (!s || isJunkGloss(s) && q.type === "sense") continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      choices.push(s);
    }

    let finalAnswer = answer;
    if (q.type === "sense" && answer.length > 36) {
      finalAnswer = gloss(answer);
      const idx = choices.findIndex((c) => c.toLowerCase() === answer.toLowerCase());
      if (idx >= 0) choices[idx] = finalAnswer;
    }

    const answerKey = finalAnswer.toLowerCase();
    const hasAnswer = choices.some((c) => c.toLowerCase() === answerKey);
    if (!hasAnswer) {
      if (choices.length >= 4) choices[choices.length - 1] = finalAnswer;
      else choices.push(finalAnswer);
    }

    if (choices.length < 2) return null;
    const sanitized = {
      ...q,
      kind: "choice",
      answer: finalAnswer,
      choices: shuffle(choices),
      hideIpa: q.hideIpa === true,
      prompt: String(q.prompt ?? "").trim(),
      context: String(q.context || "").trim(),
    };
    if (sanitized.type === "word") return isValidWordQuestion(sanitized) ? sanitized : null;
    if (sanitized.type === "tense" || sanitized.type === "inflect") return isValidPracticeQuestion(sanitized) ? sanitized : null;
    return null;
  }

  function sanitizeQuizList(questions) {
    return (questions || []).map(sanitizeQuizItem).filter(Boolean);
  }

  const KEY_RECENT = "recentExamWords";
  const RECENT_CAP = 40;

  async function recentWords() {
    try {
      const d = await chrome.storage.local.get(KEY_RECENT);
      return new Set(Array.isArray(d[KEY_RECENT]) ? d[KEY_RECENT] : []);
    } catch (_) { return new Set(); }
  }

  async function rememberWords(questions) {
    try {
      const asked = questions.map((q) => q.en || q.answer).filter(Boolean).map((w) => String(w).toLowerCase());
      const prev = [...(await recentWords())];
      const merged = [...new Set([...asked, ...prev])].slice(0, RECENT_CAP);
      await chrome.storage.local.set({ [KEY_RECENT]: merged });
    } catch (_) {}
  }

  return {
    escapeRe,
    wordRe,
    shuffle,
    sample,
    uniq,
    gloss,
    cleanEn,
    isValidExample,
    isValidWordQuestion,
    isUsableWord,
    meaningOf,
    localQuiz,
    makeLocalQuiz: localQuiz,
    sanitizeQuizItem,
    sanitizeQuizList,
    recentWords,
    rememberWords,
  };
})();

if (typeof module !== "undefined") module.exports = JYH_QUIZ;
