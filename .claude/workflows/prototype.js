// ArcadeRelay Phase 2 — prototype.js
// 调用方: /forge-prototype（contract.md §4）。args = { reviewMode, engine?, checkpointAFeedbackPath? }（engine 为 contract §11 的3个值之一。省略时为 phaser）
// 自主制作可玩的垂直切片（核心循环能跑通一轮的最小原型），并返回 Checkpoint B 材料。
// 命名、ID、路径全部遵循 .claude/docs/contract.md。循环规范见 .claude/docs/review-loops.md。
// 注意: Workflow runner 会在顶层执行本脚本本体（不使用 default export）。

export const meta = {
  name: 'prototype',
  description: 'Phase 2: 将 gdd 分解为 story，并行进行核心循环垂直切片的实现与资产生成，经 QA 后返回 Checkpoint B 材料',
  phases: [
    { title: 'Setup', detail: 'tech-director 生成 game/ 脚手架、docs/architecture.md、docs/conventions.md、state/stories.yaml' },
    { title: 'Build', detail: '将 phase:prototype story 按 assignee lane（gameplay/ui）并行实现（lane 内顺序执行、lane 中不做引擎验证），每个 story 通过 CR-CODE 评审循环（MAX 2）。lane 合流后串行执行批量验证' },
    { title: 'AssetGen', detail: 'art-director 生成核心循环必需的图像（engine=unity/unreal 时还包括 3D 模型 MDL/ANM），audio-designer 生成核心 SFX，并通过 AR-ASSET 循环（MAX 3 + fallback 1）' },
    { title: 'Integrate', detail: '负责的 engineer 将生成资产经由资产键权威来源（phaser: ASSET_KEYS / unity: GameConfig.AssetKeys / unreal: GameConfig.h 常量）集成到 game/ 并做 typecheck/build 验证（串行区间、含引擎导入）' },
    { title: 'QA', detail: 'qa-lead 执行 QA-PLAY（实际启动、实际操作、证据），重大 bug 进入修复循环（MAX 2）' },
    { title: 'Final', detail: 'creative-director 做 CD-CHECKPOINT 判定，整理并返回 Checkpoint B 材料' },
  ],
};

// ---------------------------------------------------------------------------
// 通用常量（contract.md §6/§7 的路径。禁止自创）
// ---------------------------------------------------------------------------
const DOCS = {
  contract: '.claude/docs/contract.md',
  gates: '.claude/docs/gates.md',
  reviewLoops: '.claude/docs/review-loops.md',
  techStack: '.claude/docs/tech-stack.md', // 按 engine 区分 — 下方 EP 确定后替换为 engine 对应值
  assetsConfig: '.claude/docs/assets-config.md',
};
const ART = {
  brief: 'design/brief.md',
  concept: 'design/concept.md',
  gdd: 'design/gdd.md',
  artBible: 'design/art-bible.md',
  artBibleJson: 'design/art-bible.json',
  assetsManifest: 'design/assets.md',
  architecture: 'docs/architecture.md',
  conventions: 'docs/conventions.md',
  manifest: 'game/assets/MANIFEST.jsonl', // 按 engine 区分 — 下方 EP 确定后替换为 engine 对应值
  qaReport: 'qa/report.md',
  qaEvidence: 'qa/evidence/',
};
const STATE = {
  stories: 'state/stories.yaml',
  active: 'state/active.md',
  budget: 'state/budget.txt',
  assetRouting: 'state/asset-routing.json',
  reviewsDir: 'state/reviews',
};

// ---------------------------------------------------------------------------
// 引擎配置（contract.md §11。取值须与各 tech-stack 文档的「验证命令」「规范」一致）
// phaser 的取值与原有提示词字符串保持逐字一致（向后兼容）。
// ---------------------------------------------------------------------------
// args 归一化: 防御调用方/runner 以 JSON 字符串传入的情况（E2 实测。
// 无法解析的字符串转为显式错误 — 不静默回落到默认值）
const ARGS = (typeof args === 'string') ? JSON.parse(args) : (args || {});
// 仅在 engine 未指定时默认为 phaser。空字符串、非法值转到下方 throw（禁止静默 fallback）
const engine = (ARGS.engine !== undefined && ARGS.engine !== null) ? ARGS.engine : 'phaser';
const ENGINE_PROFILES = {
  phaser: {
    stack: 'Vite + TypeScript(strict) + Phaser 3（最新稳定版）',
    techStackDoc: '.claude/docs/tech-stack.md',
    manifestPath: 'game/assets/MANIFEST.jsonl',
    rawAssetDir: 'game/assets/',
    assets3d: false,
    verifyCmd: 'cd game && npm run typecheck && npm run build',
    scaffoldTask:
      '1. 严格遵守 tech-stack.md 搭建 game/ 脚手架: Vite + TypeScript(strict) + Phaser 3（最新稳定版）。\n' +
      '   必需 scripts(dev/build/typecheck/preview)、规定的目录结构（src/main.ts, src/config.ts, src/scenes/{Boot,Title,Menu,Game,Result}Scene（contract §11 必需场景集合）, src/systems/, src/systems/meta/, src/persistence/, src/ui/, src/types.ts, assets/）。\n' +
      '   在 src/config.ts 中预留 ASSET_KEYS 常量的容器。以空文件创建 game/assets/MANIFEST.jsonl。\n' +
      '   自我修正直到 `cd game && npm install && npm run typecheck && npm run build` 以 exit 0 结束。',
    codeRulesLine: '严格遵守规范: 魔法数字放入 src/config.ts / 必须使用 delta-time / Scene 保持轻薄，逻辑放在 systems/ / 输入抽象化 / 资产引用经由 ASSET_KEYS / 持久化 I/O 仅限 src/persistence/，元进度放在 systems/meta/（禁止存档损坏时静默初始化 — rules/gameplay-code.md）。',
    placeholderNote: '图像、音频仍在生成中，因此可用 Phaser 的 Graphics/generateTexture 等做占位符（先只定义 ASSET_KEYS 的键，保持可替换）。',
    codeRulesFile: '.claude/rules/gameplay-code.md',
    codeAddExample: '`git add game/src game/package.json state/stories.yaml`',
    configPath: 'game/src/config.ts',
    laneVerifyLine: '执行 `cd game && npm run typecheck`，**仅将自己编辑的文件导致的错误**归零（其他 lane 的半成品 WIP、对其他 lane 计划提供的 API 的引用所导致的错误可以忽略 — lane 合流后的批量验证做最终确认。**并行 lane 期间不要执行 `npm run build`** — dist/ 会与其他 lane 冲突 — tech-stack.md「验证命令」节）',
    qaTarget: '实际构建、启动 game/，并在 headless 浏览器中实际操作进行试玩测试（不允许纸面确认。必须有证据）。',
    qaBuildLine: '`cd game && npm run build` 成功，启动时 console 错误为 0。',
    playInstructions: '用 cd game && npm install && npm run dev 本地启动（操作方法参见 design/gdd.md）',
    integrateSteps:
      '1. 将 game/assets/ 的全部资产注册到 src/config.ts 的 ASSET_KEYS（禁止硬编码路径。引用必须经由 ASSET_KEYS）。\n' +
      '2. 在 BootScene 中 preload，并将 Build 阶段的占位符（Graphics/generateTexture）替换为真实资产。\n' +
      '3. 音频在用户操作后才开始播放（首次输入时 AudioContext resume。应对 autoplay 限制）。\n' +
      '4. UI 类资产（HUD、按钮等）替换量大时，该部分要仔细处理（遵循 ui/ 下的规范）。\n' +
      '5. 自我修正直到 `cd game && npm run typecheck && npm run build` 以 exit 0 结束。'
  },
  unity: {
    stack: 'Unity 6 LTS + C#（URP、3D。使用 state/engine-info.json 中的编辑器）',
    techStackDoc: '.claude/docs/tech-stack-unity.md',
    manifestPath: 'game/_generated/MANIFEST.jsonl',
    rawAssetDir: 'game/_generated/',
    assets3d: true,
    verifyCmd: 'tech-stack-unity.md「验证命令」中相当于 typecheck 的步骤（EditMode 测试。合格 = exit 0 且结果 XML 中 failed 为 0 — 禁止仅凭 exit code 判定）与相当于 build 的步骤（ForgeBuild.BuildMac）',
    scaffoldTask:
      '1. 严格遵守 tech-stack-unity.md 搭建 game/ 脚手架（使用「项目生成（scaffold）」节的命令。编辑器为 state/engine-info.json 的 binary）。\n' +
      '   在 Packages/manifest.json 中明确写入必需包（URP / Input System / glTFast / Test Framework），并创建规定的目录结构（Assets/Scenes/{Boot,Title,Menu,Game,Result}（contract §11 必需场景集合，EditorBuildSettings 也是这5个场景）, Assets/Scripts/{GameConfig.cs,Types.cs,Systems/,Systems/Meta/,Persistence/,Components/,Input/,Ui/,Editor/ForgeBuild.cs}, Assets/Tests/{EditMode,PlayMode}, Assets/Resources/Generated/, _generated/）。\n' +
      '   在 GameConfig.cs 中预留常量与 AssetKeys 的容器，在 Editor/ForgeBuild.cs 中准备 BuildMac 方法，在 EditMode 中准备最小测试1个。以空文件创建 game/_generated/MANIFEST.jsonl。\n' +
      '   自我修正直到 tech-stack-unity.md「验证命令」中相当于 typecheck 的步骤（EditMode 测试）与相当于 build 的步骤（ForgeBuild.BuildMac）以 exit 0 结束。',
    codeRulesLine: '严格遵守规范: 魔法数字放入 Assets/Scripts/GameConfig.cs / 必须使用 Time.deltaTime / Components 保持轻薄，逻辑放在 Systems/（pure C#，禁止 MonoBehaviour）/ Input System 集中管理（代码生成方式）/ 资产引用经由 GameConfig.cs 的 AssetKeys / 持久化 I/O 仅限 Persistence/，元进度放在 Systems/Meta/（禁止存档损坏时静默初始化 — rules/unity-code.md）/ UI Canvas 固定为 RenderMode.ScreenSpaceCamera（tech-stack-unity.md 规范14）。',
    placeholderNote: '3D 模型、音频仍在生成中，因此可用 Unity 基本体（Cube/Capsule 等）＋单色材质做占位符（先只定义 AssetKeys 的键，保持可替换）。',
    codeRulesFile: '.claude/rules/unity-code.md',
    codeAddExample: '`git add game/Assets game/Packages game/ProjectSettings state/stories.yaml`',
    configPath: 'game/Assets/Scripts/GameConfig.cs',
    laneVerifyLine: '**此处不要启动 Unity**（单实例锁 — 会与并行 lane、资产 lane 冲突。EditMode/构建验证在 lane 合流后的批量验证区间统一执行 — tech-stack-unity.md「验证命令」节）。作为替代，用 Read/Grep 静态确认所引用的类型、成员、资产键、序列化对象确实存在，不留下无法通过编译的引用',
    qaTarget: '按照 tech-stack-unity.md「QA-PLAY 的执行方法」，用 batchmode 构建与 PlayMode 测试（模拟输入发送、LogAssert、ScreenCapture）对 game/ 做实际游玩验证（不允许纸面确认。必须有测试结果 XML 与截图证据）。',
    qaBuildLine: 'tech-stack-unity.md 中相当于 build 的步骤（ForgeBuild.BuildMac batchmode）以 exit 0 结束，PlayMode 测试通过 LogAssert.NoUnexpectedReceived()（错误为 0）。',
    playInstructions: '用 open game/Build/ForgeGame.app 启动（或在 Unity 编辑器中打开 game/ 后 Play。操作方法参见 design/gdd.md）',
    integrateSteps:
      '1. 将 game/_generated/ 中的合格资产（MDL/ANM/图像/音频）复制到 game/Assets/Resources/Generated/{models,textures,audio}/ 并让 Unity 导入（Resources.Load 方式 — contract §11。AssetKeys 的值为 Resources 相对路径），注册到 GameConfig.cs 的 AssetKeys（禁止硬编码路径）。\n' +
      '2. 带 rig 的 FBX 用编辑器脚本设置 ModelImporter 的 animationType（Humanoid 则为 Human）并确认 Avatar 生成成功。将占位符（基本体）替换为真实资产。\n' +
      '3. 导入后用包围盒做缩放验证（tech-stack-unity.md「资产处理」）。\n' +
      '4. 音频用 AudioSource 接线（OGG）。\n' +
      '5. 自我修正直到 tech-stack-unity.md「验证命令」中相当于 typecheck 的步骤（EditMode 测试）与相当于 build 的步骤（ForgeBuild.BuildMac）以 exit 0 结束。'
  },
  unreal: {
    stack: 'Unreal Engine 5.x + C++（3D。使用 state/engine-info.json 中的引擎。禁止 Blueprint 逻辑）',
    techStackDoc: '.claude/docs/tech-stack-unreal.md',
    manifestPath: 'game/_generated/MANIFEST.jsonl',
    rawAssetDir: 'game/_generated/',
    assets3d: true,
    verifyCmd: 'tech-stack-unreal.md「验证命令」中相当于 typecheck/build 的步骤（BuildCookRun -build。执行测试时的合格 = exit 0 且报告 JSON 中 failed 为 0）',
    scaffoldTask:
      '1. 严格遵守 tech-stack-unreal.md 搭建 game/ 脚手架（「项目生成（scaffold）」节: 模板复制方式。项目名固定为 ForgeGame）。\n' +
      '   创建规定的目录结构（Source/ForgeGame/{GameConfig.h,Types.h,Systems/,Systems/Meta/,Persistence/,Actors/,Input/,Ui/}, Source/ForgeGameTests/, Content/{Generated/,Maps/}, Config/, _generated/）。Maps/ 为 Boot/Title/Menu/Game/Result 的5个状态（contract §11。关卡拆分 or 状态转移）。\n' +
      '   在 GameConfig.h 中预留常量的容器，在 ForgeGameTests 中准备最小 Automation Test 1个。以空文件创建 game/_generated/MANIFEST.jsonl。\n' +
      '   自我修正直到 tech-stack-unreal.md「验证命令」中相当于 typecheck/build 的步骤（BuildCookRun -build）以 exit 0 结束。',
    codeRulesLine: '严格遵守规范: 魔法数字放入 Source/ForgeGame/GameConfig.h / 必须使用 DeltaSeconds / Actors 保持轻薄，逻辑放在 Systems/（pure C++，禁止 UObject）/ Enhanced Input 集中管理 / 资产路径经由 GameConfig.h 的常量。不把逻辑放在 Blueprint 中 / 持久化（USaveGame）仅限 Persistence/，元进度放在 Systems/Meta/（禁止存档损坏时静默初始化 — rules/unreal-code.md）。',
    placeholderNote: '3D 模型、音频仍在生成中，因此可用 UE BasicShapes（Cube/Capsule 等）＋单色材质做占位符（先只定义 GameConfig.h 的资产常量，保持可替换）。',
    codeRulesFile: '.claude/rules/unreal-code.md',
    codeAddExample: '`git add game/Source game/Config game/ForgeGame.uproject state/stories.yaml`',
    configPath: 'game/Source/ForgeGame/GameConfig.h',
    laneVerifyLine: '**此处不要启动 UE/UBT**（单实例锁 — 会与并行 lane、资产 lane 冲突。BuildCookRun 验证在 lane 合流后的批量验证区间统一执行 — tech-stack-unreal.md「验证命令」节）。作为替代，用 Read/Grep 静态确认所引用的类型、成员、头文件 include 确实存在，不留下无法通过编译的引用',
    qaTarget: '按照 tech-stack-unreal.md「QA-PLAY 的执行方法」，用 BuildCookRun 与 Automation RunTests（报告 JSON、截图）对 game/ 做实际游玩验证（不允许纸面确认。必须有证据）。',
    qaBuildLine: 'tech-stack-unreal.md 中相当于 package 的步骤（BuildCookRun）以 exit 0 结束，Automation 报告 JSON 中 failed 为 0。',
    playInstructions: '用 open game/Build/Mac/ForgeGame.app 启动（操作方法参见 design/gdd.md）',
    integrateSteps:
      '1. 将 game/_generated/ 中的合格资产（MDL/ANM/图像/音频）通过 Interchange（Python: unreal.InterchangeManager）导入到 game/Content/Generated/，并注册到 GameConfig.h 的资产常量（FSoftObjectPath）（禁止在实现中直接写路径字符串）。\n' +
      '2. 带 rig 的 FBX 确认骨架导入成功，必要时用 IK Rig / IK Retargeter（Python API）重定向。将占位符（BasicShapes）替换为真实资产。\n' +
      '3. 导入后用包围盒做缩放验证（UE 为 1 unit = 1cm。tech-stack-unreal.md「资产处理」）。\n' +
      '4. 音频将 WAV 作为 SoundWave 接线。\n' +
      '5. 自我修正直到 tech-stack-unreal.md「验证命令」中相当于 typecheck/build 的步骤（BuildCookRun -build）以 exit 0 结束。'
  }
};
const EP = ENGINE_PROFILES[engine];
if (!EP) throw new Error('args.engine 无效: ' + engine + '（contract §11: phaser|unity|unreal）');
// 反映按 engine 区分的权威路径（替换 const 对象的属性。phaser 保持原有值）
DOCS.techStack = EP.techStackDoc;
ART.manifest = EP.manifestPath;

