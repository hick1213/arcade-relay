// ArcadeRelay Phase 1: brief → 策划、设计全套（concept / gdd / art-bible / assets）
// 调用方: /forge-concept（contract.md §4）。args = {briefPath, reviewMode, engine?}（engine 为 contract §11 的3个值之一。省略时为 phaser）
// 评审循环严格遵循 .codex/docs/review-loops.md 的对应表与 MAX_ITER。
// Gate 判定提示词通过 ID 引用 .codex/docs/gates.md（禁止复制正文＝防止漂移）。

export const meta = {
  name: 'concept-design',
  description: 'Phase 1: 从 brief 通过 produce→review→revise 循环自主生成策划、设计全套，并返回 Checkpoint A 材料',
  phases: [
    { title: 'Concept', detail: 'game-designer 起草 design/concept.md → DR-CONCEPT 评审循环（最多3次）' },
    { title: 'GDD', detail: 'game-designer 起草 design/gdd.md → DR-GDD 评审循环（最多3次）' },
    { title: 'ArtBible', detail: '生成4张 key image 候选 → art-reviewer 排序 → 起草 art-bible.md/.json → AR-BIBLE 评审循环（最多3次）' },
    { title: 'Assets', detail: 'art-director 先行创建 design/assets.md 的骨架＋图像章节 → audio-designer 追加写入音频章节（串行2段）' },
    { title: 'Final', detail: 'creative-director 进行 CD-CHECKPOINT 判定。若为 REJECT 则按指示仅修正1次后重新判定' }
  ]
};

// ---------------------------------------------------------------------------
// schema 定义
// ---------------------------------------------------------------------------

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['APPROVE', 'CONCERNS', 'REJECT'] },
    findings: {
      type: 'array',
      items: { type: 'string' },
      description: '按优先级排列的具体问题。APPROVE 时为空数组'
    }
  },
  required: ['verdict', 'findings']
};

const KEY_IMAGE_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'design/refs/ 下的候选文件路径（仓库相对路径）' },
          kind: { type: 'string', enum: ['image', 'style-description'] },
          note: { type: 'string', description: '风格方向的一句话备注' }
        },
        required: ['path', 'kind']
      }
    },
    degraded: { type: 'boolean', description: '是否因无图像生成密钥而本地降级（仅风格描述）' }
  },
  required: ['candidates', 'degraded']
};

const RANK_SCHEMA = {
  type: 'object',
  properties: {
    ranking: {
      type: 'array',
      items: { type: 'string' },
      description: '按优劣顺序排列的候选文件路径'
    },
    rationale: { type: 'string', description: '排序依据（含第1名的采用理由）' }
  },
  required: ['ranking', 'rationale']
};

const CD_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['APPROVE', 'CONCERNS', 'REJECT'] },
    findings: {
      type: 'array',
      items: { type: 'string' },
      description: '应向人类展示的顾虑、已知问题（CONCERNS/REJECT 时）'
    },
    fixes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          assignee: { type: 'string', enum: ['game-designer', 'art-director', 'audio-designer'] },
          artifact: { type: 'string', description: '修正对象的产出物路径（仅限 contract.md §6 的路径）' },
          instruction: { type: 'string', description: '具体的修正指示' }
        },
        required: ['assignee', 'artifact', 'instruction']
      },
      description: 'REJECT 时的修正指示列表。APPROVE/CONCERNS 时为空数组'
    }
  },
  required: ['verdict', 'findings', 'fixes']
};

