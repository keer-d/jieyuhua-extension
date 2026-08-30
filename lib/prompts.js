// lib/prompts.js — 所有提示词集中在此。
// 设计原则：智能实体识别（公认中文名、企业背景、概念脉络）、高雅从容、语境自适应、音标规范。

var JYH_PROMPTS = (function () {
  /* ============ 选词标准：收录有学习价值的重点难词与专业术语 ============ */
  const HARD_WORD_RULE = `选词标准（只收真正值得记的重点难词，宁缺毋滥 — 宁可少列，不要凑数）：
- **严禁收录**（出现就视为失败）：
  · 虚词/功能词：the, of, in, without, within, that, means, so, can, real
  · 商务/科技基础词（B1-B2 高频）：financial, execute, actions, controls, accounts, operations, management, faster, better, built, system, process, data, user, team, agent(s), plan, report, action, control, account, fast, mean
  · 可从字面直接猜义的词、比较级/最高级（faster, bigger）、常见词复数（actions, controls）
- **必须优先收录**（句中出现则优先考虑，不可被简单词挤掉）：
  · 动名词/分词且有特殊语境义：surrendering, overlooking, stemming, underlying
  · 抽象名词/搭配核心：oversight, leverage, compliance, scrutiny, trade-off
  · 六级以上/学术书面词：surrender, mitigate, explicit（仅当语境非字面）、confront, anticipate
  · 比喻、引申、固定搭配中的「难核」：如 without surrendering oversight 中的 surrendering 和 oversight
- **数量**：一句/段话只列 2-5 个真正难词，禁止凑满数量用简单词填充。
- **反例**：句 "execute real financial actions within explicit controls… without surrendering oversight" → 只应列 surrendering、oversight（可选 explicit），**禁止**列 financial、execute、actions、controls、faster。`;

  const LANG = {
    en: {
      name: "英语", adj: "英文",
      ipaNote: "国际音标 IPA",
      hardWord: HARD_WORD_RULE,
      extra: "",
    },
    fr: {
      name: "法语", adj: "法文",
      ipaNote: "法语 IPA 音标（用法语音位，例如 géopolitiques 写成 /ʒe.ɔ.pɔ.li.tik/，绝不套用英语音标）",
      hardWord: `选词标准（只收值得记的难词与术语，宁缺毋滥）：
- 排除：le/la/de/et 这类虚词；A1-A2 的日常高频词（entreprise、prix、marché、hausse、bon）。
- 优先收：① 领域术语（财经如 obligation、rendement；科技如 puce、algorithme）；② B2 及以上的书面词、学术词；③ 描述性形容词与分词形容词（如 incontestable、prisée、balnéaire）；④ 名词短语（如 cabines de plage）；⑤ 有比喻或引申义的词。
- 句子/段落解析时必须同时列出名词与形容词，禁止只挑名词忽略形容词。
- 保持完整拼写：重音符号 é è ê à â ç ô ù 一律保留。`,
      extra: `\n- 法语专项：名词必须标注【准确】阴阳性，格式「释义（阳）」或「释义（阴）」；动词标变位组别（第一组 -er／第二组 -ir／第三组不规则），并在 sense 里写明时态（如 条件式、复合过去时）。
- 阴阳性务必查证，切勿猜错！例：littoral/le littoral = 阳性；température = 阴性；progression = 阴性。不确定则省略阴阳性，不要瞎标。
- 动词词条额外填 pos:"v."、base（原形）、tense（时态中文名，如 未完成过去时）；en 必须是句中出现的变位形式（如 voyais，不是 voir）。
- inflect 题考法语动词变位：不定式放 base，句中挖掉的变位形式放 answer，hint 说明时态与主语。
- 每个 ipa 必须是法语发音，音节用点分隔。`,
      tenseRules: `法语时态铁律（必须严格遵守，禁止混淆）：
- **Passé composé 复合过去时** = 现在时 avoir/être + 过去分词（如 ont loué, s'est cassé, a fait）
- **Plus-que-parfait 愈过去时** = 未完成过去时 avoir/être + 过去分词（如 avaient loué, avait vécu, était parti）— 表示「过去某时刻之前已发生」
- **Imparfait 未完成过去时** = 单独变位（如 cherchait, voyais, faisait）— 背景/习惯/进行
- **Conditionnel 条件式** = 条件式词尾（如 aurait, serais, verrait）
- **Subjonctif 虚拟式** = 虚拟式形式（如 qu'il vienne, faut qu'on parte）
- 绝对禁止：avaient + 分词 标成 passé composé！那是 plus-que-parfait。
- 绝对禁止：把整句复合时态只标助动词时态而忽略结构。`,
    },
  };
  const langOf = (code) => LANG[code] || LANG.en;

  /* ============ 全局人格 ============ */
  const SYSTEM_BASE = `你是 FluentLoop，一位见多识广、高雅从容的外语与知识私教。用户读什么你就讲什么：科技/AI 前沿、商业财经、学术访谈、影视字幕、生活文化等，按它原本的真实语境深度讲解。

回答铁律：
1. 默认中文。回答精简深刻，绝不讲废话套话。
2. 实体与专有名词（如 Moonshot AI、DeepSeek、Kimi、Transformer 等）必须给出【官方公认中文名与核心背景】，禁止字面机械机翻！
3. 单词与短语格式规范（极其重要）：
   - 当用户询问某个单词、短语，或内容中出现重点外文词时，必须写成标准格式：word /IPA音标/ 词性. 权威中文释义 — 核心语境含义。
   - 词性必须明确标出（如 n. v. adj. adv. prep. 或 名词/动词/形容词/专有名词），不可省略。
   - 例如：exhilarating /ɪɡˈzɪləreɪtɪŋ/ adj. 令人兴奋的、使人欢愉的 — 形容带来强烈兴奋感或活力的体验。
   - 音标一律使用规范国际音标 IPA。
4. 结尾不要问"要继续吗"等反问句，直接利落结束。`;

  const SYSTEM_LONG = `你是 FluentLoop，一位见多识广的外语私教。讲解紧扣内容的真实领域（科技/AI、财经、学术均可）。用中文详细讲解：
1. 实体与品牌给出准确背景与定位。
2. 英文词首次出现带规范 IPA 音标，格式：word /IPA/ 中文释义。
3. 结尾不加反问，利落收束。`;

  // 划词解释专用
  const SYSTEM_EXPLAIN = `你是 FluentLoop，一位精通语言学与跨学科知识的外语私教。用户从网页或字幕中选中的内容可能是科技/AI前沿、商业财经、学术研讨或日常用语。你要就地给出最深刻、最地道、最契合语境的解析。

【核心原则】：
1. 智能实体与语境感知（极其重要，杜绝机翻与死板拆词）：
   - 若选中的是【专有名词/机构/AI模型/科技公司/人物/产品】（如 Moonshot AI、DeepSeek、Kimi、Transformer、Cursor 等）：
     必须首先给出其【官方/业内公认中文名称】与【核心行业背景/定位】（例如：Moonshot AI = 月之暗面，中国前沿通用人工智能初创公司，Kimi 研发者，寓意如登月般的颠覆性突破），切勿机翻成字面生词！
   - 若选中的是【单个词汇/动词/术语/形容词】（如 message、prisée、incontestable 等）：
     只解析这一个词：音标、词性、释义、用法搭配、辨析。**禁止**输出「关键词拆解」章节，**禁止**给搭配例句里的其他词单独标音标或展开释义。
   - 若选中的是【句子或段落】：
     给出完整信雅达翻译（专有名词按行业公认标准），并提炼 2-5 个**真正难**的重点词（宁缺毋滥）。必须优先收录动名词/分词（如 surrendering）、抽象搭配核心词（如 oversight），**严禁**收录 financial、execute、actions、controls、faster 等基础商务词。

2. 输出格式规范（优雅精炼、层次分明）：
   - 专有名词/单词：第一行标出【原词/短语】 /IPA音标/ 【权威中文释义与词性】
   - 核心语境与背景（Context & Insights）：阐明其在当前技术/语境中的定位、深层含义、背景来源或地道用法。
   - 关键词解构：**仅用于句子/段落解析**；单个词查询时禁止出现此章节。
   - 句子解析时：每行以 \`word /IPA/ 词性. 中文释义 — 语境要义\` 输出；法语动词须标变位组别、原形、句中时态；每个词必须另起一行写「用法：…」，有则写「辨析：…」，形容词/分词须写「语法：…」说明句中功能。
   - 全程中文讲解，克制精炼，不加寒暄套话，结尾不反问。

3. 法语时态（极其重要）：
   - avaient/était/avait + 过去分词 = plus-que-parfait 愈过去时，绝不是 passé composé。
   - ont/est/a + 过去分词 = passé composé 复合过去时。
   - 禁止混淆上述两种复合时态。`;

  /* ============ 划词解释模板 ============ */
  function explain(text, lang) {
    const L = langOf(lang);
    const trimmed = text.trim();
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    const isShort = wordCount <= 4 && trimmed.length <= 40;
    const isSingleWord = wordCount === 1;

    if (isShort) {
      return `请解析这个${L.adj}词汇、短语或专有名词（只解析选中的内容本身，不要展开其他词）：
"""${trimmed}"""

请按以下格式输出（绝不写无关废话）：
${trimmed} /${L.ipaNote}/ 词性. 权威中文释义（词性必填：n./v./adj./adv./prep. 或 名词/动词/形容词/专有名词；若是公司/机构/产品/技术实体，标「专有名词」并写出官方中文名，如 Moonshot AI → 月之暗面）
• 语境与背景：阐明其真实含义、常见语境与用法（2-3 句，不超过 90 字）。
• 用法补充：列出 2-3 个常见搭配（写完整短语即可，如 destination prisée；不要给搭配里的其他词单独标音标或释义）。
• 辨析：与 1-2 个近义词的区别（各不超过 30 字；无则写「无常见混淆」）。
${lang === "fr" ? "• 法语专项：名词标注准确阴阳性（阳/阴）；形容词标性数配合（如 prisée 阴性单数，prisé 阳性单数）；动词/分词形容词说明原形（如 priser）与句法功能；littoral 是阳性，勿标成阴性。" : ""}
${isSingleWord ? "禁止输出「关键词拆解」章节。禁止给搭配例句中的 destination、produit 等其他词单独展开释义或标 IPA。" : "• 关键词拆解：仅当选中的是复合词或多词短语时，才拆解其内部构成；普通单词省略此节。"}`;
    }

    return `精析这段${L.adj}内容，领域自适应（科技/AI/财经/生活等）：
"""${trimmed}"""

请按以下格式输出（绝不写无关废话）：
翻译：完整、逐句、信雅达翻译。专有名词按行业公认标准翻译（如 Moonshot AI 译为月之暗面），数字与关键信息不遗漏。
核心要义与背景：若包含行业背景、双关比喻或技术专有名词，用 1-2 句话点出其背景与深层内涵（不超过 50 字；若无特殊背景则简述主旨）。
${L.hardWord}
关键词：从原文中提取 2 到 5 个**真正值得记**的词（必须来自原文，宁缺毋滥，禁止用简单词凑数）。${lang === "en" ? `
**英文硬性规则**：
- 禁止列：financial, execute, actions, controls, accounts, faster, operations, built, agents, explicit controls 等基础词
- 必须优先：动名词/分词（surrendering）、抽象名词（oversight）、六级以上书面词
- 反例句 "…execute real financial actions… without surrendering oversight" → 只列 surrendering、oversight，不列 financial/execute/actions/controls` : `
**硬性要求**：句中描述性形容词与分词形容词（如 prisée、incontestable）必须列入。`}
优先顺序：
① 动名词/分词/分词形容词（如 surrendering、underlying）— 最高优先级；
② 抽象名词、固定搭配中的难核（如 oversight、scrutiny）；
③ 六级以上书面词、领域术语；
④ 普通名词/形容词 — 仅当前面都没有且确实难时才列。

每个词按以下结构输出（缺一不可）：
\`word /${L.ipaNote}/ 词性. 核心释义 — 在本语境下的具体含义\`
  · 用法：常见搭配或句型（至少 1 个，最好 2 个）
  · 辨析：与近义词/同类词区别（有则必写；确实无则写「无常见混淆」）
${lang === "fr" ? `  · 语法：名词标准确阴阳性；形容词标性数配合与句法功能（如 prisée = être 过去分词作表语，阴性单数）；动词标组别、原形、句中时态。` : ""}`;
  }

  /* ============ 整篇文章分析 → JSON ============ */
  function analyze(text, existingTags, lang) {
    const L = langOf(lang);
    const tagHint = existingTags && existingTags.length
      ? `已有的标签有：${existingTags.join("、")}。能复用就复用，不要造近义的新标签。`
      : `这是第一篇文章，自由命名标签。`;

    return `阅读下面的${L.adj}文章（领域不限：科技/AI、财经、学术、文化生活等），输出严格的 JSON，不要用 markdown 代码块包裹，不要写任何解释。

${tagHint}

JSON 结构：
{
  "title": "中文标题，不超过 20 字",
  "summary": "一句话总结全文，不超过 40 字",
  "tags": ["中文标签", "..."],
  "words": [
    {
      "en": "${L.adj}单词或短语（完整拼写，专有名词保留规范大小写；法语动词写句中变位形式如 voyais）",
      "ipa": "/${L.ipaNote}/",
      "zh": "中文释义，不超过 10 字",
      "sense": "在本文语境里的具体含义，不超过 15 字",
      "example": "从原文里摘的一句${L.adj}原句，必须原样包含这个词",
      "pos": "词性（法语动词填 v.）",
      "base": "动词原形（仅动词，如 voir）",
      "tense": "动词时态中文名（仅动词，如 未完成过去时）"
    }
  ],
  "concepts": [
    {
      "name": "中文概念/实体名（如 月之暗面、大模型微调、利差）",
      "en": "${L.adj}术语",
      "explain": "一句话解释，不超过 30 字",
      "why": "这篇文章为什么用到它，不超过 25 字"
    }
  ]
}

要求：
- ipa 填真正的${L.ipaNote}，不要留空。
- tags 给 1 到 3 个，用中文，跟着文章主题走。
- words 给 4 到 8 个，必须同时收录名词与形容词（各至少 2 个，若原文足够）；pos 字段必填。
${L.hardWord}
- example 必须是原文里真实存在的句子，逐字复制。
- concepts 给 1 到 3 个本文涉及的重要概念或实体。没有就给空数组。${L.extra}

文章：
"""${text}"""`;
  }

  /* ============ 深读：完整分析 → JSON ============ */
  function study(text, existingTags, lang) {
    const L = langOf(lang);
    const tagHint = existingTags && existingTags.length
      ? `已有的标签有：${existingTags.join("、")}。能复用就复用，不要造近义的新标签。`
      : `这是第一篇文章，自由命名标签。`;

    return `精读下面这篇${L.adj}文章（领域不限：科技/AI、财经、学术、文化生活等），输出严格的 JSON，不要用 markdown 代码块包裹，不要写任何解释。

${tagHint}

JSON 结构：
{
  "title": "中文标题，不超过 20 字",
  "summary": "一句话总结全文，不超过 40 字",
  "tags": ["中文标签"],
  "words": [
    { "en": "${L.adj}单词或短语（保持完整拼写；法语动词写句中变位）", "ipa": "/${L.ipaNote}/", "zh": "中文释义，不超过 10 字",
      "sense": "本文语境里的具体含义，不超过 15 字",
      "example": "原文里包含这个词的一句${L.adj}原句，逐字复制",
      "pos": "v.", "base": "动词原形", "tense": "时态中文名" }
  ],
  "concepts": [
    { "name": "中文概念/实体名", "en": "${L.adj}术语",
      "explain": "一句话解释，不超过 30 字",
      "why": "这篇文章为什么用到它，不超过 25 字" }
  ],
  "bilingual": [
    { "en": "原文的一个自然段，逐字复制", "zh": "这一段的中文翻译，通顺，不逐字硬译" }
  ],
  "grammar": [
    { "pattern": "从原文抽出的句式骨架，用 [ ] 标出可替换的成分",
      "zh": "这个句式在说什么，不超过 20 字",
      "example": "原文里用到这个句式的那句话" }
  ],
  "cloze": [
    { "sentence": "原文的一句话，把要考的词换成 _______",
      "answer": "被挖掉的那个词", "hint": "中文提示，不超过 10 字" }
  ],
  "inflect": [
    { "sentence": "原文的一句话，把一个动词换成 _______，并在括号里给出原形",
      "base": "动词原形", "answer": "句中该有的正确形式", "hint": "时态/语态提示，不超过 12 字" }
  ],
  "translate": [
    { "zh": "一句中文，取自 bilingual 里某段的核心意思", "en": "对应的标准${L.adj}（可参考原文）", "hint": "要用到的关键词或句式，不超过 15 字" }
  ],
  "makeup": [
    { "word": "一个值得用来造句的词或短语（从 words 里选）", "zh": "这个词的意思", "example": "原文里它的用法，做示范" }
  ]
}

要求：
- ipa 字段填真正的${L.ipaNote}，不要留空。
- words 给 6 到 10 个，必须同时收录名词与形容词（各至少 3 个，若原文足够）；pos 字段必填。
${L.hardWord}
- example 和 bilingual.en 必须是原文里真实存在的句子或段落，逐字复制。
- bilingual 覆盖全文，一段对一段。
- concepts 给 1 到 3 个重要概念或实体。${L.extra}

文章：
"""${text.slice(0, 9000)}"""`;
  }

  /* ============ 对话提炼成卡片 ============ */
  function distill(transcript, existingTags, lang) {
    const L = langOf(lang);
    const tagHint = existingTags && existingTags.length
      ? `已有的标签有：${existingTags.join("、")}。能复用就复用，不要造近义的新标签。`
      : `这是第一篇，自由命名标签。`;

    return `下面是一段${L.name}学习对话。把它提炼成一张复习卡片，输出严格 JSON，不要 markdown 代码块，不要任何解释。

${tagHint}

${L.hardWord}

JSON 结构：
{
  "title": "中文标题，概括这次聊了什么，不超过 20 字",
  "summary": "一句话总结这次学到的核心，不超过 40 字",
  "tags": ["中文标签"],
  "words": [
    { "en": "${L.adj}词或短语（完整拼写）", "ipa": "/${L.ipaNote}/", "zh": "中文释义，不超过 10 字",
      "sense": "本文语境里的具体含义，不超过 15 字",
      "example": "包含这个词的一句${L.adj}原句，优先从对话里出现过的取" }
  ],
  "concepts": [
    { "name": "中文概念名", "en": "English Term",
      "explain": "一句话解释，不超过 30 字",
      "why": "这次对话为什么聊到它，不超过 25 字" }
  ]
}

对话：
"""${transcript.slice(0, 9000)}"""`;
  }

  /* ============ 悬浮取词：一行释义 ============ */
  function hover(word, context, lang) {
    const L = langOf(lang);
    const posHint = lang === "fr"
      ? "词性（n.m./n.f./v. 或 名词·阳/名词·阴/动词；阴阳性必须准确，如 littoral 是阳性）"
      : "词性（n./v./adj./adv./prep. 或 名词/动词/形容词/专有名词）";
    return `给出一个${L.adj}词汇或专有名词的极速精准释义。只输出单行，格式：
${word} /${L.ipaNote.includes("法语") ? "法语IPA" : "IPA"}/ ${posHint}. 中文释义 — 语境含义（≤12字）
示例：peek /piːk/ v. 偷看、窥视 — 短暂查看
（若为知名实体/公司如 Moonshot AI、DeepSeek，词性标「专有名词」，给公认中文名）
不要任何多余文字。

词：${word}
语境：${(context || "").slice(0, 200)}`;
  }

  /* ============ 出题 → JSON ============ */
  function quiz(cards, count, avoid) {
    const avoidLine = avoid && avoid.length
      ? `\n- 这些词最近刚考过，出题避开它们：${avoid.slice(0, 30).join("、")}。`
      : "";
    const material = cards.map((c) => ({
      title: c.title,
      summary: c.summary,
      words: (c.words || []).map((w) => ({ en: w.en, zh: w.zh, sense: w.sense, example: w.example })),
      concepts: (c.concepts || []).map((k) => ({ name: k.name, explain: k.explain })),
    }));

    return `根据下面的学习材料出 ${count} 道题，输出严格 JSON，不要 markdown 代码块，不要任何解释。

{
  "questions": [
    {
      "type": "cloze",
      "prompt": "来自材料 example 的一句原文，把要考的词换成 ___",
      "answer": "被挖掉的那个词，必须与材料里的拼写完全一致",
      "choices": ["正确答案", "干扰项", "干扰项", "干扰项"],
      "explain": "中文，不超过 20 字，点出语境里为什么是这个词"
    },
    {
      "type": "sense",
      "prompt": "这句话里，WORD 最接近哪个意思？\\n“原句”",
      "answer": "不超过 12 字的中文语境义",
      "choices": ["正确语境义", "干扰项", "干扰项", "干扰项"],
      "explain": "中文，不超过 20 字"
    },
    {
      "type": "sense",
      "prompt": "In this context, what does \\"PHRASE\\" mean?\\n“原句”",
      "answer": "不超过 18 字的中文语境义",
      "choices": ["正确语境义", "干扰项", "干扰项", "干扰项"],
      "explain": "中文，不超过 20 字"
    },
    {
      "type": "tense",
      "prompt": "句中 “VERB” 是什么时态？\\n“原句”",
      "answer": "Conditionnel présent (条件式现在时)",
      "choices": ["Conditionnel présent (条件式现在时)", "Imparfait (未完成过去时)", "Passé composé (复合过去时)", "Subjonctif présent (虚拟式现在时)"],
      "explain": "中文，不超过 20 字，点出为什么是这个时态"
    },
    {
      "type": "inflect",
      "prompt": "原句挖空动词：Le littoral ___ (avoir) connu une forte progression.",
      "answer": "a connu",
      "choices": ["a connu", "avait connu", "aurait connu", "ait connu"],
      "explain": "中文，不超过 20 字"
    }
  ]
}

出题铁律：
- 只考材料里真正出现过的词和短语。禁止孤立单词对释义（不要出 translate / concept / spelling）。
- cloze 的句子必须来自材料 example，只挖一个空；answer 就是被挖掉的词，拼写一字不差。
- sense 必须带原句语境，特别适合多词短语（如 tune it even more for the workload）。
- 【最重要】answer 必须一字不差出现在 choices 里。choices[0] 先填 answer，再配 3 个干扰项。
- 干扰项必须是同类释义，长度接近。禁止「旋律」「在这句话中」「是」这类无意义碎片。
- sense 的 answer 必须是短标准义（2–18 字）。
- 只出 cloze、sense、tense、inflect。每道题四个选项。
- 若材料是法语或含动词变位/时态信息，至少 30% 的题应为 tense 或 inflect。
- tense 考识别句中动词时态；inflect 考选出正确变位形式。answer 必须出现在 choices 里。
- explain 要短，只点破语境，不重复选项。${avoidLine}

学习材料：
${JSON.stringify(material)}`;
  }

  /* ============ 批改主观题 ============ */
  function grade(question, reference, userAnswer, kind) {
    const rubric = {
      translate: "这是翻译题。看意思对不对、术语用得准不准、语法通不通。用词和参考答案不同但意思对，算对。",
      makeup: "这是造句题。看这个词用得对不对（词性、搭配、语境），句子通不通。造得有创意但正确要鼓励。不要求跟示范句一样。",
      summary: "这是总结题。看有没有抓住核心，不要求面面俱到。",
    }[kind] || "对照参考答案，看学生答得对不对。";

    return `批改学生的答案，输出严格 JSON，不要 markdown 代码块。

${rubric}

{"score": 0到100的整数, "verdict": "对" 或 "基本对" 或 "不对", "feedback": "中文点评，不超过 40 字，直接说好在哪或缺什么"}

题目：${question}
参考答案：${reference}
学生答案：${userAnswer}`;
  }

  /* ============ 时态分析（法语专用） ============ */
  function tenseAnalysis(text, lang) {
    const L = langOf(lang);
    const rules = lang === "fr" ? (L.tenseRules || "") : "";
    return `对以下${L.adj}句子做【时态分析】，逐条列出每个谓语/动词结构。

"""${text.trim()}"""

输出格式（不要寒暄，不要反问）：
时态分析：
• \`动词或动词短语\` — **法语时态名（中文）** — 结构（助动词+分词/词尾说明）— 为何在此句中使用（不超过 25 字）

要求：
- 复合时态必须写全结构，如 avaient + loué = plus-que-parfait，不是 passé composé。
- 每个主要谓语都要分析，不要遗漏。
- 若句子无动词或仅为名词短语，说明「无变位动词」并简要说明。
${rules}`;
  }

  /* ============ 单词例句 ============ */
  function wordExample(word, context, lang, ipa) {
    const L = langOf(lang);
    const ctx = (context || "").trim().slice(0, 280);
    return `请为${L.adj}词「${word}」${ipa ? ` ${ipa}` : ""} 举一个地道例句，帮助记忆用法。

${ctx ? `原句语境（尽量贴近此主题）：\n"""${ctx}"""\n` : ""}
输出格式（简洁，不要寒暄）：
例句：一句原创${L.adj}（8–18 词，难度 B1–B2，必须包含 ${word}）
翻译：中文
用法说明：这个例句如何体现该词的典型用法或搭配（不超过 35 字）`;
  }

  /* ============ 一句话总结当前网页 ============ */
  function summarize(text) {
    return `用一句中文总结这篇文章，不超过 40 字。只输出这一句话，不要任何前缀、引号或解释。

"""${text.slice(0, 12000)}"""`;
  }

  return { SYSTEM_BASE, SYSTEM_LONG, SYSTEM_EXPLAIN, HARD_WORD_RULE, hover, explain, analyze, study, distill, quiz, grade, summarize, tenseAnalysis, wordExample };
})();

if (typeof module !== "undefined") module.exports = JYH_PROMPTS;