// ---------------------------------------------------------------------------
// 运行时状态
// ---------------------------------------------------------------------------
const reviewMode = ARGS.reviewMode || 'lean';
const checkpointAFeedbackPath = ARGS.checkpointAFeedbackPath || null;
const unresolvedFindings = [];
const knownIssues = [];
// 全部 verdict 历史（contract.md §9 / review-loops.md: full 模式下由 skill 在完成后的
// Checkpoint 展示中将全部条目展示给人类。执行中不做逐次展示）
const verdictHistory = [];

function recordVerdict(gateId, artifactName, iteration, verdict, findingsSummary) {
  verdictHistory.push({
    gate: gateId,
    artifact: artifactName,
    iteration: iteration,
    verdict: verdict,
    findings: findingsSummary || [],
  });
}

// review-mode 调制（contract.md §9 / review-loops.md）。前置于 reviewer 提示词。
function reviewModeNote(mode) {
  if (mode === 'full') {
    return '【review-mode: full】循环为自动。verdict 由 workflow 作为历史累积，完成后在 Checkpoint 汇总展示给人类（执行中不向人类展示）。';
  }
  return '【review-mode: ' + mode + '】循环为自动。无需向人类展示（未解决问题在 Checkpoint 汇总展示）。';
}

// 返回更严重的 verdict（用于合并评审对）
function worseVerdict(a, b) {
  const rank = { APPROVE: 0, CONCERNS: 1, REJECT: 2 };
  return (rank[b] || 0) > (rank[a] || 0) ? b : a;
}

// ---------------------------------------------------------------------------
// 对 transient 错误（safety classifier 临时失败等）仅做1次自动重试（retro-e3 问题5）。
// 给 label 加上 -retry 改变 opts = 缓存键改变，避免 replay 失败结果。
// 重试后仍为 null 则照旧由调用方上报
// ---------------------------------------------------------------------------
async function agentR(prompt, opts) {
  let r = await agent(prompt, opts);
  if (r === null) {
    log('agent 返回 null（可能是 transient）→ 重试1次: ' + ((opts && opts.label) || ''));
    // 禁止盲目重新执行: 首次调用可能是「作业完成后仅丢失了结构化响应」，
    // 因此前置 resume 守卫，防止已完成作业（提交、资产生成、计费 API 调用）被重复执行
    const guarded = '【重试执行】上一次同一任务调用可能在丢失结构化响应后中断。开始作业前先确认既有成果（git log 的最近提交、已生成文件、MANIFEST 追加写入），已完成的操作（提交、资产生成、计费 API 调用）不要重复。只执行未完成的部分，若全部已完成则不要重新执行，仅做结果的结构化返回。\n\n' + prompt;
    r = await agent(guarded, Object.assign({}, opts, { label: (((opts && opts.label) || 'agent') + '-retry') }));
  }
  return r;
}

// lane/track 粒度的异常守卫: parallel() 会把 thunk 的异常吞成 null，因此若不处理，
// 整个 lane 的中断（剩余 story 未实现）不会出现在 unresolvedFindings 的任何位置。
// 在 thunk 内 catch 并累积 [BLOCKER]（thunk 内的 catch 先于 parallel 吞掉异常）
function laneSafe(name, fn) {
  return async function () {
    try {
      return await fn();
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      log('[laneSafe] ' + name + ' 因异常中断: ' + msg); // 也让执行中的观察者看到（unresolvedFindings 直到终点都不可见）
      unresolvedFindings.push('[BLOCKER] ' + name + ' 因异常中断: ' + msg + '（之后的负责作业可能未执行 — 用 state/reviews 与 git log 确认实施范围）');
      return null;
    }
  };
}

// ---------------------------------------------------------------------------
// reviewLoop 辅助函数（review-loops.md 的通用形式。与 concept-design.js 同形、自包含）
//   cfg = {
//     gateId, artifactName, maxIter, reviewMode,
//     produce: async () => any|null,                    // 首次制作。null = 失败
//     review:  async (iteration) => {verdict, findings[]}|null,
//     revise:  async (findings, iteration) => any|null, // 反映问题
//   }
// 返回值: { ok, verdict, unresolved: string[] }
// 达到 MAX_ITER 且非 APPROVE → 上报（不停止流水线，带回未解决问题）
// ---------------------------------------------------------------------------
async function reviewLoop(cfg) {
  const produced = await cfg.produce();
  if (produced === null || produced === undefined) {
    log('[' + cfg.gateId + '] produce 失败: ' + cfg.artifactName);
    return { ok: false, verdict: null, unresolved: ['[' + cfg.gateId + '] ' + cfg.artifactName + ': produce 阶段失败（agent 未返回结果）'] };
  }
  let unresolved = [];
  const loopFailures = []; // review/revise 的执行失败标记（为避免随 findings 重新赋值而丢失，累积在单独数组 — red-team 问题）
  let lastVerdict = 'CONCERNS';
  for (let i = 1; i <= cfg.maxIter; i++) {
    const result = await cfg.review(i);
    if (!result || !result.verdict) {
      log('[' + cfg.gateId + '] iteration ' + i + ': review 失败（无结果）');
      loopFailures.push('[' + cfg.gateId + '] ' + cfg.artifactName + ': iteration ' + i + ' 的 review 未返回结果');
      continue;
    }
    log('[' + cfg.gateId + '] ' + cfg.artifactName + ' iteration ' + i + ': ' + result.verdict);
    recordVerdict(cfg.gateId, cfg.artifactName, i, result.verdict, result.findings || []);
    if (result.verdict === 'APPROVE') {
      // 中途 iteration 的执行失败即使 APPROVE 也要送达人类（不隐藏）
      return { ok: true, verdict: 'APPROVE', unresolved: loopFailures.slice() };
    }
    lastVerdict = result.verdict;
    unresolved = (result.findings || []).map(function (f) {
      return '[' + cfg.gateId + '][' + cfg.artifactName + '] ' + f;
    });
    const revised = await cfg.revise(result.findings || [], i);
    if (revised === null || revised === undefined) {
      log('[' + cfg.gateId + '] iteration ' + i + ': revise 失败');
      loopFailures.push('[' + cfg.gateId + '] ' + cfg.artifactName + ': iteration ' + i + ' 的 revise 失败（问题可能未处理）');
    }
  }
  log('[' + cfg.gateId + '] ' + cfg.artifactName + ': 达到 MAX_ITER(' + cfg.maxIter + ')、非APPROVE → 上报');
  // 以 REJECT 级（相当于设计缺陷）结束时前置 [BLOCKER]，由 CD-CHECKPOINT 在开头单独警告
  if (lastVerdict === 'REJECT') {
    unresolved = unresolved.map(function (u) { return '[BLOCKER] ' + u; });
  }
  return { ok: false, verdict: lastVerdict, unresolved: loopFailures.concat(unresolved) };
}

// verdict + findings 的通用评审 schema
const VERDICT_SCHEMA = {
  type: 'object',
  required: ['verdict', 'findings'],
  properties: {
    verdict: { type: 'string', enum: ['APPROVE', 'CONCERNS', 'REJECT'] },
    findings: { type: 'array', items: { type: 'string' } },
  },
};

// 实现/修复 agent 的返回 schema（commit hash 必填 — 用于固定 CR-CODE 的评审对象）
const COMMIT_RESULT_SCHEMA = {
  type: 'object',
  required: ['commitHash'],
  properties: {
    commitHash: { type: 'string' },
    summary: { type: 'string' },
    changedFiles: { type: 'array', items: { type: 'string' } },
  },
};

// =========================================================================
// Phase: Setup — tech-director 搭建脚手架 + 设计 docs + stories.yaml
// =========================================================================
phase('Setup');

