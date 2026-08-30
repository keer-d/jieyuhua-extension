// lib/fr-grammar.js — French gender correction and tense helpers for vault + practice.

var JYH_FR = (function () {
  const GENDER = {
    littoral: "m",
    température: "f",
    temperature: "f",
    progression: "f",
    marché: "m",
    marche: "m",
    mer: "f",
    côte: "f",
    cote: "f",
    plage: "f",
    été: "m",
    ete: "m",
    hiver: "m",
    automne: "m",
    printemps: "m",
    jour: "m",
    nuit: "f",
    ville: "f",
    pays: "m",
    monde: "m",
    gouvernement: "m",
    entreprise: "f",
    économie: "f",
    economie: "f",
    politique: "f",
    région: "f",
    region: "f",
    département: "m",
    departement: "m",
    touriste: "m",
    tourisme: "m",
    saison: "f",
    climat: "m",
    canicule: "f",
    vague: "f",
    chaleur: "f",
    soleil: "m",
    nuage: "m",
    pluie: "f",
    vent: "m",
    océan: "m",
    ocean: "m",
    rivière: "f",
    riviere: "f",
    montagne: "f",
    forêt: "f",
    foret: "f",
    route: "f",
    chemin: "m",
    bateau: "m",
    avion: "m",
    train: "m",
    voiture: "f",
    maison: "f",
    appartement: "m",
    bureau: "m",
    travail: "m",
    emploi: "m",
    salaire: "m",
    prix: "m",
    coût: "m",
    cout: "m",
    revenu: "m",
    croissance: "f",
    baisse: "f",
    hausse: "f",
    crise: "f",
    banque: "f",
    argent: "m",
    euro: "m",
    dollar: "m",
    obligation: "f",
    action: "f",
    rendement: "m",
    taux: "m",
    inflation: "f",
    récession: "f",
    recession: "f",
    résultat: "m",
    resultat: "m",
    rapport: "m",
    article: "m",
    journal: "m",
    magazine: "m",
    livre: "m",
    auteur: "m",
    écrivain: "m",
    ecrivain: "m",
    personne: "f",
    homme: "m",
    femme: "f",
    enfant: "m",
    famille: "f",
    ami: "m",
    amie: "f",
    problème: "m",
    probleme: "m",
    solution: "f",
    idée: "f",
    idee: "f",
    décision: "f",
    decision: "f",
    loi: "f",
    droit: "m",
    justice: "f",
    guerre: "f",
    paix: "f",
    histoire: "f",
    culture: "f",
    langue: "f",
    mot: "m",
    phrase: "f",
    verbe: "m",
    nom: "m",
    adjectif: "m",
    adverbe: "m",
  };

  const FEM_SUFFIX = /(?:tion|sion|té|tee|tée|ure|ance|ence|esse|ie|ière|iere|ade|ée|ee|ique|ette|euse|itude)$/i;
  const MASC_SUFFIX = /(?:al|ail|eil|eau|ier|isme|ment|oir|ou|age|asme|ège|ege|at)$/i;

  const TENSE_ALIASES = [
    { re: /愈过去|plus-?que-parfait|pluperfect/i, label: "Plus-que-parfait (愈过去时)" },
    { re: /条件式|conditionnel/i, label: "Conditionnel présent (条件式现在时)" },
    { re: /虚拟式|subjonctif/i, label: "Subjonctif présent (虚拟式现在时)" },
    { re: /复合过去|passé composé|passe compose/i, label: "Passé composé (复合过去时)" },
    { re: /未完成过去|imparfait/i, label: "Imparfait (未完成过去时)" },
    { re: /简单过去|passé simple|passe simple/i, label: "Passé simple (简单过去时)" },
    { re: /愈过去|plus-?que-parfait/i, label: "Plus-que-parfait (愈过去时)" },
    { re: /先将来|futur antérieur|futur anterieur/i, label: "Futur antérieur (先将来时)" },
    { re: /将来时|futur simple|简单将来/i, label: "Futur simple (简单将来时)" },
    { re: /现在分词|participe présent|participe present/i, label: "Participe présent (现在分词)" },
    { re: /过去分词|participe passé|participe passe/i, label: "Participe passé (过去分词)" },
    { re: /直陈式现在|présent|present/i, label: "Présent (直陈式现在时)" },
  ];

  const ALL_TENSES = [
    "Plus-que-parfait (愈过去时)",
    "Présent (直陈式现在时)",
    "Imparfait (未完成过去时)",
    "Passé composé (复合过去时)",
    "Passé simple (简单过去时)",
    "Futur simple (简单将来时)",
    "Conditionnel présent (条件式现在时)",
    "Subjonctif présent (虚拟式现在时)",
    "Plus-que-parfait (愈过去时)",
    "Futur antérieur (先将来时)",
  ];

  function normKey(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
  }

  function lookupGender(en) {
    const raw = String(en || "").trim();
    const head = raw.split(/\s+/)[0].replace(/^l['’]/i, "").replace(/^(le|la|les|un|une|des|du|de la|d')\s+/i, "");
    const key = normKey(head);
    if (GENDER[key]) return GENDER[key];
    if (FEM_SUFFIX.test(key)) return "f";
    if (MASC_SUFFIX.test(key)) return "m";
    return null;
  }

  function genderLabel(g) {
    return g === "f" ? "阴" : g === "m" ? "阳" : "";
  }

  function genderNounTag(g) {
    return g === "f" ? "（阴性名词）" : g === "m" ? "（阳性名词）" : "";
  }

  function fixGenderInZh(en, zh) {
    const g = lookupGender(en);
    if (!g || !zh) return zh;
    let s = String(zh);
    const want = genderLabel(g);
    const wrong = g === "f" ? "阳" : "阴";

    s = s.replace(/[（(](?:阴性|阳性)(?:名词)?[）)]/g, genderNounTag(g));
    s = s.replace(/[（(](?:阴|阳)(?:·复)?[）)]/g, g === "f" ? "（阴）" : "（阳）");
    s = s.replace(/(?:名词·)?(?:阴|阳)(?:·复)?(?=[，,；;—\-]|$)/g, want);
    s = s.replace(/n\.(?:f|m)\./gi, g === "f" ? "n.f." : "n.m.");

    if (!/[（(](?:阴|阳)|n\.(?:f|m)\./i.test(s) && /名词/.test(s)) {
      s = s.replace(/名词/, `名词·${want}`);
    }
    if (!/[（(](?:阴|阳)|n\.(?:f|m)\.|名词·(?:阴|阳)/.test(s) && !/动词|形容词|副词|介词|连词|专有名词/.test(s)) {
      const tag = genderNounTag(g);
      if (!s.includes(tag)) s = `${s.replace(/\s+$/, "")}${tag}`;
    }
    return s;
  }

  function looksLikeVerb(en) {
    const s = String(en || "").trim();
    if (!s || s.split(/\s+/).length > 4) return false;
    if (inferVerbMeta(s)) return true;
    if (/^(avoir|être|faire|aller|venir|pouvoir|vouloir|devoir|savoir|voir|dire|prendre|mettre|partir|sortir|tenir|falloir|subir|crever|penser|supporter)$/i.test(s)) return true;
    return /['’]|(?:ions|iez|aient|era|erais|erait|èrent|ait|ons|ez|ent|ais|é|ée|és|ées|u|us|ut|ir|is|it|iss|issent|erai|eras|erez|eront|irai|irais)$/i.test(s);
  }

  const TENSE_KEYS = {
    infinitif: "Infinitif (不定式)",
    present: "Présent (直陈式现在时)",
    imparfait: "Imparfait (未完成过去时)",
    futur: "Futur simple (简单将来时)",
    conditionnel: "Conditionnel présent (条件式现在时)",
    subjonctif: "Subjonctif présent (虚拟式现在时)",
    participe: "Participe passé (过去分词)",
  };

  const FORM_INDEX = {};
  const BASE_FORMS = {};

  function registerVerb(base, tables) {
    const forms = BASE_FORMS[base] || [];
    for (const [tenseKey, list] of Object.entries(tables)) {
      const tenseLabel = TENSE_KEYS[tenseKey] || tenseKey;
      const items = Array.isArray(list) ? list : Object.values(list);
      for (const form of items) {
        if (!form) continue;
        const entry = { base, tenseKey, tenseLabel, form };
        FORM_INDEX[normKey(form)] = entry;
        if (!forms.includes(form)) forms.push(form);
      }
    }
    BASE_FORMS[base] = forms;
    if (!FORM_INDEX[normKey(base)]) {
      FORM_INDEX[normKey(base)] = { base, tenseKey: "infinitif", tenseLabel: TENSE_KEYS.infinitif, form: base };
      if (!forms.includes(base)) forms.push(base);
    }
  }

  registerVerb("voir", {
    infinitif: ["voir"],
    present: ["vois", "voit", "voyons", "voyez", "voient", "voie", "voies"],
    imparfait: ["voyais", "voyait", "voyions", "voyiez", "voyaient"],
    futur: ["verrai", "verras", "verra", "verrons", "verrez", "verront"],
    conditionnel: ["verrais", "verrait", "verrions", "verriez", "verraient"],
    subjonctif: ["voie", "voies", "voyions", "voyiez"],
    participe: ["vu", "vue", "vus", "vues"],
  });
  registerVerb("subir", {
    infinitif: ["subir"],
    present: ["subis", "subit", "subissons", "subissez", "subissent"],
    imparfait: ["subissais", "subissait", "subissions", "subissiez", "subissaient"],
    futur: ["subirai", "subiras", "subira", "subirons", "subirez", "subiront"],
    conditionnel: ["subirais", "subirait", "subirions", "subiriez", "subiraient"],
    participe: ["subi", "subie", "subis", "subies"],
  });
  registerVerb("avoir", {
    infinitif: ["avoir"],
    present: ["ai", "as", "a", "avons", "avez", "ont"],
    imparfait: ["avais", "avait", "avions", "aviez", "avaient"],
    futur: ["aurai", "auras", "aura", "aurons", "aurez", "auront"],
    conditionnel: ["aurais", "aurait", "aurions", "auriez", "auraient"],
    subjonctif: ["aie", "aies", "ait", "ayons", "ayez", "aient"],
    participe: ["eu"],
  });
  registerVerb("être", {
    infinitif: ["être", "etre"],
    present: ["suis", "es", "est", "sommes", "êtes", "etes", "sont"],
    imparfait: ["étais", "etais", "était", "etait", "étions", "etions", "étiez", "etiez", "étaient", "etaient"],
    futur: ["serai", "seras", "sera", "serons", "serez", "seront"],
    conditionnel: ["serais", "serait", "serions", "seriez", "seraient"],
    subjonctif: ["sois", "soit", "soyons", "soyez", "soient"],
    participe: ["été", "ete"],
  });
  registerVerb("faire", {
    infinitif: ["faire"],
    present: ["fais", "fait", "faisons", "faites", "font"],
    imparfait: ["faisais", "faisait", "faisions", "faisiez", "faisaient"],
    futur: ["ferai", "feras", "fera", "ferons", "ferez", "feront"],
    conditionnel: ["ferais", "ferait", "ferions", "feriez", "feraient"],
    participe: ["fait", "faite", "faits", "faites"],
  });
  registerVerb("aller", {
    infinitif: ["aller"],
    present: ["vais", "vas", "va", "allons", "allez", "vont"],
    imparfait: ["allais", "allait", "allions", "alliez", "allaient"],
    futur: ["irai", "iras", "ira", "irons", "irez", "iront"],
    conditionnel: ["irais", "irait", "irions", "iriez", "iraient"],
    participe: ["allé", "allee", "allés", "allées"],
  });
  registerVerb("venir", {
    infinitif: ["venir"],
    present: ["viens", "vient", "venons", "venez", "viennent"],
    imparfait: ["venais", "venait", "venions", "veniez", "venaient"],
    futur: ["viendrai", "viendras", "viendra", "viendrons", "viendrez", "viendront"],
    conditionnel: ["viendrais", "viendrait", "viendrions", "viendriez", "viendraient"],
    participe: ["venu", "venue", "venus", "venues"],
  });
  registerVerb("pouvoir", {
    infinitif: ["pouvoir"],
    present: ["peux", "peut", "pouvons", "pouvez", "peuvent"],
    imparfait: ["pouvais", "pouvait", "pouvions", "pouviez", "pouvaient"],
    futur: ["pourrai", "pourras", "pourra", "pourrons", "pourrez", "pourront"],
    conditionnel: ["pourrais", "pourrait", "pourrions", "pourriez", "pourraient"],
    participe: ["pu"],
  });
  registerVerb("vouloir", {
    infinitif: ["vouloir"],
    present: ["veux", "veut", "voulons", "voulez", "veulent"],
    imparfait: ["voulais", "voulait", "voulions", "vouliez", "voulaient"],
    futur: ["voudrai", "voudras", "voudra", "voudrons", "voudrez", "voudront"],
    conditionnel: ["voudrais", "voudrait", "voudrions", "voudriez", "voudraient"],
    participe: ["voulu"],
  });
  registerVerb("devoir", {
    infinitif: ["devoir"],
    present: ["dois", "doit", "devons", "devez", "doivent"],
    imparfait: ["devais", "devait", "devions", "deviez", "devaient"],
    futur: ["devrai", "devras", "devra", "devrons", "devrez", "devront"],
    conditionnel: ["devrais", "devrait", "devrions", "devriez", "devraient"],
    participe: ["dû", "du", "due", "dus", "dues"],
  });
  registerVerb("savoir", {
    infinitif: ["savoir"],
    present: ["sais", "sait", "savons", "savez", "savent"],
    imparfait: ["savais", "savait", "savions", "saviez", "savaient"],
    futur: ["saurai", "sauras", "saura", "saurons", "saurez", "sauront"],
    conditionnel: ["saurais", "saurait", "saurions", "sauriez", "sauraient"],
    participe: ["su"],
  });
  registerVerb("dire", {
    infinitif: ["dire"],
    present: ["dis", "dit", "disons", "dites", "disent"],
    imparfait: ["disais", "disait", "disions", "disiez", "disaient"],
    futur: ["dirai", "diras", "dira", "dirons", "direz", "diront"],
    conditionnel: ["dirais", "dirait", "dirions", "diriez", "diraient"],
    participe: ["dit", "dite", "dits", "dites"],
  });
  registerVerb("prendre", {
    infinitif: ["prendre"],
    present: ["prends", "prend", "prenons", "prenez", "prennent"],
    imparfait: ["prenais", "prenait", "prenions", "preniez", "prenaient"],
    futur: ["prendrai", "prendras", "prendra", "prendrons", "prendrez", "prendront"],
    conditionnel: ["prendrais", "prendrait", "prendrions", "prendriez", "prendraient"],
    participe: ["pris", "prise", "prises"],
  });
  registerVerb("mettre", {
    infinitif: ["mettre"],
    present: ["mets", "met", "mettons", "mettez", "mettent"],
    imparfait: ["mettais", "mettait", "mettions", "mettiez", "mettaient"],
    futur: ["mettrai", "mettras", "mettra", "mettrons", "mettrez", "mettront"],
    conditionnel: ["mettrais", "mettrait", "mettrions", "mettriez", "mettraient"],
    participe: ["mis", "mise", "mises"],
  });
  registerVerb("penser", {
    infinitif: ["penser"],
    present: ["pense", "penses", "pensons", "pensez", "pensent"],
    imparfait: ["pensais", "pensait", "pensions", "pensiez", "pensaient"],
    futur: ["penserai", "penseras", "pensera", "penserons", "penserez", "penseront"],
    conditionnel: ["penserais", "penserait", "penserions", "penseriez", "penseraient"],
    participe: ["pensé", "pensee", "pensés", "pensées"],
  });
  registerVerb("crever", {
    infinitif: ["crever"],
    present: ["creve", "creves", "crève", "crèves", "crevons", "crevez", "crevent", "crèvent"],
    imparfait: ["crevais", "crevait", "crevions", "creviez", "crevaient"],
    futur: ["creverai", "creveras", "crevera", "creverons", "creverez", "creveront"],
    conditionnel: ["creverais", "creverait", "creverions", "creveriez", "creveraient"],
    participe: ["crevé", "crevee", "crevée", "crevés", "crevées"],
  });

  function inferVerbMeta(form) {
    const key = normKey(form);
    if (FORM_INDEX[key]) return FORM_INDEX[key];
    const stripped = form.replace(/^(se|me|te|nous|vous|m'|t'|s'|l'|j')/i, "").trim();
    if (stripped && stripped !== form) return FORM_INDEX[normKey(stripped)] || null;
    return null;
  }

  function inferVerbBase(form) {
    return inferVerbMeta(form)?.base || "";
  }

  function conjugationDistractors(form, base, n = 3) {
    const correctKey = normKey(form);
    const meta = inferVerbMeta(form);
    const b = base || meta?.base;
    if (!b || !BASE_FORMS[b]) return [];
    const finite = ["present", "imparfait", "futur", "conditionnel", "subjonctif"];
    const wrong = BASE_FORMS[b].filter((f) => normKey(f) !== correctKey);
    const scored = wrong.map((f) => {
      const m = FORM_INDEX[normKey(f)];
      let score = Math.random();
      if (meta && m && m.tenseKey !== meta.tenseKey) score += 5;
      if (meta && m && finite.includes(m.tenseKey) && finite.includes(meta.tenseKey)) score += 2;
      if (m?.tenseKey === "participe") score -= 6;
      if (m?.tenseKey === "infinitif" && meta?.tenseKey !== "infinitif") score += 0.5;
      if (Math.abs(f.length - String(form).length) <= 4) score += 1;
      if (m && meta && m.tenseKey === meta.tenseKey) score -= 3;
      const fNorm = normKey(f);
      const formNorm = normKey(form);
      if (/ais$/.test(formNorm) && /(rai|rais|ois|ait|is|it)$/.test(fNorm)) score += 2;
      if (/ais$/.test(formNorm) && /(ons|ez|ions|iez)$/.test(fNorm)) score -= 4;
      if (/ir$/.test(formNorm) && /(irai|irais|is|it|issent)$/.test(fNorm)) score += 2;
      return { f, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const out = [];
    const seen = new Set();
    for (const row of scored) {
      const k = normKey(row.f);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(row.f);
      if (out.length >= n) break;
    }
    return out;
  }

  function isVerbWord(w) {
    const en = String(w?.en || "").trim();
    if (!en) return false;
    if (/形容词|adj\.|副词|adv\.|名词·|n\.(?:f|m)\./i.test(`${w.zh || ""} ${w.sense || ""}`)) return false;
    if (w.base || (w.pos && /^v/i.test(w.pos))) return true;
    if (/动词|v\./i.test(`${w.zh || ""} ${w.sense || ""}`)) return true;
    return inferVerbMeta(en) || (looksLikeVerb(en) && !lookupGender(en));
  }

  function extractTense(text, explicit) {
    if (explicit) {
      for (const row of TENSE_ALIASES) {
        if (row.re.test(explicit)) return row.label;
      }
    }
    const blob = String(text || "");
    for (const row of TENSE_ALIASES) {
      if (row.re.test(blob)) return row.label;
    }
    return "";
  }

  function tenseDistractors(answer, n = 3) {
    const pool = ALL_TENSES.filter((t) => t !== answer);
    const shuffled = pool.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    return shuffled.slice(0, n);
  }

  function normalizeWord(w, lang) {
    if (!w || lang !== "fr") return w;
    const out = { ...w };
    const en = String(out.en || "").trim();
    if (!en) return out;

    if (out.zh) out.zh = fixGenderInZh(en, out.zh);
    if (out.sense) out.sense = fixGenderInZh(en, out.sense);

    const g = lookupGender(en);
    if (g) out.gender = g;

    const vmeta = inferVerbMeta(en);
    if (vmeta) {
      if (!out.base) out.base = vmeta.base;
      if (!out.tense) out.tense = vmeta.tenseLabel;
      if (!out.pos) out.pos = "v.";
    } else if (!out.base && looksLikeVerb(en)) {
      out.base = inferVerbBase(en);
    }

    if (!out.tense) {
      out.tense = extractTense(`${out.zh || ""} ${out.sense || ""}`, out.tense);
    }
    if (!out.pos) {
      if (isVerbWord(out) || /动词|v\./i.test(`${out.zh} ${out.sense}`)) out.pos = "v.";
      else if (g) out.pos = g === "f" ? "n.f." : "n.m.";
    }
    return out;
  }

  function normalizeWords(words, lang) {
    return (words || []).map((w) => normalizeWord(w, lang));
  }

  return {
    lookupGender,
    fixGenderInZh,
    looksLikeVerb,
    inferVerbMeta,
    inferVerbBase,
    conjugationDistractors,
    isVerbWord,
    extractTense,
    tenseDistractors,
    ALL_TENSES,
    normalizeWord,
    normalizeWords,
  };
})();

if (typeof module !== "undefined") module.exports = JYH_FR;