// ---------------------------------------------------------------------------
// 对 transient 错误（safety classifier 临时失败等）仅自动重试1次（retro-e3 问题5）。
// 给 label 加上 -retry 并改变 opts = 缓存键改变，避免 replay 失败结果。
// 重试后仍为 null 则照旧由调用方上报
// ---------------------------------------------------------------------------
async function agentR(prompt, opts) {
  let r = await agent(prompt, opts);
  if (r === null) {
    log('agent 为 null（可能是 transient）→ 重试1次: ' + ((opts && opts.label) || ''));
    // 禁止盲目重跑: 首次调用可能是「作业完成后仅丢失了结构化响应」，
    // 因此前置 resume 守卫，防止已完成的作业（提交、资产生成、计费 API 调用）被重复执行
    const guarded = '【重试执行】前一次相同任务的调用可能因丢失结构化响应而中断。开始作业前先确认已有成果（git log 的最近提交、已生成文件、MANIFEST 追加写入），已完成的操作（提交、资产生成、计费 API 调用）不得重复。仅执行未完成部分；若全部已完成则不要重新执行，只返回结果的结构化响应。\n\n' + prompt;
    r = await agent(guarded, Object.assign({}, opts, { label: (((opts && opts.label) || 'agent') + '-retry') }));
  }
  return r;
}

// ---------------------------------------------------------------------------
// reviewLoop 辅助函数（实现 review-loops.md 的通用形式）
// producer 作业 → reviewer 判定（向 state/reviews/<artifact>.md 追加写入是 reviewer agent 的责任）→
// 非 APPROVE 则指示 producer 进行 revise（最后一次 iteration 也先 revise 再上报）→
// 最多 maxIter 次 → 未解决问题累积到 unresolved（不停止流水线）
// 全部 verdict 累积到 verdictHistory 并包含在返回值中（review-mode=full 完成后的展示材料）
// ---------------------------------------------------------------------------

async function reviewLoop(opts) {
  const {
    gateId,          // 'DR-CONCEPT' 等（contract.md §5）
    reviewArtifact,  // state/reviews/<artifact>.md 中的 <artifact>（例: 'concept'）
    artifactPaths,   // 评审对象文件路径的数组
    producerType,    // 执行 revise 的 agent 名（contract.md §2）
    reviewerType,    // 执行判定的 agent 名（contract.md §2）
    phaseTitle,      // agent opts 的 phase 标签
    maxIter,         // review-loops.md 的 MAX_ITER
    producerContextPaths, // revise 时 producer 应参考的文件路径
    unresolved,      // 未解决问题的累积目标（调用方的数组）
    verdictHistory   // 全部 verdict 的累积目标（调用方的数组）
  } = opts;

  const reviewFile = 'state/reviews/' + reviewArtifact + '.md';
  let finalVerdict = 'REJECT';

  for (let i = 1; i <= maxIter; i++) {
    const review = await agentR(
      [
        '你是 Gate ' + gateId + ' 的判定者。',
        '1. 阅读 .codex/docs/gates.md 的「' + gateId + '」章节，按其要点批评对象。',
        '2. 对象产出物: ' + artifactPaths.join(' / ') + '（各文件须自行阅读。相关上下文: ' + producerContextPaths.join(' / ') + '）。',
        '3. 务必将判定以 .codex/docs/review-loops.md 的追加写入格式追加写入 ' + reviewFile + '（## ' + gateId + ' iteration ' + i + ' — <verdict>、日期时间 ISO8601、问题摘要。「处理:」栏留空。日期时间使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）。',
        '4. 响应的第1行为「' + gateId + ': APPROVE|CONCERNS|REJECT」，并在结构化返回的 verdict / findings 中填入相同的判定与问题。',
        'findings 仅限按优先级排列、可修正的具体问题。APPROVE 时为空数组。'
      ].join('\n'),
      { agentType: reviewerType, label: gateId + ' review #' + i, phase: phaseTitle, schema: REVIEW_SCHEMA }
    );

    if (!review) {
      log(gateId + ' iteration ' + i + ': reviewer 未响应（skip/error）。视为无法判定并继续');
      unresolved.push(gateId + ': iteration ' + i + ' 中 reviewer 未响应，无法判定');
      break;
    }

    finalVerdict = review.verdict;
    const count = review.findings ? review.findings.length : 0;
    verdictHistory.push({
      gate: gateId,
      artifact: reviewArtifact,
      iteration: i,
      verdict: review.verdict,
      findings: review.findings || []
    });
    log(gateId + ' iteration ' + i + ': ' + review.verdict + (count ? '（问题 ' + count + ' 项）' : ''));

    if (review.verdict === 'APPROVE') {
      return { verdict: 'APPROVE', iterations: i };
    }

    // 非 APPROVE 即使在最后一次 iteration 也先执行1次 revise 再上报（review-loops.md 的通用形式）
    const revised = await agentR(
      [
        'Gate ' + gateId + ' 的判定为 ' + review.verdict + '。请 revise 产出物。',
        '1. 阅读 ' + reviewFile + '，确认最新的「## ' + gateId + ' iteration ' + i + '」中的问题。',
        '2. 修正对象: ' + artifactPaths.join(' / ') + '。参考上下文: ' + producerContextPaths.join(' / ') + '。',
        '3. 将对各问题的处理/暂不处理＋理由追加写入 ' + reviewFile + ' 中对应 iteration 的「处理:」栏（禁止无视）。'
      ].join('\n'),
      { agentType: producerType, label: gateId + ' revise #' + i, phase: phaseTitle, effort: 'high' }
    );

    if (!revised) {
      log(gateId + ' iteration ' + i + ': revise 未执行（producer skip/error）');
      unresolved.push(gateId + ': iteration ' + i + ' 的 revise 未执行（producer skip/error）');
      break;
    }

    if (i === maxIter) {
      const fs = review.findings || [];
      for (const f of fs) unresolved.push(gateId + ': ' + f);
      if (fs.length === 0) unresolved.push(gateId + ': 到达 MAX_ITER（' + review.verdict + '，问题详情见 ' + reviewFile + '）');
      log(gateId + ': 到达 MAX_ITER=' + maxIter + '。最终 revise 已执行（不再重新判定），未解决问题上报至 Checkpoint A（流水线继续）');
    }
  }

  return { verdict: finalVerdict, iterations: maxIter };
}