const setupPrompt = [
  '你负责 ArcadeRelay Phase 2 的 Setup（engine: ' + engine + ' — contract §11）。开始作业前必须先读以下内容:',
  '- ' + ART.brief + ' / ' + ART.concept + '（支柱 P-xx）/ ' + ART.gdd + ' / ' + ART.assetsManifest + ' / ' + ART.artBibleJson,
  '- ' + DOCS.techStack + '（game/ 的规范。严格遵守）',
  '- ' + DOCS.contract + '（§7 stories.yaml schema / §2 agent 名 / §11 引擎）',
  checkpointAFeedbackPath
    ? '- ' + checkpointAFeedbackPath + '（Checkpoint A 的人类反馈。必须反映到设计与 story 分解中，并将反映内容明确写入 ' + STATE.active + '）'
    : '（无 Checkpoint A 反馈文件）',
  '',
  '任务（全部必须完成）:',
  EP.scaffoldTask,
  '2. 撰写 ' + ART.architecture + '（场景/关卡构成、系统边界、数据流。按 ' + DOCS.techStack + ' 明确写出引擎无关核心层（Systems）的边界划分）。',
  '3. 撰写 ' + ART.conventions + '（本游戏特有的代码规范。叠加在 ' + DOCS.techStack + ' 规范之上的具体规则）。',
  '4. 按 contract §7 schema 撰写 ' + STATE.stories + ': 分解 ' + ART.gdd + '，',
  '   - phase: prototype = 核心循环跑通一轮的垂直切片（开始→挑战→奖励→再挑战）+ 必需场景转移（Title→Menu→Game→Result→Menu — contract §11）所需的最小 story 集合。按实现顺序排列。',
  '   - phase: build = 其余全部。',
  '   - 每个 story: 稳定 ID S-01～ / pillar 必须引用 concept.md 的 P-xx / assignee 为 gameplay-engineer 或 ui-engineer / status: todo / acceptance 为可通过实际操作验证的语句。',
  '   - **必需（缺失则分解不合格 — contract §11）**: (a) Title 场景的 story（assignee: ui-engineer / phase: prototype）、(b) Menu 场景的 story（assignee: ui-engineer / phase: prototype。acceptance 中包含对必需要素 = 开始游戏、游戏外内容显示、设置、退出入口 实际存在的验证）、(c) 元进度持久化 story（assignee: gameplay-engineer。acceptance 中包含「保存→相当于重启→恢复一致」与「损坏时 .bak+[SaveCorruption] 显式错误」）、(d) 环境的最低限度视觉表现 story（assignee: gameplay-engineer / phase: prototype。acceptance 中 unity/unreal 包含「可见的地面/背景、灯光、相机构图的确定」，phaser 包含「背景的可视化、画面布局的确定」 — contract §11）。',
  '5. 更新 ' + STATE.active + '（日期时间使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写），限定路径 add 后提交: `git add game docs state design && git commit -m "phase2: scaffold + stories"`（禁止 `git add -A` — 不要卷入 .claude/ 等非作业对象的变更）。',
  '',
  '最后按 stories.yaml 的记载顺序，将 phase:prototype 的 story 列表结构化返回（titleStoryId / menuStoryId / metaPersistenceStoryId / environmentStoryId 中明确写出对应 story 的 ID）。',
].filter(Boolean).join('\n');

const SETUP_SCHEMA = {
  type: 'object',
  required: ['prototypeStories', 'titleStoryId', 'menuStoryId', 'metaPersistenceStoryId', 'environmentStoryId'],
  properties: {
    prototypeStories: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'title', 'assignee', 'acceptance'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          pillar: { type: 'string' },
          assignee: { type: 'string', enum: ['gameplay-engineer', 'ui-engineer'] },
          acceptance: { type: 'string' },
        },
      },
    },
    titleStoryId: { type: 'string', description: 'Title 场景 story 的 S-xx（contract §11 必需）' },
    menuStoryId: { type: 'string', description: 'Menu 场景 story 的 S-xx（contract §11 必需）' },
    metaPersistenceStoryId: { type: 'string', description: '元进度持久化 story 的 S-xx（contract §11 必需）' },
    environmentStoryId: { type: 'string', description: '环境的最低限度视觉表现（unity/unreal: 可见的地面/背景+灯光+相机构图确定）story 的 S-xx（contract §11 必需）' },
    notes: { type: 'string' },
  },
};

// contract §11: 机械验证 Title/Menu/元进度 story 的存在（tech-director 自我申报的 ID 确实存在，
// 且 Title/Menu 的 assignee 为 ui-engineer）。不合格则仅退回1次。
// contract §11 按 engine 区分的必需环境要素（validateSetup / Setup 退回提示词 / stories.yaml 独立核对共用 —
// 若验证与修正指示引用的不是同一集合，按退回指示修正的结果会被 validator 判为不合格，导致 Setup 中断）
const ENV_REQUIRED_ELEMENTS = engine === 'phaser'
  ? [['背景', /背景|background/i], ['画面布局', /布局|layout|画面构成/i]]
  // 3D 明确必需「可见的地面」（可以是占位地形）— 仅有背景的 acceptance 不合格（contract §11）
  : [['地面', /地面|ground|terrain|地板|floor/i], ['灯光', /灯光|照明|light/i], ['相机', /相机|摄像机|camera/i]];
const ENV_REQUIRED_TEXT = ENV_REQUIRED_ELEMENTS.map(function (r) { return r[0]; }).join('、');
function envAcceptanceMissing(acc) {
  return ENV_REQUIRED_ELEMENTS.filter(function (r) { return !r[1].test(acc || ''); }).map(function (r) { return r[0]; });
}

function validateSetup(s) {
  if (!s || !Array.isArray(s.prototypeStories) || s.prototypeStories.length === 0) return ['prototypeStories 为空'];
  const byId = {};
  for (const st of s.prototypeStories) byId[st.id] = st;
  const problems = [];
  const title = byId[s.titleStoryId];
  const menu = byId[s.menuStoryId];
  const meta = byId[s.metaPersistenceStoryId];
  const env = byId[s.environmentStoryId];
  if (!title) problems.push('titleStoryId=' + s.titleStoryId + ' 在 prototypeStories 中不存在');
  else if (title.assignee !== 'ui-engineer') problems.push('Title story ' + title.id + ' 的 assignee 不是 ui-engineer');
  if (!menu) problems.push('menuStoryId=' + s.menuStoryId + ' 在 prototypeStories 中不存在');
  else if (menu.assignee !== 'ui-engineer') problems.push('Menu story ' + menu.id + ' 的 assignee 不是 ui-engineer');
  if (!meta) problems.push('metaPersistenceStoryId=' + s.metaPersistenceStoryId + ' 在 prototypeStories 中不存在');
  else if (meta.assignee !== 'gameplay-engineer') problems.push('元进度持久化 story ' + meta.id + ' 的 assignee 不是 gameplay-engineer（Systems/Meta + Persistence 层的实现 — tech-director.md）');
  if (!env) problems.push('environmentStoryId=' + s.environmentStoryId + ' 在 prototypeStories 中不存在');
  else if (env.assignee !== 'gameplay-engineer') problems.push('环境视觉 story ' + env.id + ' 的 assignee 不是 gameplay-engineer（可见的地面/背景、灯光、相机构图的实现 — contract §11）');
  else {
    // 仅凭 ID 自我申报无法检测无关 story 的挪用 — 机械验证 acceptance（而非 title）
    // 覆盖了按 engine 区分的全部必需环境要素（contract §11:
    // phaser=背景的可视化+画面布局确定 / unity、unreal=可见的地面+灯光+相机构图）
    const missing = envAcceptanceMissing(env.acceptance);
    if (missing.length > 0) {
      problems.push('环境视觉 story ' + env.id + ' 的 acceptance 缺少必需环境要素: ' + missing.join('、') +
        '（contract §11 的 engine=' + engine + ' 要求。可能是申报了无关 story 或 acceptance 描述不足 — 请以可验证的形式明确写入 acceptance）');
    }
  }
  return problems;
}

let setup = await agentR(setupPrompt, {
  label: 'setup-scaffold-stories',
  phase: 'Setup',
  agentType: 'tech-director',
  effort: 'high',
  schema: SETUP_SCHEMA,
});

{
  const problems = setup ? validateSetup(setup) : ['Setup agent 未返回结果'];
  if (problems.length > 0 && setup) {
    log('Setup 退回（contract §11 必需 story 缺失）: ' + problems.join(' / '));
    setup = await agentR(
      [
        'story 分解不满足 contract §11 的必需要求。修正以下问题并更新 ' + STATE.stories + '，然后重新返回修正后的 phase:prototype story 列表:',
        problems.map(function (p, i) { return (i + 1) + '. ' + p; }).join('\n'),
        '必需: Title story 与 Menu story（均为 assignee: ui-engineer / phase: prototype）、元进度持久化 story 与 环境的最低限度视觉表现 story（assignee: gameplay-engineer / phase: prototype。acceptance 中以可验证的形式全部包含必需环境要素「' + ENV_REQUIRED_TEXT + '」（contract §11 的 engine=' + engine + ' 要求））。禁止重新编号既有 S-xx（以顺延编号追加）。',
        '修正后 git add ' + STATE.stories + ' && git commit（消息: "phase2: fix required stories"）。',
      ].join('\n'),
      { label: 'setup-fix-required-stories', phase: 'Setup', agentType: 'tech-director', effort: 'high', schema: SETUP_SCHEMA }
    );
    const problems2 = setup ? validateSetup(setup) : ['退回后 Setup agent 仍未返回结果'];
    if (problems2.length > 0) {
      unresolvedFindings.push('[Setup] contract §11 必需 story（Title/Menu/元进度）的验证在退回后仍不合格: ' + problems2.join(' / '));
      setup = null; // 转到下方的失败路径（不在必需场景缺失的状态下进入实现）
    }
  }
}

// 独立核对: 不依赖 tech-director 的自我申报（结构化返回），而是用只读 agent 确认
// state/stories.yaml 的实体（与 QA 证据的独立验证同一纪律 — 不让自我申报成为唯一关卡）
if (setup) {
  const crosscheck = await agentR(
    [
      '只读验证任务。读取 ' + STATE.stories + '，对以下每个 story ID 返回其存在与否、assignee、phase、acceptance（原文照抄）。禁止修改文件。',
      '对象 ID(JSON): ' + JSON.stringify([setup.titleStoryId, setup.menuStoryId, setup.metaPersistenceStoryId, setup.environmentStoryId]),
    ].join('\n'),
    {
      label: 'setup-crosscheck-stories', phase: 'Setup', effort: 'low',
      schema: {
        type: 'object', required: ['found'],
        properties: {
          found: {
            type: 'array',
            items: {
              type: 'object', required: ['id', 'exists'],
              properties: { id: { type: 'string' }, exists: { type: 'boolean' }, assignee: { type: 'string' }, phase: { type: 'string' }, acceptance: { type: 'string' } },
            },
          },
        },
      },
    }
  );
  const ccProblems = [];
  if (!crosscheck) {
    ccProblems.push('stories.yaml 独立核对 agent 未返回结果');
  } else {
    const ccById = {};
    for (const f of (crosscheck.found || [])) ccById[f.id] = f;
    const expect = [
      { id: setup.titleStoryId, assignee: 'ui-engineer', name: 'Title' },
      { id: setup.menuStoryId, assignee: 'ui-engineer', name: 'Menu' },
      { id: setup.metaPersistenceStoryId, assignee: 'gameplay-engineer', name: '元进度持久化' },
      { id: setup.environmentStoryId, assignee: 'gameplay-engineer', name: '环境视觉' },
    ];
    for (const e of expect) {
      const f = ccById[e.id];
      if (!f || !f.exists) { ccProblems.push(e.name + ' story ' + e.id + ' 在 ' + STATE.stories + ' 实体中不存在（与自我申报不一致）'); continue; }
      // 字段缺失不是跳过验证而是不合格（不让 optional 字段的省略使核对直接通过）
      if (!f.assignee) ccProblems.push(e.name + ' story ' + e.id + ' 的实体 assignee 核对 agent 未返回（无法验证）');
      else if (f.assignee !== e.assignee) ccProblems.push(e.name + ' story ' + e.id + ' 的实体 assignee 为 ' + f.assignee + '（期望: ' + e.assignee + '）');
      if (!f.phase) ccProblems.push(e.name + ' story ' + e.id + ' 的实体 phase 核对 agent 未返回（无法验证）');
      else if (f.phase !== 'prototype') ccProblems.push(e.name + ' story ' + e.id + ' 的实体 phase 为 ' + f.phase + '（期望: prototype — 被放在 phase: build 的必需 story 会漏出 Phase 2 的实现与 QA 范围）');
      if (e.id === setup.environmentStoryId) {
        // stories.yaml 实体的 acceptance 也按 engine 区分的必需环境要素核对（不只验证自我申报）
        if (!f.acceptance) ccProblems.push(e.name + ' story ' + e.id + ' 的实体 acceptance 核对 agent 未返回（无法验证）');
        else {
          const ccMissing = envAcceptanceMissing(f.acceptance);
          if (ccMissing.length > 0) ccProblems.push(e.name + ' story ' + e.id + ' 的实体 acceptance 缺少必需环境要素: ' + ccMissing.join('、') + '（contract §11 的 engine=' + engine + ' 要求）');
        }
      }
    }
  }
  if (ccProblems.length > 0) {
    unresolvedFindings.push('[Setup] stories.yaml 独立核对未通过: ' + ccProblems.join(' / '));
    setup = null; // 不在必需场景缺失、不一致的状态下进入实现
  }
}

