// lib/store.js — FluentLoop core vocabulary and learning-results storage.
// 具备多重容灾、永久备份、SM-2 艾宾浩斯遗忘曲线复习、主题分类与时间线总账。

var JYH_STORE = (function () {
  const KEY_CARDS = "cards";
  const KEY_BACKUP = "cardsBackup";
  const KEY_LOOKUPS = "lookups";
  const KEY_MASTER_LEDGER = "masterLedger";
  const KEY_LANG = "activeLang";
  const LOOKUP_CARD_KIND = "lookups";
  const DAY = 86400000;

  function polishWord(w, lang) {
    if (typeof JYH_FR !== "undefined" && lang === "fr") return JYH_FR.normalizeWord(w, lang);
    return w;
  }

  function mapWord(w, lang) {
    const row = {
      en: w.en,
      ipa: w.ipa || "",
      zh: w.zh || "",
      sense: w.sense || "",
      example: w.example || "",
      pos: w.pos || "",
      gender: w.gender || "",
      tense: w.tense || "",
      base: w.base || "",
      addedAt: w.addedAt || Date.now(),
      srs: w.srs || freshSrs(),
    };
    return polishWord(row, lang);
  }

  const LANGS = {
    en: { label: "English", short: "EN", hasIpa: true },
    fr: { label: "Français", short: "FR", hasIpa: true },
  };
  const DEFAULT_LANG = "en";

  async function getLang() {
    try {
      const d = await chrome.storage.local.get(KEY_LANG);
      return LANGS[d[KEY_LANG]] ? d[KEY_LANG] : DEFAULT_LANG;
    } catch (_) {
      return DEFAULT_LANG;
    }
  }
  async function setLang(lang) {
    if (!LANGS[lang]) return;
    try {
      await chrome.storage.local.set({ [KEY_LANG]: lang });
    } catch (_) {}
  }

  /* ============ SM-2 艾宾浩斯记忆算法 ============ */
  const MASTERED_DAYS = 21;
  const EF_MIN = 1.3;
  const EF_START = 2.5;
  const RELEARN_MS = 10 * 60 * 1000; // 答错的词 10 分钟后重现

  const Q = { FORGOT: 0, MISS: 2, HARD: 3, GOOD: 4, EASY: 5 };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const freshSrs = () => ({
    interval: 0,
    ef: EF_START,
    reps: 0,
    due: Date.now(),
    seen: 0,
    wrong: 0,
  });
  const isMastered = (srs) => (srs?.interval || 0) >= MASTERED_DAYS;

  const OLD_INTERVALS = [0, 1, 2, 4, 8, 16, 32];
  function migrate(w) {
    if (!w) return false;
    if (w.srs && typeof w.srs.ef === "number") return false;
    const old = w.srs || {};
    const lvl = Math.min(old.level || 0, OLD_INTERVALS.length - 1);
    w.srs = {
      interval: OLD_INTERVALS[lvl],
      ef: EF_START,
      reps: lvl,
      due: old.due ?? Date.now(),
      seen: old.seen || 0,
      wrong: old.wrong || 0,
    };
    return true;
  }

  /* ============ 底层读取与多重容灾 ============ */
  async function readCardsDirect() {
    try {
      const d = await chrome.storage.local.get([KEY_CARDS, KEY_BACKUP, KEY_MASTER_LEDGER]);
      let cards = Array.isArray(d[KEY_CARDS]) ? d[KEY_CARDS] : [];
      if (!cards.length && Array.isArray(d[KEY_BACKUP]) && d[KEY_BACKUP].length) {
        cards = d[KEY_BACKUP];
        await chrome.storage.local.set({ [KEY_CARDS]: cards });
      }
      return cards;
    } catch (_) {
      return [];
    }
  }

  async function raw() {
    let cards = await readCardsDirect();
    let touched = false;
    for (const c of cards) {
      if (!c.lang) { c.lang = DEFAULT_LANG; touched = true; }
      for (const w of c.words || []) {
        if (migrate(w)) touched = true;
        if (!w.addedAt) { w.addedAt = c.ts || Date.now(); touched = true; }
      }
    }
    if (touched) await write(cards, { skipBackup: true });
    return cards;
  }

  async function write(cards) {
    try {
      const lookups = await allLookupsRaw();
      const payload = {
        [KEY_CARDS]: cards,
        [KEY_BACKUP]: cards,
        [KEY_MASTER_LEDGER]: buildLedger(cards, lookups),
      };
      await chrome.storage.local.set(payload);
    } catch (_) {}
    return cards;
  }

  async function allLookupsRaw() {
    try {
      const d = await chrome.storage.local.get(KEY_LOOKUPS);
      return Array.isArray(d[KEY_LOOKUPS]) ? d[KEY_LOOKUPS] : [];
    } catch (_) {
      return [];
    }
  }

  /* ============ 生词总账本（全维度：日期、类别、艾宾浩斯复习） ============ */
  function buildLedger(cards, lookups) {
    const map = new Map();
    const put = (row) => {
      const key = `${row.lang || DEFAULT_LANG}:${String(row.en || "").toLowerCase().trim()}`;
      if (!key || key.endsWith(":")) return;
      const prev = map.get(key);
      if (!prev || (row.addedAt || 0) > (prev.addedAt || 0)) {
        map.set(key, row);
      }
    };

    for (const c of cards || []) {
      const cat = (c.tags && c.tags[0]) ? c.tags[0] : (c.source?.kind === LOOKUP_CARD_KIND ? "Lookups" : "Deep Read");
      for (const w of c.words || []) {
        put({
          id: w.id || uid(),
          lang: c.lang || DEFAULT_LANG,
          en: w.en,
          ipa: w.ipa || "",
          zh: w.zh || "",
          sense: w.sense || "",
          example: w.example || "",
          category: cat,
          tags: c.tags || [cat],
          addedAt: w.addedAt || c.ts || Date.now(),
          source: c.title || c.source?.pageTitle || "Vault",
          cardId: c.id,
          srs: w.srs || freshSrs(),
        });
      }
    }

    for (const r of lookups || []) {
      put({
        id: r.id || uid(),
        lang: r.lang || DEFAULT_LANG,
        en: r.en,
        ipa: r.ipa || "",
        zh: r.zh || "",
        sense: r.sense || "",
        example: r.example || "",
        category: (r.tags && r.tags[0]) || "Lookups",
        tags: r.tags || ["Lookups"],
        addedAt: r.ts || Date.now(),
        source: r.pageTitle || r.url || "Captions / Selection",
        cardId: "",
        srs: freshSrs(),
      });
    }

    return [...map.values()].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  }

  async function ledgerAll() {
    return buildLedger(await raw(), await allLookupsRaw());
  }

  function fmtDay(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /* ============ Export CSV / JSON ============ */
  async function exportCSV() {
    const rows = await ledgerAll();
    const head = [
      "Date Added",
      "Word/Phrase",
      "IPA",
      "Definition",
      "Context Meaning",
      "Category",
      "Language",
      "Source",
      "Example",
      "Review Status",
      "Next Review Date",
    ];
    const lines = [head.join(",")];
    for (const w of rows) {
      const due = w.srs?.due ? fmtDay(w.srs.due) : "";
      const status = isMastered(w.srs) ? "Mastered" : (w.srs?.seen ? `Reviewing (${w.srs.interval}d)` : "New Word");
      lines.push([
        fmtDay(w.addedAt),
        w.en,
        w.ipa,
        w.zh,
        w.sense,
        w.category,
        w.lang,
        w.source,
        w.example,
        status,
        due,
      ].map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(","));
    }
    return lines.join("\n");
  }

  async function exportJSON() {
    const cards = await raw();
    const lookups = await allLookupsRaw();
    return JSON.stringify({
      app: "FluentLoop",
      version: 5,
      exportedAt: new Date().toISOString(),
      cards,
      lookups,
      ledger: buildLedger(cards, lookups),
    }, null, 2);
  }

  async function importJSON(str) {
    const data = JSON.parse(str);
    const existingCards = await readCardsDirect();
    let importedCards = 0;

    if (Array.isArray(data.cards) && data.cards.length) {
      const existingIds = new Set(existingCards.map((c) => c.id));
      const newCards = data.cards.filter((c) => !existingIds.has(c.id));
      for (const c of newCards) {
        if (!c.lang) c.lang = DEFAULT_LANG;
        for (const w of c.words || []) {
          migrate(w);
          if (!w.addedAt) w.addedAt = c.ts || Date.now();
        }
      }
      const merged = [...newCards, ...existingCards].sort((a, b) => b.ts - a.ts);
      await write(merged);
      importedCards = newCards.length;
    }

    if (Array.isArray(data.lookups) && data.lookups.length) {
      const prevLookups = await allLookupsRaw();
      const seen = new Set(prevLookups.map((x) => `${x.lang}:${(x.en || "").toLowerCase()}`));
      const addLookups = data.lookups.filter((x) => !seen.has(`${x.lang}:${(x.en || "").toLowerCase()}`));
      if (addLookups.length) {
        await chrome.storage.local.set({ [KEY_LOOKUPS]: [...addLookups, ...prevLookups] });
      }
    }

    // 若数据包里有 ledger 单条词汇，且没有卡片，自动构建成生词本
    if (Array.isArray(data.ledger) && !data.cards?.length) {
      for (const row of data.ledger) {
        if (row.en) await addLookup(row);
      }
    }

    await syncAllLookups();
    return importedCards || data.ledger?.length || 0;
  }

  /* ============ 搜词与书架同步 ============ */
  async function syncAllLookups() {
    const cards = await readCardsDirect();
    const lookups = await allLookupsRaw();
    if (!lookups.length) return cards;
    let changed = false;
    for (const row of lookups) {
      const before = JSON.stringify(cards);
      mergeLookupRow(cards, row);
      if (JSON.stringify(cards) !== before) changed = true;
    }
    if (changed) await write(cards);
    return cards;
  }

  function mergeLookupRow(cards, row) {
    if (!row?.en) return;
    const lang = row.lang || DEFAULT_LANG;
    let card = cards.find((c) => c.lang === lang && c.source?.kind === LOOKUP_CARD_KIND);
    if (!card) {
      card = {
        id: uid(),
        ts: Date.now(),
        lang,
        title: "Lookups Vault",
        summary: "Vocabulary automatically collected from video subtitles, lookups, and web pages.",
        tags: ["Lookups"],
        source: { kind: LOOKUP_CARD_KIND, url: "", pageTitle: "" },
        excerpt: "",
        words: [],
        concepts: [],
        bilingual: [], grammar: [], cloze: [], inflect: [], translate: [], makeup: [],
        notes: "",
      };
      cards.unshift(card);
    }
    const key = row.en.toLowerCase().trim();
    const existing = card.words.find((w) => (w.en || "").toLowerCase().trim() === key);
    const now = row.ts || Date.now();
    if (existing) {
      if (row.zh && !existing.zh) existing.zh = row.zh;
      if (row.ipa && !existing.ipa) existing.ipa = row.ipa;
      if (row.sense) existing.sense = row.sense;
      if (row.example && (!existing.example || row.example.length > existing.example.length)) {
        existing.example = row.example;
      }
      if (row.pos && !existing.pos) existing.pos = row.pos;
      if (row.base && !existing.base) existing.base = row.base;
      if (row.tense && !existing.tense) existing.tense = row.tense;
      Object.assign(existing, polishWord(existing, lang));
    } else {
      card.words.unshift(polishWord({
        en: row.en,
        ipa: row.ipa || "",
        zh: row.zh || "",
        sense: row.sense || "",
        example: row.example || "",
        pos: row.pos || "",
        tense: row.tense || "",
        base: row.base || "",
        addedAt: now,
        srs: row.srs || freshSrs(),
      }, lang));
    }
    card.ts = now;
  }

  async function mergeLookupIntoShelf(row) {
    const cards = await readCardsDirect();
    mergeLookupRow(cards, row);
    await write(cards);
    return cards.find((c) => c.lang === row.lang && c.source?.kind === LOOKUP_CARD_KIND);
  }

  /* ============ 语言过滤与业务查询 ============ */
  async function current() {
    const lang = await getLang();
    return (await raw()).filter((c) => c.lang === lang);
  }

  async function addCard(input) {
    const cards = await raw();
    const lang = input.lang || (await getLang());
    const card = {
      id: uid(),
      ts: Date.now(),
      lang,
      title: input.title || "Untitled",
      summary: input.summary || "",
      tags: (input.tags || []).filter(Boolean).slice(0, 4),
      source: { url: input.url || "", pageTitle: input.pageTitle || "" },
      excerpt: (input.excerpt || "").slice(0, 1000),
      words: (input.words || []).map((w) => mapWord(w, lang)),
      concepts: input.concepts || [],
      bilingual: input.bilingual || [],
      grammar: input.grammar || [],
      cloze: input.cloze || [],
      inflect: input.inflect || [],
      translate: input.translate || [],
      makeup: input.makeup || [],
      notes: input.notes || "",
    };
    cards.unshift(card);
    await write(cards);
    return card;
  }

  async function listCards(tag) {
    const cards = await current();
    return tag ? cards.filter((c) => c.tags.includes(tag)) : cards;
  }

  async function getCard(id) {
    return (await raw()).find((c) => c.id === id) || null;
  }

  async function updateCard(id, patch) {
    const cards = await raw();
    const c = cards.find((x) => x.id === id);
    if (!c) return null;
    Object.assign(c, patch);
    if (patch.tags) c.tags = patch.tags.filter(Boolean).slice(0, 4);
    await write(cards);
    return c;
  }

  async function deleteCard(id) {
    await write((await raw()).filter((c) => c.id !== id));
  }

  /* ============ 主题文件夹（从 tags 自动生长） ============ */
  async function folders() {
    const cards = await current();
    const map = new Map();
    const now = Date.now();
    for (const c of cards) {
      const tags = c.tags && c.tags.length ? c.tags : ["Unsorted"];
      for (const t of tags) {
        const f = map.get(t) || { tag: t, cards: 0, words: 0, mastered: 0, due: 0, lastTs: 0 };
        f.cards += 1;
        f.words += (c.words || []).length;
        f.mastered += (c.words || []).filter((w) => isMastered(w.srs)).length;
        f.due += (c.words || []).filter((w) => (w.srs?.due || 0) <= now).length;
        f.lastTs = Math.max(f.lastTs, c.ts || 0);
        map.set(t, f);
      }
    }
    return [...map.values()].sort((a, b) => b.cards - a.cards || b.lastTs - a.lastTs);
  }

  async function allTags() {
    return (await folders()).map((f) => f.tag);
  }

  /* ============ 词条与复习队列 ============ */
  async function allWords(tag) {
    const cards = await listCards(tag);
    const out = [];
    for (const c of cards) {
      for (const w of c.words || []) {
        out.push({ cardId: c.id, cardTitle: c.title, tags: c.tags, ...w });
      }
    }
    return out;
  }

  async function dueWords(tag) {
    const now = Date.now();
    return (await allWords(tag)).filter((w) => (w.srs?.due || 0) <= now).sort((a, b) => (a.srs?.due || 0) - (b.srs?.due || 0));
  }

  // 自由温习生词库：支持到期复习、全部温习、错词强化
  async function reviewWords(tag, mode = "auto") {
    const all = await allWords(tag);
    if (!all.length) return [];
    const now = Date.now();

    if (mode === "due") {
      return all.filter((w) => (w.srs?.due || 0) <= now).sort((a, b) => (a.srs?.due || 0) - (b.srs?.due || 0));
    }
    if (mode === "hard") {
      // 优先错误次数多、熟练度低的词
      const hard = all.filter((w) => (w.srs?.wrong || 0) > 0 || (w.srs?.interval || 0) <= 2 || !w.srs?.seen);
      return hard.length ? hard.sort((a, b) => (b.srs?.wrong || 0) - (a.srs?.wrong || 0)) : all;
    }
    if (mode === "auto") {
      const due = all.filter((w) => (w.srs?.due || 0) <= now);
      if (due.length) return due.sort((a, b) => (a.srs?.due || 0) - (b.srs?.due || 0));
      // 没有到期词时，进入自由温故知新模式，优先排复习时间更久远的
      return all.slice().sort((a, b) => (a.srs?.due || 0) - (b.srs?.due || 0));
    }
    // 默认全部词汇
    return all.slice().sort((a, b) => (a.srs?.due || 0) - (b.srs?.due || 0));
  }

  const STEP_1 = { 3: 1, 4: 2, 5: 4 };
  const STEP_2 = { 3: 4, 4: 6, 5: 9 };

  function schedule(srs, quality) {
    if (!srs) srs = freshSrs();
    srs.seen = (srs.seen || 0) + 1;
    srs.ef = Math.max(EF_MIN, (srs.ef || EF_START) + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    if (quality >= 3) {
      if (srs.reps === 0) srs.interval = STEP_1[quality] ?? 1;
      else if (srs.reps === 1) srs.interval = STEP_2[quality] ?? 6;
      else srs.interval = Math.max(1, Math.round(srs.interval * srs.ef));
      srs.reps = (srs.reps || 0) + 1;
    } else {
      srs.wrong = (srs.wrong || 0) + 1;
      srs.reps = 0;
      srs.interval = 0;
    }
    srs.due = Date.now() + (srs.interval ? srs.interval * DAY : RELEARN_MS);
    return srs;
  }

  function preview(srs, quality) {
    return schedule(JSON.parse(JSON.stringify(srs || freshSrs())), quality);
  }
  const humanInterval = (srs) => (!srs?.interval ? "in 10 mins" : (srs.interval === 1 ? "in 1 day" : `in ${srs.interval} days`));

  async function gradeWord(cardId, en, quality) {
    const cards = await raw();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return null;
    const w = card.words.find((x) => x.en === en);
    if (!w) return null;
    schedule(w.srs, quality);
    await write(cards);
    return w.srs;
  }

  async function removeWord(cardId, en) {
    const cards = await raw();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return false;
    const before = (card.words || []).length;
    card.words = (card.words || []).filter((x) => x.en !== en);
    if (card.words.length === before) return false;
    await write(cards);
    return true;
  }

  /* ============ 搜词记录与快查 ============ */
  async function listLookups(limit = 80) {
    const lang = await getLang();
    const all = await allLookupsRaw();
    return all.filter((x) => x.lang === lang).slice(0, limit);
  }

  async function addLookup(entry) {
    const en = String(entry.en || "").trim();
    if (!en || en.length < 2) return null;
    const lang = entry.lang || (await getLang());
    const all = await allLookupsRaw();
    const row = {
      id: uid(),
      ts: entry.ts || Date.now(),
      lang,
      en,
      ipa: entry.ipa || "",
      zh: entry.zh || "",
      sense: entry.sense || "",
      pos: entry.pos || "",
      base: entry.base || "",
      tense: entry.tense || "",
      example: (entry.example || "").slice(0, 300),
      url: entry.url || "",
      pageTitle: entry.pageTitle || "",
      tags: entry.tags || ["Lookups"],
    };
    const next = [row, ...all.filter((x) => !(x.lang === lang && (x.en || "").toLowerCase().trim() === en.toLowerCase()))];
    await chrome.storage.local.set({ [KEY_LOOKUPS]: next });
    await mergeLookupIntoShelf(row);
    return row;
  }

  /* ============ 统计、日历热力图与今日成就 ============ */
  async function stats() {
    const cards = await current();
    const words = cards.flatMap((c) => c.words || []);
    const now = Date.now();
    const days = new Set(cards.map((c) => new Date(c.ts || Date.now()).toDateString()));
    const today = await getTodayStats();
    return {
      cards: cards.length,
      folders: (await folders()).length,
      words: words.length,
      mastered: words.filter((w) => isMastered(w.srs)).length,
      due: words.filter((w) => (w.srs?.due || 0) <= now).length,
      days: days.size,
      streak: streakFrom(cards),
      today,
    };
  }

  async function getTodayStats() {
    const ledger = await ledgerAll();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayWords = ledger.filter((w) => (w.addedAt || 0) >= startOfToday);
    const count = todayWords.length;

    let milestone = "Ready to Explore";
    let level = 0;
    if (count >= 20) { milestone = "Mastery · 20 Words"; level = 4; }
    else if (count >= 10) { milestone = "In Bloom · 10 Words"; level = 3; }
    else if (count >= 5) { milestone = "Ink Flow · 5 Words"; level = 2; }
    else if (count >= 1) { milestone = "Morning Dew · 1 Word"; level = 1; }

    return {
      count,
      milestone,
      level,
      words: todayWords,
    };
  }

  async function getMonthHeatmap(year, month) {
    // year: e.g. 2026, month: 0-11
    const ledger = await ledgerAll();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay(); // 0 is Sunday

    const dayCounts = {};
    for (let d = 1; d <= daysInMonth; d++) dayCounts[d] = 0;

    let totalMonthWords = 0;
    let activeDays = 0;

    for (const w of ledger) {
      if (!w.addedAt) continue;
      const d = new Date(w.addedAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dateNum = d.getDate();
        dayCounts[dateNum] = (dayCounts[dateNum] || 0) + 1;
        totalMonthWords += 1;
      }
    }

    for (let d = 1; d <= daysInMonth; d++) {
      if (dayCounts[d] > 0) activeDays += 1;
    }

    return {
      year,
      month,
      startWeekday,
      daysInMonth,
      dayCounts,
      totalMonthWords,
      activeDays,
    };
  }

  function streakFrom(cards) {
    if (!cards.length) return 0;
    const days = new Set(cards.map((c) => new Date(c.ts || Date.now()).toDateString()));
    let n = 0;
    let cursor = new Date();
    if (!days.has(cursor.toDateString())) cursor = new Date(Date.now() - DAY);
    while (days.has(cursor.toDateString())) {
      n += 1;
      cursor = new Date(cursor.getTime() - DAY);
    }
    return n;
  }

  return {
    Q, MASTERED_DAYS, isMastered, schedule, preview, humanInterval, freshSrs,
    LANGS, getLang, setLang,
    addCard, listCards, getCard, updateCard, deleteCard,
    folders, allTags, allWords, dueWords, reviewWords, gradeWord, removeWord,
    listLookups, addLookup, ledgerAll, exportCSV, syncAllLookups,
    stats, getTodayStats, getMonthHeatmap, exportJSON, importJSON,
  };
})();

if (typeof module !== "undefined") module.exports = JYH_STORE;