// ---------------------------------------------------------------------------
// 主体（Workflow 运行器执行顶层代码。不使用 default export）
// ---------------------------------------------------------------------------

// args 规范化: 防御调用方/运行器以 JSON 字符串传入的情况（E2 中实测。
// 无法解析的字符串抛出明确错误 — 不静默回落到默认值）
const ARGS = (typeof args === 'string') ? JSON.parse(args) : (args || {});
const briefPath = ARGS.briefPath;
const reviewMode = ARGS.reviewMode || 'lean';
if (!briefPath) throw new Error('args.briefPath 为必需（通常为 design/brief.md）');

// 引擎配置（contract.md §11。值须与各 tech-stack 文档一致）
// 仅 engine 未指定时默认为 phaser。空字符串、非法值交给下方的 throw（禁止无声回退）
const engine = (ARGS.engine !== undefined && ARGS.engine !== null) ? ARGS.engine : 'phaser';
const ENGINE_PROFILES = {
  phaser: {
    stack: 'Phaser 3 + TS',
    techStackDoc: '.codex/docs/tech-stack.md',
    assets3d: false
  },
  unity: {
    stack: 'Unity 6 LTS + C#（URP、3D）',
    techStackDoc: '.codex/docs/tech-stack-unity.md',
    assets3d: true
  },
  unreal: {
    stack: 'Unreal Engine 5.x + C++（3D）',
    techStackDoc: '.codex/docs/tech-stack-unreal.md',
    assets3d: true
  }
};
const EP = ENGINE_PROFILES[engine];
if (!EP) throw new Error('args.engine 非法: ' + engine + '（contract §11: phaser|unity|unreal）');

log('concept-design 开始: brief=' + briefPath + ' / engine=' + engine + ' / review-mode=' + reviewMode +
  '（全部 verdict 累积到 verdictHistory 后返回。full 模式下由 skill 在完成后向人类展示全部记录）');

const unresolved = [];
const verdictHistory = [];

// ---- Phase 1: Concept -------------------------------------------------
phase('Concept');