if (!setup || !setup.prototypeStories || setup.prototypeStories.length === 0) {
  // 原样返回实际的失败原因（包含 validateSetup 不合格详情的已累积 unresolvedFindings）（不用固定措辞覆盖）
  return {
    summary: 'Phase 2 中断: Setup（脚手架 + stories.yaml 生成）不合格。' +
      (unresolvedFindings.length > 0 ? ' 原因: ' + unresolvedFindings.join(' / ') : ' Setup agent 未返回结果。'),
    playInstructions: '无（game/ 很可能尚未成立。请确认 ' + STATE.active + ' 与 ' + STATE.stories + '）',
    evidencePaths: [],
    knownIssues: unresolvedFindings.length > 0 ? unresolvedFindings.slice() : ['Setup agent 未返回结果'],
    unresolvedFindings: unresolvedFindings.concat(['因 Setup 失败，之后的阶段未执行']),
    verdictHistory: verdictHistory,
    verdict: 'REJECT',
  };
}
const stories = setup.prototypeStories;
log('Setup 完成: phase:prototype story ' + stories.length + ' 个 — ' + stories.map(function (s) { return s.id; }).join(', '));

// =========================================================================
// Phase: Build ∥ AssetGen — 代码实现与资产生成并行
// =========================================================================

// ---- Build 侧: 「顺序」实现 story（禁止并行实现 = 避免冲突） ----
// 提交纪律: 每次实现/修复都只 add 自己触碰的路径并提交、报告 hash，
// 向 CR-CODE 传递时用 `git show <hash>` 固定评审对象（防止并行的 AssetGen 的
// 生成物或未提交变更混入）。
const GIT_ADD_RULE =
  'git add 仅限自己编辑的**单个文件路径**（禁止指定目录、禁止 `git add -A` — 会卷入共享同一 index 的并行 lane/资产 track 的 staged 变更或未提交 WIP）。' +
  'commit 必须使用指定路径的形式 `git commit -m "<msg>" -- <自己编辑的文件...>`（防止卷入其他路径的 staged 变更。**同一文件内其他 lane 的 WIP 无法排除**，因此对共享文件 — config/types/stories.yaml — 的自己的追加写入，要在编辑后立刻**仅对该1个文件**单独提交以固定下来）。' +
  '提交 hash 不用 `git rev-parse HEAD`，而是从 `git log --format="%H %s" -20` 中取**与自己提交消息一致的最上方（最新）行**的 hash，并用 `git show --stat <hash>` **确认其中包含自己编辑的文件**（rev-parse HEAD 可能拿到并行 lane 紧随其后的提交。窗口内没有一致行则用 -50 重新获取。若不包含、或 commit 本身失败，不要返回旧的同名提交的 hash，而要**如实报告失败**）。' +
  'commit 因 index.lock 失败时等待 1～2 秒后仅重试 1 次。';

// 针对 resume/重试的双重应用守卫（adversarial M-8b）: 即使因缓存键失配而重新执行了已完成作业的
// 提示词，也不让其重复追加 config 常量、注记、MANIFEST 或重新提交
const IDEMPOTENT_RULE =
  '幂等守卫（resume 安全）: 本次请求可能因 resume/重试而被重新执行。开始作业前先确认 git log 的最近提交与目标文件，若**与本次请求所指示的提交消息相同的提交**、或本次要追加的 config 常量、stories.yaml 注记、MANIFEST 行本身已经存在，则不要重复追加、不要重新提交，仅在确认现状后做结果的结构化返回（或报告）。**仅有过去 iteration 的提交（实现提交等）存在并不视为完成** — 只有本次所指示作业本身的完成痕迹存在时才跳过。';

// 并行 lane 纪律（retro-e2 方案A: 按 assignee lane 并行。仅代码编辑与 review agent 并行 —
// 需要启动引擎的验证集中到 lane 合流后的批量验证区间（方案B）。tech-stack 文档「验证」节为权威来源）
const LANE_RULE =
  '并行 lane 纪律: 不要改写你的 assignee 负责区域以外的代码（gameplay-engineer=游戏机制、系统、持久化层 / ui-engineer=UI、场景显示层。边界见 ' + ART.architecture + '）。' +
  '共享文件（' + EP.configPath + '、共享类型定义）**仅允许追加自己 story 所需的常量/类型**（禁止修改、删除既有行 — 会与并行 lane 冲突。例外: story 的 acceptance/指示明确要求的平衡调整，仅允许**修改该目标常量的值**）。' +
  '不得已要触碰其他 lane 负责区域的既有场景/接线文件时（例: 到达 Result 时的 persist 接线），**仅做精准 Edit、禁止整文件 Write、Edit 前必须重新 Read**（不要回退并行 lane 已提交的变更）。' +
  STATE.stories + ' 仅对自己 story 的块内（status 行、注记）做精准 Edit（禁止整文件重写 — 会抹掉并行 lane 的更新）。' +
  '不要触碰 ' + STATE.active + '（会与并行 lane 冲突 — 当前位置更新是 lane 合流后串行区间的职责）。' +
  '若依赖其他 lane 的 story 计划提供的 API，可按 ' + ART.architecture + ' 的设计编写调用来实现（编译一致性由 lane 合流后的批量验证做最终确认）。';

// ---------- 批量验证（lane 合流后的串行区间。retro-e2 方案B） ----------

const BATCH_VERIFY_SCHEMA = {
  type: 'object',
  required: ['ok'],
  properties: {
    ok: { type: 'boolean', description: '整套验证命令是否最终达到合格（exit 0。unity/unreal 含测试结果 failed 0）' },
    fixedNotes: { type: 'array', items: { type: 'string' }, description: '已修复问题的列表（附原因 story 归属）。没有则为空数组' },
    unresolved: { type: 'array', items: { type: 'string' }, description: '未能解决的问题。没有则为空数组' }
  }
};

async function batchVerify(phaseName, contextNote) {
  const bv = await agentR(
    '批量验证（串行区间 — 并行 lane 已合流。在此统一执行引擎验证。engine=' + engine + '）。\n' +
    contextNote + '\n' +
    '步骤:\n' +
    '1) 执行 ' + EP.verifyCmd + '\n' +
    '2) 若有失败，用错误的文件路径与 `git log --oneline -- <该路径>` 定位原因 story（难以定位时按 lane 中的 story 提交为单位二分查找）\n' +
    '3) 以最小修复达到合格（不重做其他 story 的设计。调参值的修改仅限 ' + EP.configPath + '。**作为串行区间的例外，仅限批量验证的最小修复，可以编辑负责区域以外的文件 — 含 ui 层**。**通过删除功能、移除调用、禁用来规避不是最小修复** — 在保持编译一致性的同时维持意图，不得已改变了行为时要在 fixedNotes 中明确写出。若修复原因是引擎/测试运行器导致的一般性问题（环境陷阱），立即追加写入 tech-stack 文档的「已知陷阱」节（没有则新建 — gates.md QA-PLAY）。）\n' +
    '4) 若做了修复，在 ' + STATE.reviewsDir + '/batch-verify.md 中追加写入「phase / 原因 story / 修复内容 / ISO8601 日期时间」（日期时间使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写），并按提交纪律的指定路径形式 git commit（消息: "batch-verify fix (' + phaseName + ')"）。' + GIT_ADD_RULE + '\n' +
    IDEMPOTENT_RULE + '\n' +
    '结构化返回: ok（最终合格则为 true。未能达到则如实返回 false）/ fixedNotes / unresolved。',
    { label: 'batch-verify-' + phaseName.toLowerCase(), phase: phaseName, agentType: 'gameplay-engineer', schema: BATCH_VERIFY_SCHEMA, effort: 'high' }
  );
  if (bv === null) {
    unresolvedFindings.push('[BLOCKER] ' + phaseName + ': 批量验证 agent 未返回结果（构建健全性未确认 — 由后续 QA 检测）');
    return false;
  }
  // 修复内容要放到人类可见渠道（因为是未经 CR-CODE 的直接提交，仅靠 log() 会
  // 漏出全部历史的展示 — adversarial H-3）
  for (const n of (bv.fixedNotes || [])) {
    knownIssues.push('[' + phaseName + '][batch-verify 修复/未经 CR-CODE] ' + n);
  }
  for (const u of (bv.unresolved || [])) {
    unresolvedFindings.push('[BLOCKER] ' + phaseName + '[batch-verify] ' + u);
  }
  if (bv.ok !== true || (bv.unresolved || []).length > 0) {
    if (bv.ok !== true && (bv.unresolved || []).length === 0) {
      unresolvedFindings.push('[BLOCKER] ' + phaseName + ': 批量验证未达到合格（详情见 ' + STATE.reviewsDir + '/batch-verify.md）');
    }
    log('batch-verify(' + phaseName + '): 不合格或存在未解决项（上报）');
    return false;
  }
  log('batch-verify(' + phaseName + '): 合格');
  return true;
}

