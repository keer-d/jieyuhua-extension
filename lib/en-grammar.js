// lib/en-grammar.js — English word difficulty filter for vault + explain keyword quality.

var JYH_EN = (function () {
  const SIMPLE = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "without", "within",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "can", "could", "should", "may", "might", "must", "that", "this", "these", "those",
    "it", "its", "they", "them", "their", "we", "our", "you", "your", "he", "she", "his", "her",
    "so", "as", "if", "when", "while", "than", "then", "also", "just", "only", "very", "more", "most",
    "good", "bad", "new", "old", "big", "small", "high", "low", "long", "short", "fast", "slow",
    "faster", "slower", "better", "best", "mean", "means", "real", "built", "build", "make", "made",
    "get", "got", "use", "used", "work", "works", "working", "team", "teams", "user", "users",
    "data", "system", "systems", "process", "plan", "plans", "report", "reports",
    "financial", "finance", "execute", "executed", "action", "actions", "control", "controls",
    "account", "accounts", "operation", "operations", "management", "manage", "managed",
    "agent", "agents", "explicit", "company", "market", "price", "business", "service", "services",
    "product", "products", "technology", "tech", "software", "platform", "digital", "online",
    "help", "helps", "need", "needs", "want", "time", "day", "year", "way", "thing", "things",
    "people", "person", "world", "life", "hand", "part", "place", "case", "point", "number",
    "twenty", "ten", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "tags", "tag", "second", "first", "third", "running", "run", "and", "it", "as",
  ]);

  function normalize(w) {
    return String(w || "")
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/^(?:to|the|a|an)\s+/i, "")
      .trim();
  }

  function baseForm(w) {
    const s = normalize(w);
    if (SIMPLE.has(s)) return s;
    if (s.endsWith("ies") && s.length > 4) return s.slice(0, -3) + "y";
    if (s.endsWith("es") && s.length > 4) return s.slice(0, -2);
    if (s.endsWith("s") && s.length > 3) return s.slice(0, -1);
    if (s.endsWith("ing") && s.length > 5) return s.slice(0, -3);
    if (s.endsWith("ed") && s.length > 4) return s.slice(0, -2);
    if (s.endsWith("er") && s.length > 4) return s.slice(0, -2);
    return s;
  }

  function isSimpleWord(w) {
    const s = normalize(w);
    if (!s || s.length < 2) return true;
    if (SIMPLE.has(s)) return true;
    if (SIMPLE.has(baseForm(s))) return true;
    const parts = s.split(/\s+/);
    if (parts.length > 1 && parts.every((p) => SIMPLE.has(p) || SIMPLE.has(baseForm(p)))) return true;
    return false;
  }

  /** Prefer -ing forms, abstract nouns, longer/rarer tokens in a sentence token list. */
  function rankHardness(token) {
    const s = normalize(token);
    if (!s) return -999;
    if (isSimpleWord(s)) return -100;
    let score = s.length;
    if (/ing$/.test(s) && s.length > 6) score += 12;
    if (/tion$|sion$|ment$|ness$|ship$|hood$|ity$|ance$|ence$/.test(s)) score += 8;
    if (s.includes("-")) score += 4;
    if (s.split(/\s+/).length >= 2) score += 3;
    return score;
  }

  function filterHardWords(words) {
    return (words || []).filter((w) => {
      const en = w?.en || w?.word || "";
      return en && !isSimpleWord(en);
    });
  }

  return { isSimpleWord, filterHardWords, rankHardness, normalize, baseForm };
})();