const conceptDraft = await agentR(
  [
    '起草 design/concept.md。',
    '1. 阅读 brief: ' + briefPath + '。',
    '2. 若模板 .codex/docs/templates/concept.md 存在，严格遵循其结构。',
    '3. 定义3～5个支柱 P-01～（contract.md §8。彼此独立、具备可用于裁定决策的具体性）。',
    '4. 包含乐趣假设（1句话、可证伪）、核心循环（30秒内可说明、在1个画面内成立）、范围（数小时的自主实现可达成）。',
    '5. 预先满足 .codex/docs/gates.md 的 DR-CONCEPT 要点。'
  ].join('\n'),
  { agentType: 'game-designer', label: 'concept 起草', phase: 'Concept', effort: 'high' }
);
if (!conceptDraft) throw new Error('design/concept.md 起草失败（game-designer 未响应）');

await reviewLoop({
  gateId: 'DR-CONCEPT',
  reviewArtifact: 'concept',
  artifactPaths: ['design/concept.md'],
  producerType: 'game-designer',
  reviewerType: 'design-reviewer',
  phaseTitle: 'Concept',
  maxIter: 3,
  producerContextPaths: [briefPath],
  unresolved,
  verdictHistory
});

// ---- Phase 2: GDD ------------------------------------------------------
phase('GDD');

const gddDraft = await agentR(
  [
    '起草 design/gdd.md。',
    '1. 阅读 ' + briefPath + ' 与 design/concept.md。',
    '2. 若模板 .codex/docs/templates/gdd.md 存在，严格遵循其结构。',
    '3. 全部系统须引用 concept.md 的支柱 P-xx。数值以初始值＋调整范围书写（禁止「以后再定」）。',
    '4. 定义胜利/失败条件、重新开始、游戏流程（必需场景集合 Boot→Title→Menu→Game→Result→{Game|Menu} — contract §11。含 Menu 的必需元素）。各系统分解到可用 ' + EP.stack + ' 在数小时内实现的粒度。',
    '5. 务必填写「元进度（游戏外）」节（templates/gdd.md: 最高分/最佳时间+统计=必需，按照 brief 的「游戏外 / 深度可玩性」取向采用2个以上可选元素。各元素须带 P-xx、初始值+调整范围、ACH/UNL/UPG 稳定 ID、存档对象键与首次启动时的初始状态）。',
    '6. 预先满足 .codex/docs/gates.md 的 DR-GDD 要点（6个要点）。技术前提与 ' + EP.techStackDoc + ' 保持一致。'
  ].join('\n'),
  { agentType: 'game-designer', label: 'gdd 起草', phase: 'GDD', effort: 'high' }
);
if (!gddDraft) throw new Error('design/gdd.md 起草失败（game-designer 未响应）');

await reviewLoop({
  gateId: 'DR-GDD',
  reviewArtifact: 'gdd',
  artifactPaths: ['design/gdd.md'],
  producerType: 'game-designer',
  reviewerType: 'design-reviewer',
  phaseTitle: 'GDD',
  maxIter: 3,
  producerContextPaths: [briefPath, 'design/concept.md'],
  unresolved,
  verdictHistory
});

// ---- Phase 3: ArtBible -------------------------------------------------
phase('ArtBible');

const keyGen = await agentR(
  [
    '生成4张 key image 候选。',
    '1. 阅读 ' + briefPath + ' / design/concept.md / design/gdd.md，把握游戏的基调与支柱 P-xx。',
    '2. 阅读 state/asset-routing.json，用其中记载的提供者路由生成（禁止生成中重新判定路由。遵循 .codex/docs/assets-config.md）。预算遵守 state/budget.txt，预计超支则停止生成并降级。',
    '3. 4张彼此的风格方向要有所不同（例: 调色板、画风、密度）。生成物保存到 design/refs/key-image-candidate-1.png ～ key-image-candidate-4.png。',
    '4. 若路由为本地降级（无图像生成密钥），则以风格描述（style block 方案、hex 调色板、参考词汇）代替图像写入 design/refs/key-image-candidate-1.md ～ -4.md，并在各文件中明确注明占位方针（前提是 Checkpoint A 之后替换为真实图像、must_replace）。',
    '5. 结构化返回: candidates（path / kind / note）与 degraded（是否降级）。'
  ].join('\n'),
  { agentType: 'art-director', label: 'key image 候选生成', phase: 'ArtBible', schema: KEY_IMAGE_SCHEMA, effort: 'high' }
);