async function buildStoryLane(laneStories) {
  for (const story of laneStories) {
    // 防止缺少 id 的 story 引发 TypeError → 整个 lane 失败（与 full-build.js 同一守卫）。label、提交
    // 消息、标题中也不使用原始 story.id（防止变成 'implement-undefined' / "undefined: <title>"）
    const sid = String(story.id || 'S-unknown');
    const sidLower = sid.toLowerCase();
    const reviewLogPath = STATE.reviewsDir + '/' + sidLower + '.md';
    const storyHeader =
      'story: ' + sid + ' "' + story.title + '"（pillar: ' + (story.pillar || '未指定') + ' / acceptance: ' + story.acceptance + '）';
    let lastCommitHash = null;

    const loopResult = await reviewLoop({
      gateId: 'CR-CODE',
      artifactName: sid,
      maxIter: 2, // review-loops.md: CR-CODE MAX_ITER 2
      reviewMode: reviewMode,

      produce: async function () {
        const r = await agentR(
          [
            '你是 ArcadeRelay 的实现 engineer。实现下面的 story。',
            storyHeader,
            '',
            '必读: ' + ART.architecture + ' / ' + ART.conventions + ' / ' + ART.gdd + ' / ' + DOCS.techStack + ' / ' + STATE.stories,
            '',
            '步骤:',
            '1. 在 ' + STATE.stories + ' 中将 ' + sid + ' 的 status 更新为 in-progress。',
            '2. 以叠加在既有代码之上的形式实现（不破坏前一个 story 的成果）。' + EP.codeRulesLine,
            '   ' + EP.placeholderNote,
            '   ' + LANE_RULE,
            '3. ' + EP.laneVerifyLine + '。',
            '4. 在 ' + STATE.stories + ' 中将 status 更新为 review，然后提交。' + GIT_ADD_RULE,
            '   ' + IDEMPOTENT_RULE,
            '   提交消息: "' + sid + ': ' + story.title + '"。提交 hash 按上述提交纪律的方法（`git log --format="%H %s" -20` 中与自己消息一致的最新行）获取。',
            '',
            '结构化返回: commitHash（本次提交的 hash。必填）/ changedFiles（变更文件列表）/ summary（实现要点）。',
          ].join('\n'),
          { label: 'implement-' + sid, phase: 'Build', agentType: story.assignee, effort: 'high', schema: COMMIT_RESULT_SCHEMA }
        );
        if (r && r.commitHash) {
          lastCommitHash = r.commitHash;
          return r;
        }
        return null;
      },

      review: async function (iteration) {
        // CR-CODE 是 code-reviewer + silent-failure-hunter 的评审对（gates.md CR-CODE 节）
        const reviewCommon = [
          reviewModeNote(reviewMode),
          'GATE: CR-CODE（阅读并遵循 ' + DOCS.gates + ' 的 CR-CODE 节）。',
          '评审对象固定为提交 ' + lastCommitHash + '（用 `git show ' + lastCommitHash + '` 获取。工作树的未提交变更与其他提交的 diff 不在对象范围内）。',
          storyHeader,
          '',
          '判定的换算: findings 0 条 = APPROVE / 可修复的问题 = CONCERNS / 设计缺陷 = REJECT。',
          '前提（并行 lane 设计）: 对其他 lane 的 story 计划提供的 API 的引用，只要符合 ' + ART.architecture + ' 的设计，就不能仅以「实体未实现」为理由判为 REJECT/blocker（编译一致性由 lane 合流后的批量验证保证。与设计不一致、误用可照常指出）。**本次评审为只读 — 禁止启动引擎、执行构建/测试命令**（并行 lane 期间的单实例锁/dist 竞争）。',
          '响应的第1行为「CR-CODE: APPROVE|CONCERNS|REJECT」（contract.md §5），结构化返回的 verdict / findings 中也放入相同的判定与问题。',
          'findings 为问题数组（包含文件、行、修复方针的具体语句）。',
        ];
        const pair = await parallel([
          function () {
            return agentR(
              reviewCommon.concat([
                '',
                '要点: 除常规代码评审外，还要确认是否违反 ' + EP.codeRulesFile + '（若不存在则为 ' + DOCS.techStack + ' 的代码规范）— 尤其是混入魔法数字与不依赖 delta-time 的实现。',
                '也要确认 acceptance 是否能被这个 diff 的实现满足。',
                '将评审结果追加写入 ' + reviewLogPath + '（review-loops.md 的追加写入格式: iteration ' + iteration + '、verdict、问题摘要、日期时间。日期时间使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）。',
              ]).join('\n'),
              {
                label: 'cr-code-' + sid + '-iter' + iteration,
                phase: 'Build',
                agentType: 'pr-review-toolkit:code-reviewer',
                schema: VERDICT_SCHEMA,
              }
            );
          },
          function () {
            return agentR(
              reviewCommon.concat([
                '',
                '要点: 聚焦 silent failure 进行检查（被静默吞掉的异常、空 catch、隐藏失败的 fallback、无视错误、失败时伪装成功的返回值）。',
                '无需追加写入 ' + STATE.reviewsDir + '/（追加写入由 code-reviewer 一方负责。你只需结构化返回）。',
              ]).join('\n'),
              {
                label: 'cr-silent-' + sid + '-iter' + iteration,
                phase: 'Build',
                agentType: 'pr-review-toolkit:silent-failure-hunter',
                schema: VERDICT_SCHEMA,
              }
            );
          },
        ]);
        const valid = (pair || []).filter(function (r) { return r && r.verdict; });
        if (valid.length === 0) {
          return null;
        }
        if (valid.length < 2) {
          knownIssues.push('[CR-CODE][' + sid + '] iteration ' + iteration + ': 评审对中的一方未返回结果（以单侧判定继续）');
        }
        let verdict = 'APPROVE';
        let findings = [];
        for (const r of valid) {
          verdict = worseVerdict(verdict, r.verdict);
          findings = findings.concat(r.findings || []);
        }
        return { verdict: verdict, findings: findings };
      },

      revise: async function (findings, iteration) {
        const r = await agentR(
          [
            '你是 ArcadeRelay 的实现 engineer。修复 CR-CODE 评审问题（code-reviewer + silent-failure-hunter 的合计）。',
            storyHeader,
            '',
            '问题列表:',
            findings.map(function (f, idx) { return (idx + 1) + '. ' + f; }).join('\n'),
            '',
            '步骤:',
            '1. 处理每个问题（不处理时要明确写出正当理由。禁止无视）。规范见 ' + ART.conventions + ' / ' + DOCS.techStack + '。' + LANE_RULE,
            '2. 修复后的验证: ' + EP.laneVerifyLine + '。',
            '3. 在 ' + reviewLogPath + ' 的 iteration ' + iteration + ' 的「处理:」栏中追加写入已处理/暂不处理＋理由。',
            '4. 提交。' + GIT_ADD_RULE,
            '   ' + IDEMPOTENT_RULE,
            '   提交消息: "' + sid + ': fix CR-CODE iter ' + iteration + '"。提交 hash 按上述提交纪律的方法（`git log --format="%H %s" -20` 中与自己消息一致的最新行）获取。',
            '结构化返回: commitHash（本次提交的 hash。必填）/ summary（处理摘要）。',
          ].join('\n'),
          { label: 'fix-' + sid + '-iter' + iteration, phase: 'Build', agentType: story.assignee, effort: 'high', schema: COMMIT_RESULT_SCHEMA }
        );
        if (r && r.commitHash) {
          lastCommitHash = r.commitHash;
          return r;
        }
        return null;
      },
    });

    // 即使 ok:true，loop 中的 review/revise 执行失败标记也要送达（不以 APPROVE 隐藏 — adversarial W-1）
    if (loopResult.unresolved && loopResult.unresolved.length > 0) {
      unresolvedFindings.push(...loopResult.unresolved);
    }

    // 确定状态（done。有未解决问题则注记）— state 以文件为真实
    const bookkeep = await agentR(
      [
        '在 ' + STATE.stories + ' 中将 ' + sid + ' 的 status 更新为 done。',
        loopResult.ok
          ? '（CR-CODE 已 APPROVE。若已是 done 则不做任何事）'
          : '（CR-CODE 未 APPROVE 而上报。在 story 的 acceptance 行下方添加注释注记「# note: CR-CODE unresolved — 参见 ' + STATE.reviewsDir + '/' + sidLower + '.md」。若已是 done 且已有注记则不做任何事 — 与 full-build.js 的 bookkeep 相同的幂等规范）',
        IDEMPOTENT_RULE,
        '不要触碰 ' + STATE.active + '（会与并行 lane 冲突 — 当前位置的更新由 lane 合流后的 Integrate 进行）。' +
        STATE.stories + ' 仅对该 story 的行做精准 Edit（禁止整文件重写）。',
        '提交: `git add ' + STATE.stories + ' && git commit -m "' + sid + ': status done" -- ' + STATE.stories + '`（禁止不带路径的 git commit — 用指定路径形式避免卷入并行 lane 的 staged 变更）。' + GIT_ADD_RULE,
      ].join('\n'),
      { label: 'bookkeep-' + sid, phase: 'Build', agentType: story.assignee, effort: 'low' }
    );
    if (bookkeep === null) {
      knownIssues.push(sid + ' 的 stories.yaml status 更新未确认（agent 失败）');
    }
  }
  return true;
}

// assignee lane 拆分（retro-e2 方案A）: gameplay 与 ui 并行，lane 内保持 Setup 的返回顺序（依赖顺序）。
// 引擎验证不在 lane 中进行（EP.laneVerifyLine），由合流后的 batchVerify 统一保证（方案B）
async function buildStories() {
  const gameplayLane = stories.filter(function (s) { return s.assignee !== 'ui-engineer'; });
  const uiLane = stories.filter(function (s) { return s.assignee === 'ui-engineer'; });
  log('Build lane 拆分: gameplay ' + gameplayLane.length + ' 个 / ui ' + uiLane.length + ' 个');
  await parallel([
    laneSafe('Build gameplay lane', function () { return buildStoryLane(gameplayLane); }),
    laneSafe('Build ui lane', function () { return buildStoryLane(uiLane); }),
  ]);
  return true;
}

// ---- AssetGen 侧: 图像（art-director）与 SFX（audio-designer）----
// AR-ASSET 循环: 每个资产 MAX 3 + 切换 fallback 提供商后再 1 次（review-loops.md）
const GEN_SCHEMA = {
  type: 'object',
  required: ['generated', 'budgetExceeded', 'remainingPlanned', 'degradedRoutes'], // 防止因省略 degradedRoutes 而丢失 fallback 记录（没有则明确返回空数组）
  properties: {
    generated: { type: 'array', items: { type: 'string' }, description: '已生成并追加写入 MANIFEST 的资产路径列表' },
    budgetExceeded: { type: 'boolean', description: '因预计超出预算而停止生成时为 true' },
    remainingPlanned: { type: 'number', description: '目标范围内尚未生成的资产数量（0 = 目标已全部生成）' },
    notes: { type: 'string', description: '披露事项（使用 shippable:false 路由、Meshy 403→切换 fal、quota 限制等）。没有则为空字符串' },
    degradedRoutes: { type: 'array', items: { type: 'string' }, description: '降级、fallback 尝试的全部记录（路由名+HTTP 状态码必填。例: "model_character: meshy:direct→422 / fal:meshy-v6→429 / tripo:direct→403 → local降级"）。没有则为空数组' },
  },
};

// 从生成 agent 的结构化返回中机械回收披露事项（不以自由文本丢弃 — contract §10）
function collectGenDisclosures(batchName, gen) {
  if (!gen) return;
  for (const d of (gen.degradedRoutes || [])) {
    unresolvedFindings.push('[AssetGen][' + batchName + '][降级] ' + d);
  }
  if (gen.notes && String(gen.notes).trim().length > 0) {
    unresolvedFindings.push('[AssetGen][' + batchName + '][披露] ' + gen.notes);
  }
}

async function assetBatchLoop(cfg) {
  // cfg = { batchName, producerType, generatePrompt, regeneratePrompt(failed), fallbackPrompt(failed), reviewSubject }
  const reviewLogPath = STATE.reviewsDir + '/' + cfg.batchName + '.md';
  const reviewSchema = {
    type: 'object',
    required: ['verdict', 'failedAssets', 'disclosures'],
    properties: {
      verdict: { type: 'string', enum: ['APPROVE', 'CONCERNS', 'REJECT'] },
      failedAssets: {
        type: 'array',
        items: {
          type: 'object',
          required: ['file', 'reason'],
          properties: {
            file: { type: 'string' },
            reason: { type: 'string' },
            retryInstruction: { type: 'string' },
          },
        },
      },
      disclosures: {
        type: 'array',
        items: { type: 'string' },
        description: '无需重新生成但需要向人类披露的事项（来自 shippable:false 路由、经 fal 的 Meshy 许可证继承未验证、cost_estimated:true、must_replace 等 — gates.md AR-ASSET 要点6）。没有则为空数组',
      },
    },
  };

  async function reviewBatch(iteration, extraNote) {
    const review = await agentR(
      [
        reviewModeNote(reviewMode),
        'GATE: AR-ASSET（遵循 ' + DOCS.gates + ' 的 AR-ASSET 节）。对象: ' + cfg.reviewSubject,
        '标准: ' + ART.artBibleJson + '（风格锁定）与 ' + ART.assetsManifest + '（生成规格）。在 ' + ART.manifest + ' 中确认对象列表。',
        extraNote || '',
        '不合格资产必须附上理由与重新生成指示（提示词修改方案）。',
        '**重新生成无法解决的披露事项**（gates.md AR-ASSET 要点6: 来自 shippable:false 路由 / 经 fal 的 Meshy 许可证继承未验证 / cost_estimated:true / provenance 记录遗漏以外的注记）放入 disclosures 而非 failedAssets（放入 failedAssets 会触发无意义的重新生成循环）。',
        '将评审结果追加写入 ' + reviewLogPath + '（review-loops.md 的追加写入格式、iteration ' + iteration + '。日期时间使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）。',
        '响应的第1行为「AR-ASSET: APPROVE|CONCERNS|REJECT」（contract.md §5），结构化返回中也放入相同的判定。',
        '结构化返回: verdict（质量上全部资产合格则为 APPROVE — 即使有披露事项，只要无需重新生成就 APPROVE + disclosures）/ failedAssets（file / reason / retryInstruction）/ disclosures。',
      ].filter(Boolean).join('\n'),
      { label: 'ar-asset-' + cfg.batchName + '-iter' + iteration, phase: 'AssetGen', agentType: 'art-reviewer', schema: reviewSchema }
    );
    if (review) {
      recordVerdict('AR-ASSET', cfg.batchName, iteration, review.verdict,
        (review.failedAssets || []).map(function (f) { return f.file + ': ' + f.reason; })
          .concat((review.disclosures || []).map(function (d) { return '[披露] ' + d; })));
      for (const d of (review.disclosures || [])) {
        unresolvedFindings.push('[AR-ASSET][' + cfg.batchName + '][披露] ' + d);
      }
    }
    return review;
  }

  const generated = await agentR(cfg.generatePrompt + '\n结构化返回: generated（已追加写入 MANIFEST 的路径列表）/ budgetExceeded / remainingPlanned（目标范围内未生成的剩余数量）/ notes（披露事项）/ degradedRoutes（从 Primary 降级的列表）。', {
    label: 'generate-' + cfg.batchName,
    phase: 'AssetGen',
    agentType: cfg.producerType,
    effort: 'high',
    schema: GEN_SCHEMA,
  });
  if (generated === null) {
    unresolvedFindings.push('[AR-ASSET][' + cfg.batchName + '] 生成 agent 失败。资产批次未生成');
    return false;
  }
  collectGenDisclosures(cfg.batchName, generated);
  if (generated.budgetExceeded) {
    unresolvedFindings.push('[AssetGen][' + cfg.batchName + '] 因预计超出预算而停止生成（未生成 ' + (typeof generated.remainingPlanned === 'number' ? generated.remainingPlanned : '未知') + ' 个。参见 state/budget.txt）');
    log('[AssetGen] ' + cfg.batchName + ': 因预计超出预算而停止');
    return false;
  }
  if ((generated.generated || []).length === 0 && (typeof generated.remainingPlanned === 'number' && generated.remainingPlanned > 0)) {
    unresolvedFindings.push('[AssetGen][' + cfg.batchName + '] 生成 0 个但仍有 ' + generated.remainingPlanned + ' 个未生成对象残留（疑似 API 全部失败。notes: ' + (generated.notes || '无') + '）');
    return false;
  }

  let failed = null; // null = 未评审
  for (let i = 1; i <= 3; i++) {
    const review = await reviewBatch(i, null);
    if (!review) {
      unresolvedFindings.push('[AR-ASSET][' + cfg.batchName + '] iteration ' + i + ' 的 review 失败');
      continue;
    }
    log('[AR-ASSET] ' + cfg.batchName + ' iteration ' + i + ': ' + review.verdict + '（不合格 ' + (review.failedAssets || []).length + ' 个）');
    if (review.verdict === 'APPROVE') {
      return true;
    }
    if ((review.failedAssets || []).length === 0) {
      // 非APPROVE + failedAssets 为空 = 批次整体问题 or reviewer 协议不一致。不视为合格（red-team 问题）
      unresolvedFindings.push('[AR-ASSET][' + cfg.batchName + '] iteration ' + i + ' 为 ' + review.verdict + ' 但 failedAssets 为空（可能是批次整体问题 — 需要人类确认）');
      return false;
    }
    failed = review.failedAssets;
    if (i < 3) {
      const regen = await agentR(cfg.regeneratePrompt(failed) + '\n结构化返回: generated / budgetExceeded / remainingPlanned / notes / degradedRoutes。', {
        label: 'regen-' + cfg.batchName + '-iter' + i,
        phase: 'AssetGen',
        agentType: cfg.producerType,
        effort: 'high',
        schema: GEN_SCHEMA,
      });
      if (regen === null) {
        unresolvedFindings.push('[AR-ASSET][' + cfg.batchName + '] iteration ' + i + ' 的重新生成失败');
      } else {
        collectGenDisclosures(cfg.batchName, regen);
        if (regen.budgetExceeded) {
          unresolvedFindings.push('[AssetGen][' + cfg.batchName + '] 重新生成中因预计超出预算而停止（不合格 ' + failed.length + ' 个残留）');
          return false;
        }
      }
    }
  }

  // 3次不合格 → 切换到 fallback 提供商后再 1 次（review-loops.md）
  if (failed && failed.length > 0) {
    log('[AR-ASSET] ' + cfg.batchName + ': 3次不合格 → 切换 fallback 提供商（' + failed.length + ' 个）');
    const fb = await agentR(cfg.fallbackPrompt(failed) + '\n结构化返回: generated / budgetExceeded / remainingPlanned / notes / degradedRoutes。', {
      label: 'fallback-' + cfg.batchName,
      phase: 'AssetGen',
      agentType: cfg.producerType,
      effort: 'high',
      schema: GEN_SCHEMA,
    });
    if (fb !== null) collectGenDisclosures(cfg.batchName + ':fallback', fb);
    // 与兄弟分支（首次生成、regen）相同的预算守卫（不把 fallback 中的预算停止误报为质量不合格）
    if (fb && fb.budgetExceeded) {
      unresolvedFindings.push('[AssetGen][' + cfg.batchName + '] fallback 中因预计超出预算而停止（不合格 ' + failed.length + ' 个残留）');
      return false;
    }
    if (fb !== null) {
      const finalReview = await reviewBatch(4, '（切换 fallback 提供商后的最终判定。这是最后一次迭代）');
      if (finalReview && finalReview.verdict === 'APPROVE') {
        return true;
      }
      if (finalReview) {
        if ((finalReview.failedAssets || []).length === 0) {
          unresolvedFindings.push('[AR-ASSET][' + cfg.batchName + '] fallback 后的最终判定为 ' + finalReview.verdict + ' 但 failedAssets 为空（可能是批次整体问题 — 需要人类确认）');
        }
        for (const f of (finalReview.failedAssets || [])) {
          unresolvedFindings.push('[AR-ASSET][' + cfg.batchName + '] ' + f.file + ': ' + f.reason + '（fallback 后仍不合格）');
        }
      } else {
        unresolvedFindings.push('[AR-ASSET][' + cfg.batchName + '] fallback 后的最终 review 失败');
      }
    } else {
      unresolvedFindings.push('[AR-ASSET][' + cfg.batchName + '] fallback 生成失败（不合格 ' + failed.length + ' 个残留）');
    }
  }
  return false;
}

