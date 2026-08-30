// lib/practice-keys.js — Keyboard shortcuts for spaced review & practice quiz.
// Anki-style: Space/Enter flip · 1-4 grade · A-D pick · Enter next · Esc exit

var JYH_PRACTICE_KEYS = (function () {
  let cleanupFn = null;

  const HINT_REVIEW_FRONT = "Space · flip   0 · remove   ·   Esc · back";
  const HINT_REVIEW_BACK = "1 Forgot   2 Hard   3 Good   4 Easy   0 Remove   ·   Esc · back";
  const HINT_EXAM_CHOICE = "A–D · choose   0 · remove   ·   Esc · back";
  const HINT_EXAM_NEXT = "Enter · next   0 · remove   ·   Esc · back";
  const HINT_EXAM_SPELL = "Enter · submit   0 · remove   ·   Esc · back";

  function cleanup() {
    if (cleanupFn) {
      cleanupFn();
      cleanupFn = null;
    }
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest(".hidden")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  }

  function isTypingTarget(el) {
    if (!el || !isVisible(el)) return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      const type = (el.type || "text").toLowerCase();
      return type !== "button" && type !== "submit" && type !== "checkbox" && type !== "radio";
    }
    if (el.isContentEditable) return true;
    return false;
  }

  function bind(handler) {
    cleanup();
    const onKey = (e) => handler(e);
    document.addEventListener("keydown", onKey);
    cleanupFn = () => document.removeEventListener("keydown", onKey);
    return cleanupFn;
  }

  /** @param {{ flipped: () => boolean, onFlip: () => void, onGrade: (q: number) => void, onRemove?: () => void, onExit?: () => void }} opts */
  function bindReview(opts) {
    return bind((e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        opts.onExit?.();
        return;
      }
      if (isTypingTarget(e.target)) return;

      if (e.key === "0" || e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        opts.onRemove?.();
        return;
      }

      if (!opts.flipped()) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          opts.onFlip();
        }
        return;
      }

      const gradeMap = { 1: 0, 2: 3, 3: 4, 4: 5 };
      if (Object.prototype.hasOwnProperty.call(gradeMap, e.key)) {
        e.preventDefault();
        opts.onGrade(gradeMap[e.key]);
      }
    });
  }

  /** @param {{ answered: () => boolean, isInput?: () => boolean, choiceCount?: () => number, onChoice?: (i: number) => void, onNext?: () => void, onSubmit?: () => void, onRemove?: () => void, onExit?: () => void }} opts */
  function bindExam(opts) {
    return bind((e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        opts.onExit?.();
        return;
      }

      const typing = isTypingTarget(e.target);

      if (!typing && (e.key === "0" || e.key === "Delete")) {
        e.preventDefault();
        opts.onRemove?.();
        return;
      }

      if (typing) {
        if (e.target.tagName === "TEXTAREA" && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          opts.onSubmit?.();
        }
        return;
      }

      if (opts.answered()) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          opts.onNext?.();
        }
        return;
      }

      if (opts.isInput?.()) return;

      const idxMap = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
      const key = e.key.length === 1 ? e.key.toLowerCase() : "";
      const codeMap = { KeyA: 0, KeyB: 1, KeyC: 2, KeyD: 3 };
      const codeIdx = codeMap[e.code];
      const i = Object.prototype.hasOwnProperty.call(idxMap, key) ? idxMap[key] : codeIdx;
      if (i == null) return;
      const max = opts.choiceCount?.() ?? 4;
      if (i >= max) return;

      e.preventDefault();
      opts.onChoice?.(i);
    });
  }

  return {
    cleanup,
    bindReview,
    bindExam,
    HINT_REVIEW_FRONT,
    HINT_REVIEW_BACK,
    HINT_EXAM_CHOICE,
    HINT_EXAM_NEXT,
    HINT_EXAM_SPELL,
  };
})();