let keyImageCandidates = [];
if (keyGen && keyGen.candidates) {
  keyImageCandidates = keyGen.candidates;
  if (keyGen.degraded) log('key image 生成为本地降级（仅风格描述、占位方针）');
} else {
  log('key image 候选生成失败（art-director 未响应）。以风格描述为基础继续');
  unresolved.push('AR-BIBLE: key image 候选生成未执行。art-bible 仅以风格描述起草');
}

const candidatePaths = keyImageCandidates.map(function (c) { return c.path; });

let topCandidate = null;
if (candidatePaths.length > 0) {
  const rank = await agentR(
    [
      '对 key image 候选进行排序。',
      '候选: ' + candidatePaths.join(' / ') + '（各文件须自行阅读/查看）。',
      '要点: 沿用 .codex/docs/gates.md 中 AR-BIBLE 的 2（游戏内可辨识性）与 3（生成可复现性），并检查与 design/concept.md 的支柱 P-xx 的一致性。',
      '将结果以「key image 排序」为标题追加写入 state/reviews/art-bible.md（名次、依据、日期时间 ISO8601。日期时间使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写），并在结构化返回的 ranking 中按优劣顺序填入 path。'
    ].join('\n'),
    { agentType: 'art-reviewer', label: 'key image 排序', phase: 'ArtBible', schema: RANK_SCHEMA }
  );
  if (rank && rank.ranking && rank.ranking.length > 0) {
    topCandidate = rank.ranking[0];
    log('key image 最优候选: ' + topCandidate);
  } else {
    topCandidate = candidatePaths[0];
    log('排序失败。以候选1（' + topCandidate + '）作为暂定基准继续');
    unresolved.push('AR-BIBLE: key image 排序未执行。采用候选1作为暂定基准');
  }
}

const bibleDraft = await agentR(
  [
    '编写 design/art-bible.md 与 design/art-bible.json。',
    (topCandidate
      ? '基准 key image: ' + topCandidate + '（art-reviewer 评出的最优候选。最终批准由人类在 Checkpoint A 进行，因此其他候选也要在 art-bible.md 中列出以便替换）。'
      : '由于没有真实图像候选，请根据 design/concept.md / design/gdd.md 的基调用语言确定风格，并在 art-bible.md 中明确注明占位方针（真实图像在 Checkpoint A 之后生成并由人类批准）。'),
    '1. 若模板 .codex/docs/templates/art-bible.md 存在，遵循其结构。',
    '2. design/art-bible.json 严格遵循 .codex/docs/assets-config.md「风格一致性协议」的 schema（style_block / palette / style_codes / reference_images / character_reference / resolution）。不允许仅用模糊形容词的指定。',
    '3. 分辨率、瓦片尺寸、透明方针与 ' + EP.techStackDoc + ' 保持一致。',
    (EP.assets3d
      ? '4. 因为是 3D 引擎，务必填写「## 3D 风格方针」节（多边形预算、纹理分辨率/PBR、rig 方针、比例规范）（遵循模板的指引与 assets-config.md 的 3D 路由表）。'
      : '4.（因为是 2D，3D 风格方针节按模板指示删除。）'),
    '5. 预先满足 .codex/docs/gates.md 的 AR-BIBLE 要点。'
  ].join('\n'),
  { agentType: 'art-director', label: 'art-bible 起草', phase: 'ArtBible', effort: 'high' }
);
if (!bibleDraft) throw new Error('design/art-bible.md/.json 起草失败（art-director 未响应）');