const assetCommonRules = [
  '必读: ' + ART.assetsManifest + ' / ' + ART.artBibleJson + ' / ' + DOCS.assetsConfig + ' / ' + STATE.assetRouting + '（路由表为真实。禁止生成中重新判定。用 shippable:false 路由生成的资产必须作为未解决事项报告）。',
  '**Primary 发生 API 失败（4xx/5xx/timeout）时，禁止连 1 段 fallback 都不尝试就直接本地降级/占位符/must-replace 化**（因质量不合格而重新生成照旧固定 Primary — 本规则只针对 API 失败时的路由切换）。将 ' + STATE.assetRouting + ' 的 fallbacks 自上而下全段尝试，并把每次尝试的『路由名 + HTTP 状态（或失败原因）』全部列举到 degradedRoutes（例: "model_character: meshy:direct→422 / fal:meshy-v6→429 / tripo:direct→403 → local降级"）。仅在全段失败时才允许本地降级（retro-e3 问题7）。',
  'API 密钥: **仅限调用 API 的 Bash**，在开头执行 `set -a; source .env 2>/dev/null; set +a` 后再 curl（验证、后处理 — ffmpeg/npx 等 — 的 Bash 中不要 source: 避免密钥继承给第三方子进程。禁止 echo、日志输出密钥值 — contract §10）。API 错误（401/403/429/5xx）不要静默吞掉，要连同 HTTP 状态一起报告。',
  '对象仅限核心循环垂直切片必需的资产（从 ' + STATE.stories + ' 的 phase:prototype 的 acceptance 与 ' + ART.assetsManifest + ' 确定）。其余留到 Phase 3。',
  '预算: 每次生成都核对 ' + STATE.budget + '（默认 $20）与 ' + ART.manifest + ' 的 cost_usd 合计，预计超出时停止生成并报告剩余项。',
  '将全部生成以 1行1资产的形式追加写入 ' + ART.manifest + '（provider/model/prompt/seed/cost_usd/plan_tier/sha256/license/generated_at。标注条款提供商 — Ideogram 标注条款 / Hunyuan3D Territory / ElevenLabs Studio Games 等 — 还必须有 license_note（assets-config.md「Provenance」）。3D 资产还必须有 kind/polycount/bone_count/rigged/format/units/bbox_authoring_m/validator。按信用点换算的估算标记 cost_estimated:true）。',
  '保存位置为 ' + EP.rawAssetDir + ' 之下。完成后限定路径 add，**commit 也必须是指定路径形式**: `git add ' + EP.rawAssetDir.replace(/\/$/, '') + ' design docs state/reviews && git commit -m "<msg>" -- ' + EP.rawAssetDir.replace(/\/$/, '') + ' design docs state/reviews`（禁止不带路径的 git commit、禁止整个指定 state 目录 — 不要卷入并行代码 lane 的 stories.yaml / active.md 的 WIP）。',
  '禁止 `git add -A`（不要卷入并行实现 track 的代码变更）。commit 因 index.lock 失败时等待 1～2 秒后仅重试 1 次。',
].join('\n');

async function generateImages() {
  return assetBatchLoop({
    batchName: 'assets-images-prototype',
    producerType: 'art-director',
    reviewSubject: 'Phase 2 生成的图像资产批次（' + EP.rawAssetDir + ' 之下、' + ART.manifest + ' 本次追加写入的部分）',
    generatePrompt: [
      '你是 ArcadeRelay 的 art-director。生成核心循环必需的图像资产。',
      assetCommonRules,
      '风格一致性: 将 ' + ART.artBibleJson + ' 的 style_block 机械地前置于全部提示词，并记录 seed。hero 系共用 character_reference。',
      '全数执行生成后流水线（' + DOCS.assetsConfig + ' 所载）: 立即下载 → Alpha 验证（禁止发布白背景 PNG）→ 必要时去背景 → 裁剪。',
      '最后报告已生成资产的列表（file / ASSET_KEYS 用键方案）以及因预算原因暂缓的资产。',
    ].join('\n'),
    regeneratePrompt: function (failed) {
      return [
        '你是 ArcadeRelay 的 art-director。重新生成 AR-ASSET 不合格的图像（路由保持 ' + STATE.assetRouting + ' 的 Primary 不变）。',
        '不合格列表（反映 reason 与 retryInstruction 修改提示词）:',
        failed.map(function (f) { return '- ' + f.file + ': ' + f.reason + (f.retryInstruction ? '（重新生成指示: ' + f.retryInstruction + '）' : ''); }).join('\n'),
        assetCommonRules,
        '重新生成的部分也追加写入 ' + ART.manifest + '，并替换旧文件。',
      ].join('\n');
    },
    fallbackPrompt: function (failed) {
      return [
        '你是 ArcadeRelay 的 art-director。对 3次不合格的图像，切换到 ' + DOCS.assetsConfig + ' 路由表的 Fallback 提供商仅重新生成 1 次。',
        '对象:',
        failed.map(function (f) { return '- ' + f.file + ': ' + f.reason; }).join('\n'),
        assetCommonRules,
      ].join('\n');
    },
  });
}

async function generateAudio() {
  return assetBatchLoop({
    batchName: 'assets-audio-prototype',
    producerType: 'audio-designer',
    reviewSubject: 'Phase 2 生成的 SFX 批次（' + EP.rawAssetDir + ' 之下、' + ART.manifest + ' 本次追加写入的部分）。音频按规格一致（长度、格式、响度、与 ' + ART.assetsManifest + ' 的一致性）评分',
    generatePrompt: [
      '你是 ArcadeRelay 的 audio-designer。生成核心循环必需的 SFX（BGM 在 Phase 3。本次仅 SFX）。',
      assetCommonRules,
      '路由: ElevenLabs SFX v2 的 REST 直连（禁止官方 MCP、明示 duration_seconds、循环素材 loop:true）。禁止在 Free 计划下做发布用生成。',
      '生成后流水线: ffmpeg loudnorm（-16 LUFS）+ 静音裁剪 → 同时输出 OGG Vorbis 128-160kbps 与 M4A/AAC。',
      'SFX 无 seed，因此用通用词汇生成 4 个变体 → 筛选最佳，并将筛选理由也追加写入 ' + ART.manifest + '。',
      '最后报告已生成 SFX 的列表（file / ASSET_KEYS 用键方案）。',
    ].join('\n'),
    regeneratePrompt: function (failed) {
      return [
        '你是 ArcadeRelay 的 audio-designer。重新生成 AR-ASSET 不合格的 SFX（同一路由、修改提示词）。',
        '不合格列表:',
        failed.map(function (f) { return '- ' + f.file + ': ' + f.reason + (f.retryInstruction ? '（重新生成指示: ' + f.retryInstruction + '）' : ''); }).join('\n'),
        assetCommonRules,
      ].join('\n');
    },
    fallbackPrompt: function (failed) {
      return [
        '你是 ArcadeRelay 的 audio-designer。对 3次不合格的 SFX，切换到 ' + DOCS.assetsConfig + ' 的本地降级路由（jsfxr。公有领域、确定性、可发布）仅生成 1 次。',
        '对象:',
        failed.map(function (f) { return '- ' + f.file + ': ' + f.reason; }).join('\n'),
        assetCommonRules,
      ].join('\n');
    },
  });
}

// 仅 3D 引擎时: 核心循环必需的 3D 模型/动画（MDL/ANM）批次
async function generateModels() {
  return assetBatchLoop({
    batchName: 'assets-models-prototype',
    producerType: 'art-director',
    reviewSubject: 'Phase 2 生成的 3D 模型/动画资产批次（' + EP.rawAssetDir + ' 之下、' + ART.manifest + ' 本次追加写入的部分）。按 ' + DOCS.gates + ' 的 AR-ASSET「3D资产」要点（gltf-validator / 多边形数、骨骼数 / 缩放 / rig / 风格一致）机械检查',
    generatePrompt: [
      '你是 ArcadeRelay 的 art-director。生成核心循环必需的 3D 模型资产（MDL/ANM）。',
      assetCommonRules,
      '路由: 遵循 ' + STATE.assetRouting + ' 的 model_character / model_prop / model_environment / anim 路由（Primary: Meshy 直连 API（密钥有效时）→ 第二候选: 经 fal 的 fal-ai/meshy/*。Meshy 直连的 rigging/animation 返回 403 时仅对该资产类型切换到经 fal 并务必报告。无密钥降级: Blender 程序化+Rigify 或引擎内基本体 — 此时全部 must_replace: true）。',
      '风格一致性: 将 ' + ART.artBibleJson + ' 的概念图（reference_images / character_reference）用作 image-to-3D 的输入，遵循 art-bible 的 3D 风格方针（多边形预算、rig 方针）。',
      '生成后流水线（' + DOCS.assetsConfig + ' 的 3D 节）中 **不启动 Unity/UE 的全部阶段** 都要执行: schema 验证（GLB: gltf-transform validate / FBX: 用 Blender headless 转换为 GLB 后做同样的 validate）→ 多边形数/骨骼数/非流形检查 → 将 authoring-time 尺寸测量记录到 MANIFEST 的 bbox_authoring_m → 为确认风格，将 Blender headless 渲染的预览图输出到 ' + EP.rawAssetDir + 'previews/。',
      '**不做引擎导入**（由 Integrate 阶段在串行区间执行 — ' + (engine === 'unity' ? 'Unity 对同一项目为单实例锁，不得从并行 lane 启动 Unity' : 'UE 编辑器的启动集中到 Integrate') + '。参见 tech-stack 文档）。',
      '最后报告已生成资产的列表（file / kind / rigged / 注册键方案）以及因预算原因暂缓的资产。',
    ].join('\n'),
    regeneratePrompt: function (failed) {
      return [
        '你是 ArcadeRelay 的 art-director。重新生成 AR-ASSET 不合格的 3D 资产（路由保持 ' + STATE.assetRouting + ' 的 Primary 不变）。',
        '不合格列表（反映 reason 与 retryInstruction 修改概念图/提示词）:',
        failed.map(function (f) { return '- ' + f.file + ': ' + f.reason + (f.retryInstruction ? '（重新生成指示: ' + f.retryInstruction + '）' : ''); }).join('\n'),
        assetCommonRules,
        '重新生成的部分也追加写入 ' + ART.manifest + '，并替换 raw 的旧文件（引擎导入目标的更新交给 Integrate 阶段 — 不从并行 lane 启动引擎）。',
      ].join('\n');
    },
    fallbackPrompt: function (failed) {
      return [
        '你是 ArcadeRelay 的 art-director。对 3次不合格的 3D 资产，切换到 ' + STATE.assetRouting + ' 的 fallbacks（直连 API 或本地降级）仅重新生成 1 次（参见 ' + DOCS.assetsConfig + ' 的 3D 路由表。降级生成为 must_replace: true）。',
        '对象:',
        failed.map(function (f) { return '- ' + f.file + ': ' + f.reason; }).join('\n'),
        assetCommonRules,
      ].join('\n');
    },
  });
}

