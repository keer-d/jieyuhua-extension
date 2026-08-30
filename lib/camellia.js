// lib/camellia.js — 山茶花视觉徽记与物理动效体系。
// 特性：纯白山茶花徽章、古书罗盘星盘、跌落入书架抛物线与粒子坍缩动效、成就庆典。

var JYH_CAMELLIA = (function () {
  // 原生 8 瓣纯白山茶花（48 viewBox）
  function svgSmall(size) {
    const s = size || 24;
    const uid = "c" + Math.random().toString(36).slice(2, 6);
    const outer = [0, 45, 90, 135, 180, 225, 270, 315]
      .map((a) => `<ellipse cx="24" cy="11.5" rx="5.4" ry="10.4" fill="url(#${uid}O)" transform="rotate(${a} 24 24)"/>`).join("");
    const inner = [22, 112, 202, 292]
      .map((a) => `<ellipse cx="24" cy="15" rx="3.7" ry="7" fill="url(#${uid}I)" transform="rotate(${a} 24 24)"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${s}" height="${s}" aria-hidden="true">
      <defs>
        <radialGradient id="${uid}O" cx="50%" cy="36%" r="66%">
          <stop offset="0%" stop-color="#ffffff"/><stop offset="68%" stop-color="#fdfbf7"/><stop offset="100%" stop-color="#ebe3d3"/>
        </radialGradient>
        <radialGradient id="${uid}I" cx="50%" cy="40%" r="62%">
          <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#f5ede0"/>
        </radialGradient>
      </defs>
      <g>${outer}</g><g>${inner}</g>
      <circle cx="24" cy="24" r="3.6" fill="#d4af37"/><circle cx="24" cy="24" r="1.5" fill="#8a6d2b"/>
    </svg>`;
  }

  // 古籍罗盘星轨（用于藏宝图秘境）
  function svgCompass(size = 32) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="none" stroke="rgba(196,165,116,0.35)" stroke-width="1" stroke-dasharray="2 3"/>
      <circle cx="24" cy="24" r="16" fill="none" stroke="rgba(196,165,116,0.6)" stroke-width="1.2"/>
      <path d="M24 3 L27 21 L45 24 L27 27 L24 45 L21 27 L3 24 L21 21 Z" fill="rgba(196,165,116,0.18)" stroke="#d4af37" stroke-width="1.2"/>
      <circle cx="24" cy="24" r="3.5" fill="#d4af37"/>
      <circle cx="24" cy="24" r="1.5" fill="#14100c"/>
    </svg>`;
  }

  // 古籍火漆印章徽记
  function svgSeal(size = 28) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#8b261d" stroke="#d4af37" stroke-width="1.5"/>
      <circle cx="20" cy="14" r="14" fill="none" stroke="rgba(212,175,55,0.6)" stroke-width="1" stroke-dasharray="1.5 2"/>
      <text x="20" y="24" font-size="11" font-family="-apple-system, sans-serif" font-weight="bold" fill="#f7f1e6" text-anchor="middle">✦</text>
    </svg>`;
  }

  function svgMarkup(size) {
    return svgSmall(size);
  }

  // 保持原生系统光标（I-beam 文本光标 / pointer / default），不篡改用户光标，保障划词分界与选区精度
  function applyCursor(doc) {
    const root = doc || document;
    const el = root.getElementById("jyh-camellia-cursor");
    if (el) el.remove();
  }

  /* ============ 跌落入阁动效 (Fly-to-Shelf) ============ */
  function flyToShelf(fromEl, targetEl, label = "Saved to Vault") {
    try {
      const fromRect = fromEl ? fromEl.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 24, height: 24 };
      const toRect = targetEl ? targetEl.getBoundingClientRect() : { left: 120, top: 40, width: 32, height: 24 };

      const startX = fromRect.left + fromRect.width / 2;
      const startY = fromRect.top + fromRect.height / 2;
      const endX = toRect.left + toRect.width / 2;
      const endY = toRect.top + toRect.height / 2;

      // 飞行发光粒子容器（带金色琉璃光晕与星尘尾焰）
      const orb = document.createElement("div");
      orb.className = "jyh-flying-orb";
      orb.innerHTML = `
        <div style="position:absolute;inset:-8px;border-radius:50%;background:radial-gradient(circle,rgba(212,175,55,0.55),transparent 70%);filter:blur(4px);pointer-events:none;"></div>
        <div style="position:relative;z-index:2;display:grid;place-items:center;">${svgSmall(26)}</div>
      `;
      orb.style.cssText = `
        position: fixed; z-index: 2147483647; left: ${startX}px; top: ${startY}px;
        pointer-events: none; transform: translate(-50%, -50%) scale(1.1);
        transition: left 0.72s cubic-bezier(0.2, 0.9, 0.3, 1), top 0.72s cubic-bezier(0.4, 0, 0.2, 1), transform 0.72s ease, opacity 0.72s ease;
      `;
      document.body.appendChild(orb);

      // 轨迹计算（优雅抛物线）
      requestAnimationFrame(() => {
        orb.style.left = `${endX}px`;
        orb.style.top = `${endY}px`;
        orb.style.transform = "translate(-50%, -50%) scale(0.2) rotate(540deg)";
        orb.style.opacity = "0.5";
      });

      setTimeout(() => {
        orb.remove();
        // 目标 Tab 弹性波纹回弹与粒子炸裂
        if (targetEl) {
          targetEl.classList.remove("tab-landing-bounce");
          void targetEl.offsetWidth;
          targetEl.classList.add("tab-landing-bounce");
          createSparkleBurst(endX, endY);
          showFloatingToast(endX, endY + 24, label);
        }
      }, 700);
    } catch (_) {}
  }

  function createSparkleBurst(x, y) {
    const burst = document.createElement("div");
    burst.className = "jyh-sparkle-burst";
    burst.style.cssText = `position: fixed; z-index: 2147483647; left: ${x}px; top: ${y}px; pointer-events: none;`;
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = 24 + Math.random() * 18;
      const p = document.createElement("div");
      p.className = "sparkle-particle";
      p.style.cssText = `
        position: absolute; width: 4.5px; height: 4.5px; border-radius: 50%;
        background: #fff; box-shadow: 0 0 8px #d4af37, 0 0 2px #fff;
        transform: translate(0, 0); opacity: 1;
        transition: all 0.65s cubic-bezier(0.1, 0.8, 0.2, 1);
      `;
      burst.appendChild(p);
      setTimeout(() => {
        p.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0)`;
        p.style.opacity = "0";
      }, 10);
    }
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 700);
  }

  function showFloatingToast(x, y, text) {
    const tip = document.createElement("div");
    tip.className = "jyh-floating-toast";
    tip.textContent = `✨ ${text}`;
    tip.style.cssText = `
      position: fixed; z-index: 2147483647; left: ${Math.max(20, Math.min(innerWidth - 130, x))}px; top: ${y}px;
      transform: translate(-50%, 0) scale(0.9); pointer-events: none;
      background: linear-gradient(135deg, rgba(22,18,14,0.96), rgba(14,11,8,0.98));
      color: #e8c872; border: 1px solid rgba(212,175,55,0.45); border-radius: 99px;
      padding: 4px 12px; font: 12px/1.4 -apple-system, BlinkMacSystemFont, sans-serif; box-shadow: 0 6px 20px rgba(0,0,0,0.45);
      opacity: 0; transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    document.body.appendChild(tip);
    requestAnimationFrame(() => {
      tip.style.opacity = "1";
      tip.style.transform = "translate(-50%, 6px) scale(1)";
    });
    setTimeout(() => {
      tip.style.opacity = "0";
      tip.style.transform = "translate(-50%, -8px) scale(0.95)";
      setTimeout(() => tip.remove(), 400);
    }, 1800);
  }

  // 灵光盛放 / 成就庆典粒子动效
  function celebrateMilestone(title = "Mastery Achieved", desc = "Study goals completed with precision.") {
    document.querySelectorAll(".jyh-celebrate-modal").forEach((el) => el.remove());
    const wrap = document.createElement("div");
    wrap.className = "jyh-celebrate-modal";
    wrap.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;";
    wrap.innerHTML = `
      <div class="cel-overlay" style="position:absolute;inset:0;background:rgba(8,6,4,.72);"></div>
      <div class="cel-box" style="position:relative;z-index:1;min-width:220px;max-width:86%;padding:22px 18px;border-radius:14px;border:1px solid rgba(212,175,55,.4);background:#14100b;text-align:center;color:#f7f1e6;">
        <div class="cel-seal">${svgSeal(44)}</div>
        <div class="cel-flower">${svgSmall(42)}</div>
        <div class="cel-title" style="margin-top:10px;font-weight:700;">${title}</div>
        <div class="cel-desc" style="margin:6px 0 14px;font-size:12px;color:#c7b89f;">${desc}</div>
        <button class="cel-btn" type="button" style="all:unset;cursor:pointer;display:inline-block;padding:8px 16px;border-radius:8px;background:linear-gradient(180deg,#e8c872,#d4af37);color:#14100b;font-weight:700;">Continue</button>
      </div>
    `;
    document.body.appendChild(wrap);
    const close = () => {
      wrap.style.opacity = "0";
      setTimeout(() => wrap.remove(), 300);
    };
    wrap.querySelector(".cel-btn").addEventListener("click", close);
    wrap.querySelector(".cel-overlay").addEventListener("click", close);
    for (let i = 0; i < 24; i++) {
      createFallingPetal(wrap);
    }
  }

  function createFallingPetal(container) {
    const p = document.createElement("div");
    p.className = "falling-petal";
    const x = Math.random() * 100;
    const dur = 2 + Math.random() * 2.5;
    const delay = Math.random() * 0.8;
    p.style.cssText = `
      position: absolute; left: ${x}%; top: -10px; width: 8px; height: 11px;
      background: radial-gradient(circle, #ffffff 30%, #e4dac6 100%);
      border-radius: 50% 50% 50% 0; opacity: 0.88; pointer-events: none;
      transform: rotate(${Math.random() * 360}deg);
      animation: petalFall ${dur}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s forwards;
    `;
    container.appendChild(p);
  }

  return {
    svgSmall,
    svgCompass,
    svgSeal,
    svgMarkup,
    applyCursor,
    flyToShelf,
    createSparkleBurst,
    showFloatingToast,
    celebrateMilestone,
  };
})();

if (typeof module !== "undefined") module.exports = JYH_CAMELLIA;