await reviewLoop({
  gateId: 'AR-BIBLE',
  reviewArtifact: 'art-bible',
  artifactPaths: ['design/art-bible.md', 'design/art-bible.json'],
  producerType: 'art-director',
  reviewerType: 'art-reviewer',
  phaseTitle: 'ArtBible',
  maxIter: 3,
  producerContextPaths: ['design/concept.md', 'design/gdd.md', 'state/asset-routing.json'],
  unresolved,
  verdictHistory
});

// ---- Phase 4: Assets（art-director 先行 → audio-designer 追加写入的串行2段）----
phase('Assets');

const assetFieldRules = [
  '全部资产条目必需: id（稳定 ID、禁止重新编号。contract.md §8 的资产 ID 格式）/ 尺寸（图像为 px、音频为秒）/ 提示词草案 / 提供者路由（按 state/asset-routing.json 的路由明确写出）/ 引用支柱 P-xx（design/concept.md）。',
  '若模板 .codex/docs/templates/assets.md 存在，遵循其结构。'
];

// 段1: art-director 单独创建骨架（文档头 + 标题），并起草图像（+3D 模型）章节
const imageSection = await agentR(
  [
    (EP.assets3d
      ? '创建 design/assets.md。先建立文档头与「## 图像」「## 音频」「## 3D 模型」「## 骨骼动画」的标题骨架，然后在此基础上起草「## 图像」「## 3D 模型」「## 骨骼动画」章节。'
      : '创建 design/assets.md。先建立文档头与「## 图像」「## 音频」两个标题的骨架，然后在此基础上起草「## 图像」章节。'),
    '1. 阅读 design/gdd.md 与 design/art-bible.md / design/art-bible.json，梳理出全部所需图像资产（精灵/角色/UI/背景/瓦片）。',
    '2. 各提示词草案以前置 art-bible.json 的 style_block 为前提编写。尺寸、透明方针与 ' + EP.techStackDoc + ' / art-bible.json 的 resolution 保持一致。',
    (EP.assets3d
      ? '3. 3D 模型（MDL-xx）从 gdd 的登场实体中梳理，kind / 多边形预算 / rig / 所需动画（ANM-xx）须与 assets-config.md 的 3D 路由表、art-bible 的 3D 风格方针保持一致（contract §8: MDL/ANM 为稳定 ID）。'
      : '3.（因为是 2D，不创建 3D 模型/动画节。）'),
    '4. 「## 音频」章节仅放置标题，不写内容（之后由 audio-designer 追加写入）。'
  ].filter(Boolean).concat(assetFieldRules).join('\n'),
  { agentType: 'art-director', label: 'assets.md 骨架＋图像章节', phase: 'Assets', effort: 'high' }
);
if (!imageSection) unresolved.push('assets.md: 骨架＋图像章节的起草未执行（art-director skip/error）');

// 段2: audio-designer 追加写入音频章节（不触碰图像章节）
const audioSection = await agentR(
  [
    '起草 design/assets.md 的「## 音频」章节。',
    '1. 阅读 design/gdd.md 与 design/concept.md，梳理出全部所需音频资产（SFX/BGM）。',
    '2. SFX 明确写出 duration_seconds，BGM 以循环为前提、固定流派/BPM/调性书写（遵循 .codex/docs/assets-config.md）。',
    '3. design/assets.md 应已由 art-director 创建了骨架与「## 图像」章节。仅用 Edit 追加写入「## 音频」章节，其他章节一律不触碰。万一文件不存在，则先建立文档头与「## 图像」「## 音频」的骨架，再编写音频章节。'
  ].concat(assetFieldRules).join('\n'),
  { agentType: 'audio-designer', label: 'assets.md 音频章节', phase: 'Assets', effort: 'high' }
);
if (!audioSection) unresolved.push('assets.md: 音频章节的起草未执行（audio-designer skip/error）');