// Build 与 AssetGen 以屏障方式并行（代码顺序执行，资产为图像/音频（+3D 模型）并行）
// 并行区间在开始前仅声明一次代表阶段（禁止在 thunk 内调用 phase()，
// 因为标记转移会变得不确定。细分交给 agent opts 的 phase 标签）。
phase('Build');
const assetThunks = [
  laneSafe('AssetGen(images) track', function () { return generateImages(); }),
  laneSafe('AssetGen(audio) track', function () { return generateAudio(); }),
];
if (EP.assets3d) assetThunks.push(laneSafe('AssetGen(models) track', function () { return generateModels(); }));
// 外层的 laneSafe 不是用于捕获 lane 失败（内层 thunk 全部已 laneSafe、parallel 会把异常
// 吞成 null）— 只捕获 buildStories 的 lane 拆分等 parallel 前后的设置/汇总代码的异常
const parallelResults = await parallel([
  laneSafe('Build story lane 群', function () { return buildStories(); }),
  laneSafe('AssetGen track 群', function () { return parallel(assetThunks); }),
]);
log('Build/AssetGen 并行完成: ' + JSON.stringify(parallelResults));

// 批量验证（lane 合流后的串行区间 — retro-e2 方案B。引擎启动从此处开始串行。
// 为了让之后的 Integrate/QA 不成为「首次编译」，统一保证全部 story 的已提交代码）
let buildVerifyOk = true;
if (stories.length > 0) {
  buildVerifyOk = await batchVerify('Build',
    '到此为止 Build lane（gameplay/ui 并行）已实现 phase:prototype 的全部代码 story，lane 期间未执行引擎验证' +
    '（' + DOCS.techStack + '「验证」节的验证批处理化）。统一验证并修复全部 story 的已提交代码。');
}
// 向后续提示词注入警告（与 integrate 的降级注入相同的模式 — 评审问题 F3）
const BUILD_VERIFY_WARN = buildVerifyOk ? '' : '【警告: Build 批量验证未通过 — 参见 ' + STATE.reviewsDir + '/batch-verify.md。请以构建已损坏为前提作业】\n';

// =========================================================================
// Phase: Integrate — 将生成资产经由 ASSET_KEYS 集成
// =========================================================================
phase('Integrate');

const INTEGRATE_SCHEMA = {
  type: 'object',
  required: ['ok', 'degradations'],
  properties: {
    ok: { type: 'boolean', description: '引擎导入后验证（gates.md AR-ASSET ※节）是否全部合格' },
    degradations: {
      type: 'array',
      items: { type: 'string' },
      description: '降级、警示的列表（例: Humanoid→Generic 降级、应用了缩放修正、导入警示、缺失资产的占位符残留）。没有则为空数组'
    },
    summary: { type: 'string' },
  },
};

const integrate = await agentR(
  [
    BUILD_VERIFY_WARN +
    '你是 ArcadeRelay 的 gameplay-engineer。将已生成的资产集成到 game/（engine: ' + engine + '。串行区间 — 引擎启动由本工序独占）。',
    '必读: ' + ART.manifest + '（生成资产列表）/ ' + ART.architecture + ' / ' + ART.conventions + ' / ' + DOCS.techStack + '。',
    '',
    '步骤:',
    EP.integrateSteps,
    '6. **引擎导入后验证**（gates.md AR-ASSET 的※节）: 机械验证 FBX 导入成功、导入后包围盒、rig 资产的动画能否播放（unity: Avatar.isValid / unreal: 重定向成功），并将结果记录到 ' + ART.manifest + ' 的 validator。失败、降级作为 degradations 返回（不能只写 MANIFEST 注记了事）。',
    '7. 因未生成、不合格而缺失的资产保持占位符，并将缺失列表包含在 degradations 中。',
    '8. 更新 ' + STATE.active + '（日期时间使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写），限定路径 add 后提交: `git add game docs state design && git commit -m "phase2: integrate assets"`（禁止 `git add -A` — 不要卷入 .claude/ 等非作业对象的变更）。',
    IDEMPOTENT_RULE,
    '结构化返回: ok / degradations / summary（包含已集成的资产键列表与缺失列表）。',
  ].join('\n'),
  { label: 'integrate-assets', phase: 'Integrate', agentType: 'gameplay-engineer', effort: 'high', schema: INTEGRATE_SCHEMA }
);
if (integrate === null) {
  unresolvedFindings.push('[Integrate] 资产集成 agent 失败。可能仍是占位符');
  knownIssues.push('资产集成可能未完成（Integrate agent 失败）');
} else {
  for (const d of (integrate.degradations || [])) {
    unresolvedFindings.push('[Integrate] ' + d);
  }
  if (integrate.ok === false) {
    unresolvedFindings.push('[Integrate] 引擎导入后验证不合格（详情见 degradations 与 ' + ART.manifest + ' 的 validator）');
  }
}

// =========================================================================
// Phase: QA — QA-PLAY（实际启动、实际操作、证据）。重大 bug 修复后再 QA（MAX 2）
// =========================================================================
phase('QA');

const qaSchema = {
  type: 'object',
  required: ['verdict', 'criticalBugs', 'failedAcceptance', 'summary', 'evidencePaths', 'screenshotsVisuallyConfirmed'],
  properties: {
    verdict: { type: 'string', enum: ['APPROVE', 'CONCERNS', 'REJECT'] },
    summary: { type: 'string' },
    criticalBugs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'detail', 'assignee'],
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          storyId: { type: 'string' },
          assignee: { type: 'string', enum: ['gameplay-engineer', 'ui-engineer'] },
        },
      },
    },
    failedAcceptance: { type: 'array', items: { type: 'string' } },
    evidencePaths: { type: 'array', items: { type: 'string' } },
    screenshotsVisuallyConfirmed: {
      type: 'boolean',
      description: '是否用 Read 目视了全部截图并确认对象（模型、UI 文字）出现在画面中（gates.md QA-PLAY 视觉证据的目视义务。false/未实施的 APPROVE 无效）',
    },
  },
};

// 证据实际存在的独立验证 schema（workflow 侧机械确认 qa-lead 的自我申报）
const EVIDENCE_CHECK_SCHEMA = {
  type: 'object',
  required: ['checks'],
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'exists', 'nonEmpty'],
        properties: {
          path: { type: 'string' },
          exists: { type: 'boolean' },
          nonEmpty: { type: 'boolean' },
          bytes: { type: 'number' },
        },
      },
    },
    extraFilesInEvidenceDir: { type: 'array', items: { type: 'string' } },
  },
};