const assetsMerge = await agentR(
  [
    '对 design/assets.md 执行一致性检查（内容改写保持最小）。',
    '1. 若有重复标题、骨架混乱，仅修复结构。不改动音频章节的条目内容。',
    '2. 检查全部条目是否具备必需字段（id / 尺寸 / 提示词草案 / 提供者路由 / P-xx 引用），缺失项在文档末尾以「## 缺失检查」列出（不得擅自补填）。',
    '3. 确认 id 无重复、无重新编号。'
  ].join('\n'),
  { agentType: 'art-director', label: 'assets.md 一致性检查', phase: 'Assets' }
);
if (!assetsMerge) {
  unresolved.push('assets.md: 一致性检查未执行。可能残留重复标题、缺失字段');
}

// ---- Phase 5: Final（CD-CHECKPOINT）------------------------------------
phase('Final');

const cdPromptLines = [
  '你是 Gate CD-CHECKPOINT 的判定者。请进行 Checkpoint A 展示前的最终判定。',
  '1. 阅读 .codex/docs/gates.md 的「CD-CHECKPOINT」章节，按其要点判定。',
  '2. 对象: ' + briefPath + ' / design/concept.md / design/gdd.md / design/art-bible.md / design/art-bible.json / design/assets.md。同时确认评审历史 state/reviews/ 下的内容。',
  '3. 将判定以 .codex/docs/review-loops.md 的追加写入格式追加写入到 state/reviews/checkpoint-a.md。日期时间使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出（禁止凭推测填写）。',
  '4. 响应的第1行为「CD-CHECKPOINT: APPROVE|CONCERNS|REJECT」。结构化返回的 verdict / findings / fixes 中也填入相同内容。',
  '5. 若为 REJECT，在 fixes 中填入修正指示（assignee 为 game-designer / art-director / audio-designer 之一，artifact 为 contract.md §6 的路径）。APPROVE/CONCERNS 时 fixes 为空数组。',
  '6. 最后更新 state/active.md（当前位置: Phase1 完成、等待 Checkpoint A / 下一步操作: 人类批准 key image 与策划设计全套 / 未解决事项: 评审中残留的问题。日期时间使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）。'
];

let cd = await agentR(cdPromptLines.join('\n'), {
  agentType: 'creative-director',
  label: 'CD-CHECKPOINT 判定',
  phase: 'Final',
  schema: CD_SCHEMA,
  effort: 'high'
});