let qaResult = null;
const QA_MAX = 2; // review-loops.md: QA-PLAY MAX_ITER 2
for (let round = 1; round <= QA_MAX; round++) {
  qaResult = await agentR(
    [
      BUILD_VERIFY_WARN + reviewModeNote(reviewMode),
      'GATE: QA-PLAY（遵循 ' + DOCS.gates + ' 的 QA-PLAY 节中 engine=' + engine + ' 的执行手段）。iteration ' + round + '/' + QA_MAX + '。',
      '对象: ' + EP.qaTarget,
      (integrate && (integrate.degradations || []).length > 0
        ? '【Integrate 有降级报告 — 相关位置重点验证（尤其 rig 降级时必须目视确认动画播放）】: ' + integrate.degradations.join(' / ')
        : ''),
      '',
      '验证项目:',
      '1. ' + EP.qaBuildLine,
      '2. 用 ' + ART.gdd + ' 所载的操作能跑通核心循环一轮（开始→挑战→结果→重新开始）。此外必需场景转移 Title→Menu→Game→Result→Menu 跑通一轮（contract §11。含 Menu 的必需要素 = 开始游戏、游戏外内容显示、设置、退出入口 实际存在。设置的实效性 — 音量变更反映到实际输出并持久化 — 也要验证 — gates.md QA-PLAY 要点2）。对 Title/Menu/Game/Result 各画面截图（Game 不允许开始瞬间的空场面 — 在核心循环的主要对象出现在画面中的帧截图。gates.md 视觉证据）。',
      '3. 逐条实际操作验证 ' + STATE.stories + ' 中 phase:prototype 全部 story 的 acceptance。',
      '4. 实际游玩体感是否违背了 ' + ART.concept + ' 的支柱 P-xx。',
      '5. 元进度的持久化（gates.md QA-PLAY 要点5）: 用自动测试验证 保存→相当于重启→恢复一致，损坏存档→.bak 备份保存＋[SaveCorruption] 显式错误1次＋默认值恢复。',
      '6. 视觉证据的机械检测＋目视（gates.md QA-PLAY 视觉证据的目视义务）: 对全部截图做 magick 的 mean 检查（<0.02 / >0.98 = SUSPECT_BLANK → 切换截图方式重新截图）与主要 UI 文本的低对比度检查（crop + stddev < 0.05 = SUSPECT_LOW_CONTRAST → 目视判定可读性 — gates.md 视觉证据），并务必用 Read 目视，把「画面中有什么」记录到 ' + ART.qaReport + ' 的目视所见表。',
      '',
      '将证据（截图/录像）保存到 ' + ART.qaEvidence + '，并把结果写入 ' + ART.qaReport + '。',
      '将评审历史追加写入 ' + STATE.reviewsDir + '/qa.md（review-loops.md 的追加写入格式、iteration ' + round + '。日期时间使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）。',
      '判定: 重大 bug 为 0 且 acceptance 全部通过 = APPROVE。',
      '响应的第1行为「QA-PLAY: APPROVE|CONCERNS|REJECT」（contract.md §5），结构化返回中也放入相同的判定。',
      '结构化返回: verdict / summary / criticalBugs（title、detail、storyId、修复负责的 assignee。仅重大 bug。轻微问题写在 qa/report.md）/ failedAcceptance（未通过的 acceptance 列表。每行一条 story ID 与未满足的内容。全部通过则为空数组）/ evidencePaths（已保存证据的相对路径）/ screenshotsVisuallyConfirmed（是否已用 Read 目视全部截图。未实施则如实返回 false）。',
    ].filter(Boolean).join('\n'),
    { label: 'qa-play-round' + round, phase: 'QA', agentType: 'qa-lead', effort: 'high', schema: qaSchema }
  );

  if (!qaResult) {
    unresolvedFindings.push('[QA-PLAY] round ' + round + ' 的 QA agent 失败');
    continue;
  }

  // 证据实际存在＋目视声明的独立机械验证（workflow 用另一 agent 确认 qa-lead 的自我申报 — E1 教训: 自我申报不能成为唯一关卡）
  {
    const evCheck = await agentR(
      [
        '只读验证任务。对以下证据路径列表，用 Bash（`test -s`、`stat`）机械验证各文件实际存在且大小非0。禁止创建、修改、删除文件。',
        '证据路径(JSON): ' + JSON.stringify(qaResult.evidencePaths || []),
        '此外用 ls 确认 ' + ART.qaEvidence + ' 直下的实际文件列表并在 extraFilesInEvidenceDir 中返回。',
      ].join('\n'),
      { label: 'verify-evidence-round' + round, phase: 'QA', effort: 'low', schema: EVIDENCE_CHECK_SCHEMA }
    );
    const missing = [];
    if (!evCheck) {
      missing.push('证据验证 agent 未返回结果');
    } else {
      // 完备性核对: 要求 evidencePaths 的每个路径都以 exists && nonEmpty 出现在 checks 中
      // （验证 agent 返回 checks:[] 或部分回答时不允许伪装合格）
      const byPath = {};
      for (const c of (evCheck.checks || [])) byPath[c.path] = c;
      for (const p of (qaResult.evidencePaths || [])) {
        const c = byPath[p];
        if (!c) missing.push(p + '（未出现在验证结果中 — 未验证）');
        else if (!c.exists || !c.nonEmpty) missing.push(p + '（' + (!c.exists ? '不存在' : '0字节') + '）');
      }
    }
    if ((qaResult.evidencePaths || []).length === 0) missing.push('evidencePaths 为空（无证据的判定无效 — qa-lead.md）');
    if (qaResult.screenshotsVisuallyConfirmed !== true) missing.push('截图的 Read 目视未实施（screenshotsVisuallyConfirmed=false）');
    if (missing.length > 0) {
      if (qaResult.verdict === 'APPROVE') {
        qaResult.verdict = 'CONCERNS';
        log('[QA-PLAY] round ' + round + ': 证据/目视的机械验证不合格 → 将 APPROVE 降为 CONCERNS');
      }
      unresolvedFindings.push('[QA-PLAY] round ' + round + ' 证据/目视的机械验证不合格: ' + missing.join(' / '));
    }
  }

  log('[QA-PLAY] round ' + round + ': ' + qaResult.verdict + '（重大 bug ' + qaResult.criticalBugs.length + ' 个 / acceptance 未通过 ' + (qaResult.failedAcceptance || []).length + ' 个）');
  recordVerdict('QA-PLAY', 'qa', round, qaResult.verdict,
    qaResult.criticalBugs.map(function (b) { return b.title; }).concat(qaResult.failedAcceptance || []));
  if (qaResult.verdict === 'APPROVE') {
    break; // 合格仅限 verdict === APPROVE（禁止以 criticalBugs 为 0 个走捷径）
  }

  if (round < QA_MAX) {
    // 由 assignee 修复重大 bug（同一代码库因此顺序执行。避免冲突）
    for (let bi = 0; bi < qaResult.criticalBugs.length; bi++) {
      const bug = qaResult.criticalBugs[bi];
      const fixed = await agentR(
        [
          '你是 ArcadeRelay 的实现 engineer。修复 QA-PLAY 检出的重大 bug。',
          'bug: ' + bug.title,
          '详情: ' + bug.detail,
          bug.storyId ? '相关 story: ' + bug.storyId : '',
          '参考: ' + ART.qaReport + '（QA 所见全文）/ ' + ART.conventions + ' / ' + DOCS.techStack + '。',
          '修复后确认 ' + EP.verifyCmd + ' 以 exit 0 结束，限定路径 add 后提交: `git add game state ' + DOCS.techStack + ' && git commit -m "phase2: fix QA — ' + bug.title + '"`（禁止 `git add -A`、禁止整个指定 `.claude/docs` 目录。' + DOCS.techStack + ' 是为了把下述陷阱提升记录包含在同一提交中 — 仅在追加写入时才会被 stage）。',
          '若修复原因是引擎/测试运行器导致的一般性问题（环境陷阱），立即追加写入 tech-stack 文档的「已知陷阱」节（没有则新建 — gates.md QA-PLAY）。',
          IDEMPOTENT_RULE,
          '简洁返回修复内容。',
        ].filter(Boolean).join('\n'),
        // label 中包含 round: 同一 bug 跨 round 残留时，(prompt, opts) 缓存不会 replay
        // 上一 round 的修复结果而静默跳过再次修复（resume 安全 — adversarial M-8a）。
        // 也包含 bug index: 同一 round、同一 assignee 有多个 bug 时 label 会冲突，
        // reviewer 返回2条同文 bug 时第2条会 replay 第1条的缓存（adversarial M-8b）
        { label: 'fix-qa-r' + round + '-' + bug.assignee + '-' + bi, phase: 'QA', agentType: bug.assignee, effort: 'high' }
      );
      if (fixed === null) {
        unresolvedFindings.push('[QA-PLAY] 重大 bug「' + bug.title + '」的修复 agent 失败');
      }
    }
    // acceptance 未通过也是修复对象（不在保留非APPROVE原因的情况下再 QA）
    if ((qaResult.failedAcceptance || []).length > 0) {
      const faFixed = await agentR(
        [
          '你是 ArcadeRelay 的实现 engineer。修复代码以满足 QA-PLAY 中未通过的 acceptance。',
          '未通过列表:',
          qaResult.failedAcceptance.map(function (fa, idx) { return (idx + 1) + '. ' + fa; }).join('\n'),
          '参考: ' + ART.qaReport + '（QA 所见全文）/ ' + STATE.stories + '（acceptance 原文）/ ' + ART.conventions + ' / ' + DOCS.techStack + '。',
          '修复后确认 ' + EP.verifyCmd + ' 以 exit 0 结束，限定路径 add 后提交: `git add game state ' + DOCS.techStack + ' && git commit -m "phase2: fix QA — failed acceptance"`（禁止 `git add -A`、禁止整个指定 `.claude/docs` 目录。' + DOCS.techStack + ' 是为了把陷阱提升记录包含在同一提交中）。',
          '若修复原因是引擎/测试运行器导致的一般性问题（环境陷阱），立即追加写入 tech-stack 文档的「已知陷阱」节（没有则新建 — gates.md QA-PLAY）。',
          IDEMPOTENT_RULE,
          '简洁返回修复内容。',
        ].join('\n'),
        { label: 'fix-qa-acceptance-r' + round, phase: 'QA', agentType: 'gameplay-engineer', effort: 'high' }
      );
      if (faFixed === null) {
        unresolvedFindings.push('[QA-PLAY] acceptance 未通过的修复 agent 失败');
      }
    }
  } else {
    for (const bug of qaResult.criticalBugs) {
      unresolvedFindings.push('[QA-PLAY] 未解决的重大 bug: ' + bug.title + ' — ' + bug.detail);
    }
  }
}
if (qaResult && qaResult.verdict !== 'APPROVE') {
  knownIssues.push('QA-PLAY 在 MAX ' + QA_MAX + ' 轮内未达到 APPROVE（详情: ' + ART.qaReport + '）');
  for (const fa of qaResult.failedAcceptance || []) {
    unresolvedFindings.push('[QA-PLAY] acceptance 未通过: ' + fa);
  }
  if (qaResult.summary) {
    unresolvedFindings.push('[QA-PLAY] 非APPROVE摘要: ' + qaResult.summary);
  }
}

// =========================================================================
// Phase: Final — CD-CHECKPOINT → 返回 Checkpoint B 材料
// =========================================================================
phase('Final');

const cdSchema = {
  type: 'object',
  required: ['verdict', 'summary', 'playInstructions', 'evidencePaths', 'knownIssues'],
  properties: {
    verdict: { type: 'string', enum: ['APPROVE', 'CONCERNS', 'REJECT'] },
    summary: { type: 'string' },
    playInstructions: { type: 'string' },
    evidencePaths: { type: 'array', items: { type: 'string' } },
    knownIssues: { type: 'array', items: { type: 'string' } },
    rejectInstructions: { type: 'array', items: { type: 'string' } },
  },
};

function cdPrompt(attemptNote) {
  return [
    'GATE: CD-CHECKPOINT（遵循 ' + DOCS.gates + ' 的 CD-CHECKPOINT 节）。向人类展示 Checkpoint B（可玩的垂直切片）之前的最终判定。',
    attemptNote || '',
    '确认对象: ' + ART.brief + ' / ' + ART.concept + '（支柱）/ ' + ART.gdd + ' / ' + STATE.stories + ' / ' + ART.qaReport + ' / ' + ART.manifest + ' / ' + STATE.reviewsDir + '/ 之下的评审历史。',
    '',
    '循环中遗留的未解决问题（须如实包含在展示物中。禁止隐瞒。**以 [BLOCKER] 开头的条目与降级（Humanoid→Generic / 占位符 / Fallback / shippable:false / [披露]）要在 summary 开头单独警告，不得埋没在条目列表中** — gates.md CD-CHECKPOINT 要点3）:',
    // 先压平换行再做成条目列表（findings 中可能含有来自外部 API 错误正文的文本 — degradedRoutes/notes/
    // laneSafe 的 e.message — 原始换行会破坏条目列表结构并向判定者提示词做行注入）
    unresolvedFindings.length > 0 ? unresolvedFindings.map(function (f) { return '- ' + String(f).replace(/\s*\n\s*/g, ' / '); }).join('\n') : '- 无',
    '',
    '要点: 1) 愿景一致性（是否偏离 brief、P-xx） 2) 展示质量（人类能否在5分钟内判断的摘要） 3) 诚实性（未达成、妥协点是否已列举）。',
    '同时将 ' + STATE.active + ' 更新为「Phase 2 完成、等待 Checkpoint B」（日期时间使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）。',
    '',
    '响应的第1行为「CD-CHECKPOINT: APPROVE|CONCERNS|REJECT」（contract.md §5），结构化返回的 verdict 中也放入相同的判定。',
    '结构化返回:',
    '- verdict: APPROVE/CONCERNS/REJECT',
    '- summary: 做了什么、希望判断什么、已知课题（面向人类的5分钟摘要）',
    '- playInstructions: 人类游玩的步骤（以「' + EP.playInstructions + '」为起点的具体步骤与操作方法）',
    '- evidencePaths: ' + ART.qaEvidence + ' 之下应展示的证据路径',
    '- knownIssues: 未达成、妥协点的列举',
    '- rejectInstructions: 仅 REJECT 时，向人类展示前应修正之处的指示列表',
  ].filter(Boolean).join('\n');
}

let cd = await agentR(cdPrompt(null), {
  label: 'cd-checkpoint-b',
  phase: 'Final',
  agentType: 'creative-director',
  effort: 'high',
  schema: cdSchema,
});
if (cd) {
  recordVerdict('CD-CHECKPOINT', 'checkpoint-b', 1, cd.verdict, cd.knownIssues || []);
}

// REJECT 则按指示修正后仅重新判定 1 次（review-loops.md: CD-CHECKPOINT MAX_ITER 1）
if (cd && cd.verdict === 'REJECT' && cd.rejectInstructions && cd.rejectInstructions.length > 0) {
  log('[CD-CHECKPOINT] REJECT → 按指示修正后仅重新判定1次');
  const cdFix = await agentR(
    [
      '你是 ArcadeRelay 的 tech-director。CD-CHECKPOINT 判为 REJECT。按以下指示修正 Checkpoint B 展示物（必要时直接修正各负责人的产出物、重新构建、重新提交）。',
      '指示列表:',
      cd.rejectInstructions.map(function (r, idx) { return (idx + 1) + '. ' + r; }).join('\n'),
      '验证: ' + EP.verifyCmd + ' 以 exit 0 结束。将处理内容追加写入 ' + STATE.reviewsDir + '/checkpoint-b.md 的「处理:」栏，限定路径 add 后提交: `git add game docs state design qa && git commit`（禁止 `git add -A`）。',
    ].join('\n'),
    { label: 'cd-reject-fix', phase: 'Final', agentType: 'tech-director', effort: 'high' }
  );
  if (cdFix !== null) {
    const cdRetry = await agentR(cdPrompt('（对 REJECT 指示修正后的重新判定。这是最后一次判定）'), {
      label: 'cd-checkpoint-b-rejudge',
      phase: 'Final',
      agentType: 'creative-director',
      effort: 'high',
      schema: cdSchema,
    });
    if (cdRetry) {
      recordVerdict('CD-CHECKPOINT', 'checkpoint-b', 2, cdRetry.verdict, cdRetry.knownIssues || []);
      cd = cdRetry;
    } else {
      // 与 concept-design.js 的重新判定 null 记录同形（让人类知道是以初次 REJECT 的状态展示的）
      unresolvedFindings.push('[CD-CHECKPOINT] REJECT 后的重新判定 agent 失败（以初次 REJECT 判定进入 Checkpoint B）');
    }
  } else {
    unresolvedFindings.push('[CD-CHECKPOINT] 对 REJECT 指示的修正 agent 失败');
  }
}

if (!cd) {
  return {
    summary: 'Phase 2 已跑完但 CD-CHECKPOINT 判定 agent 失败。请直接确认产出物 ' + STATE.stories + ' / ' + ART.qaReport + ' / game/。',
    playInstructions: EP.playInstructions,
    evidencePaths: (qaResult && qaResult.evidencePaths) || [],
    knownIssues: knownIssues.concat(['未能获取 CD-CHECKPOINT 判定']),
    unresolvedFindings: unresolvedFindings,
    verdictHistory: verdictHistory,
    verdict: 'CONCERNS',
  };
}

return {
  summary: cd.summary,
  playInstructions: cd.playInstructions,
  evidencePaths: (cd.evidencePaths && cd.evidencePaths.length > 0)
    ? cd.evidencePaths
    : ((qaResult && qaResult.evidencePaths) || []),
  knownIssues: knownIssues.concat(cd.knownIssues || []),
  unresolvedFindings: unresolvedFindings,
  verdictHistory: verdictHistory,
  verdict: cd.verdict,
};