if (!cd) {
  log('CD-CHECKPOINT: creative-director 未响应。在无法判定的状态下进入 Checkpoint A');
  unresolved.push('CD-CHECKPOINT: 判定未执行（creative-director skip/error）');
} else {
  log('CD-CHECKPOINT: ' + cd.verdict);
  verdictHistory.push({
    gate: 'CD-CHECKPOINT',
    artifact: 'checkpoint-a',
    iteration: 1,
    verdict: cd.verdict,
    findings: cd.findings || []
  });

  if (cd.verdict === 'REJECT') {
    // review-loops.md: 若为 REJECT 则按指示修正后，仅重新判定1次
    const fixes = (cd.fixes || []).filter(function (f) {
      return f && f.assignee && f.artifact && f.instruction;
    });
    if (fixes.length > 0) {
      // fix 本身可并行。但向 state/reviews/checkpoint-a.md 的「处理:」栏追加写入
      // 为防止冲突，在 fix 完成后由 game-designer 一次性汇总完成（此处不追加写入）
      const fixResults = await parallel(fixes.map(function (f) {
        return function () {
          return agentR(
            [
              'CD-CHECKPOINT 判定为 REJECT。请按以下指示修正 ' + f.artifact + '。',
              '指示: ' + f.instruction,
              '判定全文请阅读 state/reviews/checkpoint-a.md（仅阅读。不要向该文件追加写入。处理记录在修正完成后由另一 agent 汇总完成）。',
              '请在响应中报告修正内容的摘要。'
            ].join('\n'),
            { agentType: f.assignee, label: 'CD修正: ' + f.artifact, phase: 'Final', effort: 'high' }
          );
        };
      }));
      const doneCount = fixResults.filter(Boolean).length;
      log('CD-CHECKPOINT 修正: ' + doneCount + '/' + fixes.length + ' 项完成');
      // 不让失败的单个 fix 指示无记录（仅有 doneCount 的 log 无法传达给人类 — 审计问题）
      fixResults.forEach(function (r, idx) {
        if (r === null || r === undefined) {
          unresolved.push('CD-CHECKPOINT: 修正指示「[' + fixes[idx].assignee + '] ' + fixes[idx].artifact + ' — ' + fixes[idx].instruction + '」的 fix agent 失败（可能未处理）');
        }
      });

      const fixRecord = await agentR(
        [
          'CD-CHECKPOINT REJECT 后的修正已完成。请在 state/reviews/checkpoint-a.md 对应 iteration 的「处理:」栏中，以1次追加写入汇总记录对以下各修正指示的处理内容（禁止无视。未执行、未达成的指示须注明「未处理」及理由）。'
        ].concat(fixes.map(function (f, idx) {
          return (idx + 1) + '. [' + f.assignee + '] ' + f.artifact + ' — ' + f.instruction;
        })).concat([
          '阅读各 artifact 的现状，确认实际发生了什么变化后再记录。'
        ]).join('\n'),
        { agentType: 'game-designer', label: 'CD修正的处理记录', phase: 'Final' }
      );
      if (!fixRecord) {
        unresolved.push('CD-CHECKPOINT: 修正的处理记录未执行（state/reviews/checkpoint-a.md 的「处理:」栏仍为空）');
      }
    } else {
      log('CD-CHECKPOINT: REJECT 但 fixes 为空。不做修正直接重新判定');
    }

    const cd2 = await agentR(cdPromptLines.join('\n').replace('追加写入到 state/reviews/checkpoint-a.md。', '追加写入到 state/reviews/checkpoint-a.md（作为 iteration 2）。'), {
      agentType: 'creative-director',
      label: 'CD-CHECKPOINT 重新判定',
      phase: 'Final',
      schema: CD_SCHEMA,
      effort: 'high'
    });
    if (cd2) {
      cd = cd2;
      log('CD-CHECKPOINT 重新判定: ' + cd.verdict);
      verdictHistory.push({
        gate: 'CD-CHECKPOINT',
        artifact: 'checkpoint-a',
        iteration: 2,
        verdict: cd2.verdict,
        findings: cd2.findings || []
      });
    } else {
      unresolved.push('CD-CHECKPOINT: 重新判定未执行。以初次 REJECT 的状态进入 Checkpoint A');
    }
  }

  if (cd.verdict !== 'APPROVE') {
    for (const f of (cd.findings || [])) unresolved.push('CD-CHECKPOINT: ' + f);
  }
}

// ---- 返回值（Checkpoint A 材料。向人类展示是 skill 侧的责任）----------------
const verdict = cd ? cd.verdict : 'CONCERNS';
const artifacts = [
  'design/concept.md',
  'design/gdd.md',
  'design/art-bible.md',
  'design/art-bible.json',
  'design/assets.md'
];

return {
  summary:
    'Phase 1（策划、设计）完成。concept / gdd / art-bible / assets 已通过 produce→review→revise 循环创建。' +
    'CD-CHECKPOINT 判定: ' + verdict + '。' +
    '重要: 最终 key image 的批准由人类在 Checkpoint A 进行。请从 keyImageCandidates（' + keyImageCandidates.length + ' 项）中判断采用或退回。' +
    (unresolved.length > 0 ? ' 有 ' + unresolved.length + ' 项未解决问题（见 unresolvedFindings）。' : ' 无未解决问题。') +
    ' 全部评审判定历史包含在 verdictHistory（' + verdictHistory.length + ' 项）中（review-mode=full 时由 skill 展示全部记录）。',
  artifacts: artifacts,
  keyImageCandidates: keyImageCandidates,
  unresolvedFindings: unresolved,
  verdictHistory: verdictHistory,
  verdict: verdict
};
