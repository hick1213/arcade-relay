// .claude/workflows/full-build.js — Phase 3（由 /forge-build 启动，contract.md §4）
// args: { reviewMode, engine?, checkpointBFeedbackPath }（engine 为 contract §11 的3个值之一。省略时为 phaser）
// 流程: Replan → (Build ∥ AssetGen) → Polish → FullQA → Final(CD-CHECKPOINT) → return Checkpoint C 材料
// 规范的权威来源: .claude/docs/contract.md / review-loops.md / gates.md / tech-stack.md / assets-config.md
// 注: review-mode=full 表示「完成后展示全部 verdict 历史」（contract §9 / review-loops.md）。
//     本 workflow 将所有 Gate verdict 累积到 verdictHistory 并包含在返回值中，
//     由调用方 skill(/forge-build) 在完成后向人类全部展示（workflow 内部不可使用 AskUserQuestion）。

export const meta = {
  name: 'full-build',
  description: 'ArcadeRelay Phase 3: 反映 checkpoint-b-feedback 的重新规划、正式实现与全部资产生成并行、polish、完整QA、经 CD-CHECKPOINT 后返回 Checkpoint C 材料',
  phases: [
    { title: 'Replan', detail: 'tech-director 反映 checkpoint-b-feedback 更新 stories.yaml（资产类 feedback 反映到 design/assets.md），game-designer 视需要修订 gdd 相关章节（不可变更支柱）' },
    { title: 'Build', detail: '将 phase:build 的代码 story 按 assignee lane（gameplay/ui）并行实现（lane 内顺序执行、每个 story 以限定路径的 add 提交、报告 hash、lane 期间不做引擎验证），并对每个 story 应用 CR-CODE 评审循环（MAX 1、单一 reviewer，对象以 git show <hash> 固定）。lane 合流后串行执行批量验证（引擎验证一次性执行+失败按 story 单位切分）' },
    { title: 'AssetGen', detail: '在路由表与预算检查下生成剩余全部资产（图像/SFX/BGM。engine=unity/unreal 时还包括 3D 模型 MDL/ANM），并执行 AR-ASSET 循环（MAX 2+fallback 1）、批次一致性检查、引擎导入（串行区间）' },
    { title: 'Polish', detail: 'game-designer 基于 config.ts 进行平衡确认并起草符合支柱的 juice/手感 polish story，engineer 按 assignee lane 并行实现（合流后批量验证）' },
    { title: 'FullQA', detail: 'qa-lead 执行全部 stories.yaml acceptance 的回归与 QA-PLAY（review 上限1次: QA→非APPROVE则上报）、资产审计（MANIFEST 成本合计、预算比较、许可标记提取→state/reviews/assets-audit.md）' },
    { title: 'Final', detail: '经 creative-director 的 CD-CHECKPOINT 判定（REJECT 时修正后仅再判定1次）后返回 Checkpoint C 材料' }
  ]
};

const DOCS = '.claude/docs';
const ENGINEERS = ['gameplay-engineer', 'ui-engineer'];

// ---------- 提交规范（D-05: 每个 story 一次 commit + 限定路径 add + index.lock 重试） ----------
// CODE_COMMIT_RULE / ASSET_COMMIT_RULE 含引擎相关路径，
// 因此在引擎配置确定后（args 段末尾）定义。

const GIT_RETRY_NOTE = 'git commit 若因 index.lock 失败，等待1～2秒后仅重试1次。';

// ---------- agentR: agent() 返回 null 时自动重试1次 ----------
// 针对 transient 错误（safety classifier 临时失败等）仅自动重试1次（retro-e3 问题5）。
// label 加上 -retry 使 opts 变化 = 缓存键改变，避免 replay 失败结果。
// 重试后仍为 null 则照旧由调用方上报
async function agentR(prompt, opts) {
  let r = await agent(prompt, opts);
  if (r === null) {
    log('agent null（可能是 transient）→ 重试1次: ' + ((opts && opts.label) || ''));
    // 禁止盲目重跑: 首次调用可能是「作业已完成但仅丢失了结构化响应」，
    // 因此前置 resume 守卫，防止重复执行已完成的作业（提交、资产生成、计费 API 调用）
    const guarded = '【重试执行】前一次同一任务调用可能在丢失结构化响应后中断。开始作业前先确认已有成果（git log 的最近提交、已生成文件、MANIFEST 追加记录），已完成的操作（提交、资产生成、计费 API 调用）不要重复。只执行未完成部分，若全部已完成则不再重跑，仅返回结果的结构化返回。\n\n' + prompt;
    r = await agent(guarded, Object.assign({}, opts, { label: (((opts && opts.label) || 'agent') + '-retry') }));
  }
  return r;
}

// ---------- schemas ----------

const STORY_LIST_SCHEMA = {
  type: 'object',
  required: ['stories'],
  properties: {
    stories: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'assignee', 'acceptance'],
        properties: {
          id: { type: 'string', description: 'S-xx 形式的稳定ID' },
          title: { type: 'string' },
          assignee: { type: 'string', enum: ['gameplay-engineer', 'ui-engineer', 'art-director', 'audio-designer'] },
          pillar: { type: 'string', description: 'P-xx 形式' },
          acceptance: { type: 'string' }
        }
      }
    },
    notes: { type: 'string' }
  }
};

const IMPL_SCHEMA = {
  type: 'object',
  required: ['commitHash'],
  properties: {
    commitHash: { type: 'string', description: '提交本次变更的 git hash（从 git log --format="%H %s" -20 中与自己消息一致的最新行获取 — rev-parse HEAD 可能拿到并行 lane 的提交）' },
    notes: { type: 'string' }
  }
};

const CODE_REVIEW_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['summary', 'severity'],
        properties: {
          summary: { type: 'string' },
          file: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }
        }
      }
    }
  }
};

const ASSET_GEN_SCHEMA = {
  type: 'object',
  required: ['generated', 'budgetExceeded', 'remainingPlanned', 'degradedRoutes'], // 防止省略 degradedRoutes 导致 fallback 记录丢失（没有时显式给空数组）
  properties: {
    generated: { type: 'array', items: { type: 'string' }, description: '已生成并追加到 MANIFEST 的资产路径列表' },
    budgetExceeded: { type: 'boolean', description: '因预计超预算而停止生成时为 true' },
    remainingPlanned: { type: 'number', description: '对象范围（design/assets.md 中 MANIFEST 未记载者）内尚未生成的资产数量（0 = 全部已生成）' },
    notes: { type: 'string', description: '披露事项（使用 shippable:false 路由、Meshy 403→fal 切换、quota 限制等）。没有则为空字符串' },
    degradedRoutes: { type: 'array', items: { type: 'string' }, description: '降级、fallback 尝试的全部记录（路由名+HTTP代码必填。例: "model_character: meshy:direct→422 / fal:meshy-v6→429 / tripo:direct→403 → local降级"）。没有则为空数组' }
  }
};

const ASSET_REVIEW_SCHEMA = {
  type: 'object',
  required: ['verdict', 'failedAssets', 'disclosures'],
  properties: {
    verdict: { type: 'string', enum: ['APPROVE', 'CONCERNS', 'REJECT'] },
    failedAssets: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'reason', 'retryInstruction'],
        properties: {
          file: { type: 'string' },
          reason: { type: 'string' },
          retryInstruction: { type: 'string', description: '含提示词修改方案的重新生成指示' }
        }
      }
    },
    disclosures: {
      type: 'array',
      items: { type: 'string' },
      description: '重新生成无法解决但需向人类披露的事项（源自 shippable:false 路由 / 经 fal 的 Meshy 许可继承未验证 / cost_estimated:true / must_replace 等 — gates.md AR-ASSET 要点6）。没有则为空数组'
    }
  }
};

const QA_SCHEMA = {
  type: 'object',
  required: ['verdict', 'bugs', 'evidencePaths', 'screenshotsVisuallyConfirmed'],
  properties: {
    verdict: { type: 'string', enum: ['APPROVE', 'CONCERNS', 'REJECT'] },
    summary: { type: 'string', description: '非 APPROVE 时判定理由的摘要' },
    bugs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['summary', 'severity', 'assignee'],
        properties: {
          summary: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          assignee: { type: 'string', enum: ['gameplay-engineer', 'ui-engineer'] },
          storyId: { type: 'string' }
        }
      }
    },
    failedAcceptance: { type: 'array', items: { type: 'string' }, description: '不合格的 story ID 列表' },
    evidencePaths: { type: 'array', items: { type: 'string' }, description: '已保存的证据文件相对路径列表' },
    screenshotsVisuallyConfirmed: {
      type: 'boolean',
      description: '是否已用 Read 目视全部截图并确认对象（模型、UI 文字）确实出现在画面中（gates.md QA-PLAY 视觉证据的目视义务。false/未实施的 APPROVE 无效）'
    }
  }
};

// 证据实际存在的独立验证 schema（由 workflow 侧机械确认 qa-lead 的自我申报）
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
          bytes: { type: 'number' }
        }
      }
    },
    extraFilesInEvidenceDir: { type: 'array', items: { type: 'string' } }
  }
};

const AUDIT_SCHEMA = {
  type: 'object',
  required: ['totalAssetCost', 'budgetUsd', 'overBudget', 'licenseFlags'],
  properties: {
    totalAssetCost: { type: 'number', description: 'MANIFEST.jsonl 的 cost_usd 合计（USD）' },
    budgetUsd: { type: 'number', description: 'state/budget.txt 的值' },
    overBudget: { type: 'boolean' },
    licenseFlags: { type: 'array', items: { type: 'string' } },
    mustReplaceAssets: { type: 'array', items: { type: 'string' }, description: 'license=placeholder-nc / must_replace=true 的残留资产' },
    provenanceGaps: { type: 'array', items: { type: 'string' }, description: 'MANIFEST 必填字段（plan_tier / bbox_authoring_m / validator / license）记录缺失、源自 shippable:false 路由、cost_estimated:true 的资产列表。没有则为空数组' }
  }
};

const CD_SCHEMA = {
  type: 'object',
  required: ['verdict', 'summary', 'playInstructions'],
  properties: {
    verdict: { type: 'string', enum: ['APPROVE', 'CONCERNS', 'REJECT'] },
    summary: { type: 'string', description: '让人类能在5分钟内做出判断的摘要（做了什么/希望判断什么/已知问题）' },
    playInstructions: { type: 'string', description: '启动与操作的步骤' },
    mustFix: { type: 'array', items: { type: 'string' }, description: 'REJECT 时，在展示给人类之前应修正的点' }
  }
};

// ---------- args / 共享状态 ----------

// args 规范化: 防御调用方/runner 以 JSON 字符串传入的情况（E2 实测。
// 无法解析的字符串倒向显式错误 — 不静默回落到默认值）
const ARGS = (typeof args === 'string') ? JSON.parse(args) : (args || {});
const reviewMode = ARGS.reviewMode ? String(ARGS.reviewMode) : 'lean';
const feedbackPath = ARGS.checkpointBFeedbackPath ? String(ARGS.checkpointBFeedbackPath) : 'state/checkpoint-b-feedback.md';
const unresolvedFindings = [];
const verdictHistory = []; // 全部 Gate verdict 的累积（review-mode=full: skill 在完成后向人类全部展示的材料）

// lane/轨道粒度的异常守卫: parallel() 会把 thunk 的异常压成 null，若不处理则
// 整个 lane 的中断（剩余 story 未实现）不会出现在 unresolvedFindings 的任何位置。
// 在 thunk 内 catch 并累积 [BLOCKER]（thunk 内的 catch 先于 parallel 的异常吞掉）
function laneSafe(name, fn) {
  return async function () {
    try {
      return await fn();
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      log('[laneSafe] ' + name + ' 因异常中断: ' + msg); // 也让执行中的观察者看到（unresolvedFindings 直到终端才可见）
      unresolvedFindings.push('[BLOCKER] ' + name + ' 因异常中断: ' + msg + '（其后的负责作业可能未执行 — 请通过 state/reviews 与 git log 确认实施范围）');
      return null;
    }
  };
}
let laneContextWarn = ''; // 注入到 lane 实现提示词开头的警告（在 Polish 开始时告知 Build 批量验证不合格 — adversarial L-11）

// ---------- 引擎配置（contract.md §11。值须与各 tech-stack 文档一致）----------
// phaser 的值与既有提示词字符串保持相同（向后兼容）。
// 仅 engine 未指定时默认 phaser。空字符串、非法值倒向下面的 throw（禁止静默 fallback）
const engine = (ARGS.engine !== undefined && ARGS.engine !== null) ? ARGS.engine : 'phaser';
const ENGINE_PROFILES = {
  phaser: {
    techStackDoc: DOCS + '/tech-stack.md',
    manifestPath: 'game/assets/MANIFEST.jsonl',
    rawAssetDir: 'game/assets/',
    assets3d: false,
    verifyCmd: 'cd game && npm run typecheck && npm run build',
    laneVerifyLine: '执行 `cd game && npm run typecheck`，**仅将自己编辑的文件引起的错误**降为 0（其他 lane 的半成品 WIP、对其他 lane 将提供的 API 的引用所引起的错误可以忽略 — lane 合流后的批量验证做最终确认。**并行 lane 期间不执行 `npm run build`** — dist/ 会与其他 lane 冲突 — tech-stack.md「验证命令」节）',
    implRulesLine: '2) 按 tech-stack.md 规范实现 game/src（魔法数字集中到 config.ts / 必须使用 delta-time / Scene 保持轻薄、逻辑放在 systems/ / systems/ 不 import Phaser / 资产引用经由 ASSET_KEYS）',
    reviewRulesLine: '代码规范违规（魔法数字、未使用 delta-time、Scene 臃肿、systems/ 依赖 Phaser、路径硬编码）',
    codeAddExample: 'git add game/src state/stories.yaml state/reviews',
    configPath: 'game/src/config.ts',
    audioFormatLine: '全部音频: ffmpeg loudnorm(-16 LUFS)＋静音裁剪 → 同时输出 OGG Vorbis 128-160kbps 与 M4A/AAC。',
    qaTarget: '在 headless 浏览器中实际启动、操作 game/ 并判定',
    playInstructions: 'cd game && npm install && npm run dev'
  },
  unity: {
    techStackDoc: DOCS + '/tech-stack-unity.md',
    manifestPath: 'game/_generated/MANIFEST.jsonl',
    rawAssetDir: 'game/_generated/',
    assets3d: true,
    verifyCmd: 'tech-stack-unity.md「验证命令」中相当于 typecheck 的部分（EditMode 测试。合格 = exit 0 且结果 XML 中 failed 0 — 禁止仅凭 exit code 判定）与相当于 build 的部分（ForgeBuild.BuildMac batchmode）',
    laneVerifyLine: '**此处不启动 Unity**（单实例锁 — 会与并行 lane、资产 lane 冲突。EditMode/构建验证在 lane 合流后的批量验证区间一次性执行 — tech-stack-unity.md「验证命令」节）。改为用 Read/Grep 静态确认所引用的类型、成员、资产键、序列化对象确实存在，不留下无法通过编译的引用',
    implRulesLine: '2) 按 tech-stack-unity.md 规范实现 game/Assets/Scripts（魔法数字集中到 GameConfig.cs / 必须使用 Time.deltaTime / Components 保持轻薄、逻辑放在 Systems/（pure C#、禁止 MonoBehaviour）/ Input System 集中 / 资产引用经由 AssetKeys）',
    reviewRulesLine: '代码规范违规（魔法数字、未使用 deltaTime、Components 臃肿、Systems/ 依赖 MonoBehaviour、路径硬编码。rules/unity-code.md）',
    codeAddExample: 'git add game/Assets game/Packages game/ProjectSettings state/stories.yaml state/reviews',
    configPath: 'game/Assets/Scripts/GameConfig.cs',
    audioFormatLine: '全部音频: ffmpeg loudnorm(-16 LUFS)＋静音裁剪 → 输出 OGG Vorbis 128-160kbps（Unity 原生支持。无需 M4A）。',
    qaTarget: '按 tech-stack-unity.md「QA-PLAY 的执行方法」，通过 batchmode 构建与 PlayMode 测试（模拟输入发送、LogAssert、ScreenCapture）对 game/ 进行实际游玩验证',
    playInstructions: 'open game/Build/ForgeGame.app（或在 Unity 编辑器中打开 game/ 并 Play）'
  },
  unreal: {
    techStackDoc: DOCS + '/tech-stack-unreal.md',
    manifestPath: 'game/_generated/MANIFEST.jsonl',
    rawAssetDir: 'game/_generated/',
    assets3d: true,
    verifyCmd: 'tech-stack-unreal.md「验证命令」中相当于 typecheck/build 的部分（BuildCookRun -build。执行测试时的合格 = exit 0 且报告 JSON 中 failed 0）',
    laneVerifyLine: '**此处不启动 UE/UBT**（单实例锁 — 会与并行 lane、资产 lane 冲突。BuildCookRun 验证在 lane 合流后的批量验证区间一次性执行 — tech-stack-unreal.md「验证命令」节）。改为用 Read/Grep 静态确认所引用的类型、成员、头文件 include 确实存在，不留下无法通过编译的引用',
    implRulesLine: '2) 按 tech-stack-unreal.md 规范实现 game/Source/ForgeGame（魔法数字集中到 GameConfig.h / 必须使用 DeltaSeconds / Actors 保持轻薄、逻辑放在 Systems/（pure C++、禁止 UObject）/ Enhanced Input 集中 / 资产路径经由 GameConfig.h 的常量。禁止 Blueprint 逻辑）',
    reviewRulesLine: '代码规范违规（魔法数字、未使用 DeltaSeconds、Actors 臃肿、Systems/ 依赖 UObject、路径硬编码、Blueprint 逻辑。rules/unreal-code.md）',
    codeAddExample: 'git add game/Source game/Config state/stories.yaml state/reviews',
    configPath: 'game/Source/ForgeGame/GameConfig.h',
    audioFormatLine: '全部音频: ffmpeg loudnorm(-16 LUFS)＋静音裁剪 → 输出 WAV（UE 原生支持。无需 OGG/M4A）。',
    qaTarget: '按 tech-stack-unreal.md「QA-PLAY 的执行方法」，通过 BuildCookRun 与 Automation RunTests（报告 JSON、截图）对 game/ 进行实际游玩验证',
    playInstructions: 'open game/Build/Mac/ForgeGame.app'
  }
};
const EP = ENGINE_PROFILES[engine];
if (!EP) throw new Error('args.engine 非法: ' + engine + '（contract §11: phaser|unity|unreal）');
const MANIFEST = EP.manifestPath;

const CODE_COMMIT_RULE =
  '提交规范: git add 仅限自己编辑的**单个文件路径**（禁止指定目录、禁止 git add -A — 会卷入共享同一 index 的并行 lane/资产轨道的 staged 变更与未提交 WIP）。' +
  'commit 必须使用指定路径形式 `git commit -m "<msg>" -- <自己编辑的文件...>`（防止卷入其他路径的 staged 变更。**同一文件内其他 lane 的 WIP 无法排除**，因此对共享文件 — config/types/stories.yaml — 的自己的追加内容，编辑后立即**仅该1个文件**单独提交以确定）。' +
  '提交 hash 不用 `git rev-parse HEAD`，而是从 `git log --format="%H %s" -20` 中取**与自己的提交消息一致的最上（最新）一行**的 hash，并用 `git show --stat <hash>` **确认其中包含自己编辑的文件**（rev-parse HEAD 可能拿到并行 lane 紧随其后的提交。窗口内无一致行则用 -50 重新获取。若不包含、或 commit 本身失败，不要返回旧的同名提交 hash，而要**诚实报告失败**）。' + GIT_RETRY_NOTE;
const ASSET_COMMIT_RULE =
  '提交规范: git add 仅限 ' + EP.rawAssetDir.replace(/\/$/, '') + ' design docs state/reviews 这些路径，**commit 也必须使用指定路径形式** `git commit -m "<msg>" -- ' + EP.rawAssetDir.replace(/\/$/, '') + ' design docs state/reviews`（禁止 git add -A、裸 git commit、整个 state 目录指定 — 不要卷走并行代码 lane 的 stories.yaml / active.md 的 WIP）。' + GIT_RETRY_NOTE;

// 防止 resume/重试导致的重复应用（adversarial M-8b）: 即使因缓存键失效而重新执行了已完成作业的
// 提示词，也不让其重复追加 config 常量、注记、MANIFEST 或重新提交
const IDEMPOTENT_RULE =
  '幂等守卫（resume 安全）: 本次委托可能因 resume/重试而被重新执行。开始作业前先确认 git log 的最近提交与对象文件，若**与本次委托指示的提交消息相同的提交**、或本次要追加的 config 常量、stories.yaml 注记、MANIFEST 行本身已存在，则不要对该部分重复追加、重新提交，在确认现状后仅做结果的结构化返回（或报告）。**仅因存在过去 iteration 的提交（实现提交等）不视为已完成** — 只有存在本次所指示作业本身的完成痕迹时才跳过。';

// 并行 lane 规范（retro-e2 方案A: 按 assignee lane 并行。仅代码编辑与 review agent 并行 —
// 伴随引擎启动的验证集中到 lane 合流后的批量验证区间（方案B）。tech-stack 文档「验证」节为权威来源）
const LANE_RULE =
  '并行 lane 规范: 不改写你的 assignee 负责范围以外的代码（gameplay-engineer=游戏机制、系统、持久化层 / ui-engineer=UI、场景显示层。边界见 docs/architecture.md）。' +
  '共享文件（' + EP.configPath + '、共享类型定义）**仅允许追加自身 story 所需的常量/类型**（禁止修改、删除既有行 — 会与并行 lane 冲突。例外: story 的 acceptance/指示明示的平衡调整，仅允许对目标常量**修改值**）。' +
  '不得不触碰其他 lane 负责范围的既有场景/接线文件时（例: 到达 Result 时的 persist 接线）**仅做精准 Edit、禁止整文件 Write、Edit 前必须重新 Read**（不要回滚并行 lane 已提交的变更）。' +
  'state/stories.yaml 仅对自身 story 的块内（status 行、注记）做精准 Edit（禁止整文件重写 — 会抹掉并行 lane 的更新）。' +
  '不要触碰 state/active.md（会与并行 lane 冲突 — 当前位置的更新是 lane 合流后串行区间的责任）。' +
  '若依赖其他 lane 的 story 将提供的 API，可按 docs/architecture.md 的设计写出调用来实现（编译一致性由 lane 合流后的批量验证做最终确认）。';

// ---------- 通用: 批量验证（lane 合流后的串行区间。retro-e2 方案B） ----------

const BATCH_VERIFY_SCHEMA = {
  type: 'object',
  required: ['ok'],
  properties: {
    ok: { type: 'boolean', description: '验证命令全套最终是否达到合格（exit 0。unity/unreal 含测试结果 failed 0）' },
    fixedNotes: { type: 'array', items: { type: 'string' }, description: '已修正问题的列表（附原因 story 归属）。没有则为空数组' },
    unresolved: { type: 'array', items: { type: 'string' }, description: '未能解决的问题。没有则为空数组' }
  }
};

async function batchVerify(phaseName, contextNote) {
  const bv = await agentR(
    '批量验证（串行区间 — 并行 lane 已合流。在此一次性执行引擎验证。engine=' + engine + '）。\n' +
    contextNote + '\n' +
    '步骤:\n' +
    '1) 执行 ' + EP.verifyCmd + '\n' +
    '2) 若有失败，根据错误的文件路径与 `git log --oneline -- <相关路径>` 定位原因 story（难以切分时按 lane 期间的 story 提交单位二分查找）\n' +
    '3) 以最小修正达到合格（不重做其他 story 的设计。调优值的修改仅限 ' + EP.configPath + '。**作为串行区间的例外，仅限批量验证的最小修正，可以编辑负责范围外的文件 — 含 ui 层**。**通过删除功能、移除调用、禁用来规避不是最小修正** — 在保持编译一致性的同时维持意图，若不得已改变了行为则在 fixedNotes 中明确写出。若修正原因是引擎/测试运行器引起的一般规律（环境陷阱），立即追加写入 tech-stack 文档的「已知陷阱」节（没有则新建 — gates.md QA-PLAY）。）\n' +
    '4) 若做了修正，在 state/reviews/batch-verify.md 追加写入「phase / 原因 story / 修正内容 / ISO8601 日时」（日时使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写），并按提交规范的指定路径形式 git commit（消息: "batch-verify fix (' + phaseName + ')"）。将 state/active.md 的当前位置更新为「' + phaseName + ' 批量验证完成」（串行区间 — 不受 lane 规范约束）。' + CODE_COMMIT_RULE + '\n' +
    IDEMPOTENT_RULE + '\n' +
    '结构化返回: ok（最终合格为 true。未能达到则诚实返回 false）/ fixedNotes / unresolved。',
    { label: 'batch-verify-' + phaseName.toLowerCase(), phase: phaseName, agentType: 'gameplay-engineer', schema: BATCH_VERIFY_SCHEMA, effort: 'medium' }
  );
  if (bv === null) {
    unresolvedFindings.push('[BLOCKER] ' + phaseName + ': 批量验证 agent 未返回结果（构建健全性未确认即继续 — 由后续 QA 检出）');
    return false;
  }
  // 修正内容要放到人类可见渠道（因为是未经 CR-CODE 的直接提交，仅靠 log() 会
  // 从 review-mode=full 的全部历史展示中漏掉 — adversarial H-3）
  for (const n of (bv.fixedNotes || [])) {
    unresolvedFindings.push(phaseName + '[batch-verify修正/未经 CR-CODE] ' + n);
  }
  for (const u of (bv.unresolved || [])) {
    unresolvedFindings.push('[BLOCKER] ' + phaseName + '[batch-verify] ' + u);
  }
  if (bv.ok !== true || (bv.unresolved || []).length > 0) {
    if (bv.ok !== true && (bv.unresolved || []).length === 0) {
      unresolvedFindings.push('[BLOCKER] ' + phaseName + ': 批量验证未达到合格（详情见 state/reviews/batch-verify.md）');
    }
    log('batch-verify(' + phaseName + '): 不合格或存在未解决项（上报）');
    return false;
  }
  log('batch-verify(' + phaseName + '): 合格');
  return true;
}

// ---------- 通用: story 实现 + CR-CODE 循环（review-loops.md: MAX_ITER 1、单一 reviewer） ----------

async function implementStoryWithReview(story, phaseName) {
  const sid = String(story.id || 's-unknown').toLowerCase();
  const assignee = ENGINEERS.indexOf(story.assignee) >= 0 ? story.assignee : 'gameplay-engineer';

  const impl = await agentR(
    laneContextWarn +
    '实现 story ' + story.id + '「' + story.title + '」。\n' +
    '需阅读: state/stories.yaml（相关 story）、design/gdd.md、design/concept.md（支柱 ' + (story.pillar || 'P-xx') + '）、docs/architecture.md、docs/conventions.md、' + EP.techStackDoc + '。\n' +
    '步骤:\n' +
    '1) 将 state/stories.yaml 的 ' + story.id + ' 更新为 status: in-progress\n' +
    EP.implRulesLine + '\n' +
    '3) ' + EP.laneVerifyLine + '\n' +
    '4) 将 ' + story.id + ' 更新为 status: review\n' +
    '5) git commit -m "' + story.id + ': ' + story.title + '"，并将该提交 hash 作为 commitHash 报告。' + CODE_COMMIT_RULE + '\n' +
    IDEMPOTENT_RULE + '\n' +
    LANE_RULE + '\n' +
    'acceptance: ' + story.acceptance,
    { label: 'impl-' + sid, phase: phaseName, agentType: assignee, schema: IMPL_SCHEMA, effort: 'medium' }
  );
  if (impl === null) {
    unresolvedFindings.push(story.id + ': 实现 agent 未返回结果（可能未实现）');
    return false;
  }
  let commitHash = impl.commitHash ? String(impl.commitHash) : null;

  let approved = false;
  for (let iter = 1; iter <= 1; iter++) {
    const reviewPrompt =
      'CR-CODE 评审（story ' + story.id + '、iteration ' + iter + '）。\n' +
      (commitHash
        ? '对象: **仅限** `git show ' + commitHash + '` 的 diff（并行的资产生成轨道的变更与其他 story 的差异不在评审范围内）。\n'
        : '对象: game/ 下与 story ' + story.id + ' 对应的最近实现变更（提交 hash 未知，因此从 state/reviews/' + sid + '.md 与实现文件定位对象）。\n') +
      '要点遵循 ' + DOCS + '/gates.md 的 CR-CODE 节。另外确认 ' + EP.techStackDoc + ' 的' + EP.reviewRulesLine + '。\n' +
      '同时确认 acceptance「' + story.acceptance + '」在代码层面是否得到满足。\n' +
      '前提（并行 lane 设计）: 对其他 lane 的 story 将提供的 API 的引用，只要符合 docs/architecture.md 的设计，就不要仅以「实体尚未实现」为理由判为 blocker（编译一致性由 lane 合流后的批量验证保证。与设计不一致、误用可照常指出）。**本次评审为只读 — 禁止启动引擎、执行构建/测试命令**（并行 lane 期间的单实例锁/dist 竞争）。\n' +
      '尤其要重点排查被无视的错误、被静默吞掉的失败路径、catch 后忽略的位置。\n' +
      'findings 需附 severity（blocker=设计缺陷 / major / minor）返回。0件则为空数组。';
    const review = await agentR(reviewPrompt, { label: 'cr-' + sid + '-' + iter, phase: phaseName, agentType: 'pr-review-toolkit:code-reviewer', schema: CODE_REVIEW_SCHEMA });
    if (!review) {
      // 评审失败 = 评审不成立。不把 findings 0件误认为 APPROVE（与 prototype.js 相同的守卫）
      unresolvedFindings.push(story.id + ': CR-CODE iteration ' + iter + ' 的评审 agent 失败（评审未实施 — 不自动 APPROVE）');
      verdictHistory.push({ gate: 'CR-CODE', artifact: sid, iteration: iter, verdict: 'CONCERNS', findings: ['评审 agent 失败（评审未实施）'] });
      log('CR-CODE ' + story.id + ' iteration ' + iter + ': 评审 agent 失败');
      continue;
    }
    const findings = review.findings || [];
    const hasBlocker = findings.some(function (f) { return f.severity === 'blocker'; });
    const verdict = findings.length === 0 ? 'APPROVE' : (hasBlocker ? 'REJECT' : 'CONCERNS');
    verdictHistory.push({
      gate: 'CR-CODE',
      artifact: sid,
      iteration: iter,
      verdict: verdict,
      findings: findings.map(function (f) { return '[' + f.severity + '] ' + f.summary; })
    });
    log('CR-CODE ' + story.id + ' iteration ' + iter + ': ' + verdict + '（findings ' + findings.length + '件）');

    if (verdict === 'APPROVE') {
      approved = true;
      const closed = await agentR(
        'story ' + story.id + ' 的 CR-CODE iteration ' + iter + ' 为 APPROVE（findings 0件）。执行后处理:\n' +
        '1) 将 state/stories.yaml 的 ' + story.id + ' 更新为 status: done\n' +
        '2) 在 state/reviews/' + sid + '.md 按 ' + DOCS + '/review-loops.md 的追加写入格式追加「CR-CODE iteration ' + iter + ' — APPROVE」（日时使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）\n' +
        '3) ' + CODE_COMMIT_RULE + '\n' +
        IDEMPOTENT_RULE + '\n' +
        LANE_RULE,
        { label: 'close-' + sid, phase: phaseName, agentType: assignee, effort: 'low' }
      );
      if (closed === null) {
        // 与 prototype.js 的 bookkeep 失败记录同型（状态文件＝事实的原则: 不静默放过未确认的更新）
        unresolvedFindings.push(story.id + ': APPROVE 后的 status:done 更新 agent 失败（stories.yaml 可能仍为 review）');
      }
      break;
    }

    const isLast = iter === 1;
    const fix = await agentR(
      'story ' + story.id + ' 的 CR-CODE iteration ' + iter + ' 判定: ' + verdict + '。findings(JSON):\n' + JSON.stringify(findings) + '\n' +
      '请处理:\n' +
      '1) 对每个 finding 要么修正处理，要么暂不处理并明确写出理由（禁止无视）\n' +
      '2) 修正后的验证: ' + EP.laneVerifyLine + '\n' +
      '3) 在 state/reviews/' + sid + '.md 按 ' + DOCS + '/review-loops.md 的追加写入格式追加 iteration 记录（verdict、问题摘要、已处理/暂不处理＋理由、ISO8601 日时。日时使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）\n' +
      '4) git commit -m "' + story.id + ': fix CR-CODE iteration ' + iter + '"，并将该提交 hash 作为 commitHash 报告。' + CODE_COMMIT_RULE + '\n' +
      IDEMPOTENT_RULE + '\n' +
      LANE_RULE + '\n' +
      (isLast
        ? '5) 因到达 MAX_ITER，将 state/stories.yaml 的 ' + story.id + ' 更新为 status: done，若有未处理的 finding 则留在注记中（上报会在 Checkpoint 展示给人类）'
        : '5) state/stories.yaml 的 status 保持 review（下一 iteration 重新评审）'),
      { label: 'fix-' + sid + '-' + iter, phase: phaseName, agentType: assignee, schema: IMPL_SCHEMA, effort: 'medium' }
    );
    if (fix && fix.commitHash) commitHash = String(fix.commitHash);
    if (fix === null) {
      // 与 prototype.js 的 reviewLoop（将 revise 失败记录到 loopFailures）同型: 不无记录地放过 fix 失败
      unresolvedFindings.push(story.id + ': CR-CODE iteration ' + iter + ' 的 fix agent 失败（问题未处理即' + (isLast ? '上报' : '进入重新评审') + '）');
    }

    if (isLast) {
      // blocker（设计缺陷＝相当于 REJECT）残留以 [BLOCKER] 前缀区分，由 CD-CHECKPOINT 在
      // 摘要开头单独警告（gates.md CD-CHECKPOINT 要点3。不与 minor 混在一起埋没）
      unresolvedFindings.push(
        (hasBlocker ? '[BLOCKER] ' : '') +
        story.id + ': CR-CODE 到达 MAX_ITER(1) 仍非 APPROVE。残留 findings: ' +
        findings.map(function (f) { return '[' + f.severity + '] ' + f.summary; }).join(' / ')
      );
    }
  }
  if (!approved) {
    // 状态文件＝事实（CLAUDE.md 绝对规范5）: 即使在评审 agent 失败等导致 fix agent 的 status 更新
    // （fix 提示词 step5）未运行的路径上，也不让 story 停留在 review/in-progress
    // （adversarial W-2）。附上上报注记予以确定（与 prototype.js 的 bookkeep 同型）
    await agentR(
      '确认 state/stories.yaml 的 ' + story.id + ' 的 status，若不是 done 则更新为 done，并\n' +
      '在 acceptance 行下方以注释添加「# note: CR-CODE unresolved — 参见 state/reviews/' + sid + '.md」的注记\n' +
      '（MAX_ITER 到达上报。若已是 done 且已有注记则什么都不做）。' + CODE_COMMIT_RULE + '\n' +
      IDEMPOTENT_RULE + '\n' + LANE_RULE,
      { label: 'bookkeep-' + sid, phase: phaseName, agentType: assignee, effort: 'low' }
    );
  }
  return approved;
}

// ---------- 通用: 资产批次生成 + AR-ASSET 循环（MAX 2 + fallback 1） ----------

async function assetBatchLoop(kind, producerAgent, producerBrief, replanStories) {
  const reviewFile = 'state/reviews/assets-' + kind + '.md';
  const budgetRule =
    'API 密钥: **仅限调用 API 的 Bash**在开头执行 `set -a; source .env 2>/dev/null; set +a` 后再 curl（验证、后处理 — ffmpeg/npx 等 — 的 Bash 中不要 source: 避免向第三方子进程继承密钥。禁止 echo、日志输出密钥值 — contract §10）。API 错误（401/403/429/5xx）不要静默吞掉，须连同 HTTP 状态一起报告。' +
    '预算规范（' + DOCS + '/assets-config.md）: 每次生成前将 ' + MANIFEST + ' 的 cost_usd 合计＋本次预计成本与 state/budget.txt 比较。' +
    '若预计超出则停止生成并以 budgetExceeded: true 报告（会在 Checkpoint 展示给人类）。路由以 state/asset-routing.json 为事实（禁止生成中重新判定。用 shippable:false 路由生成的资产必须在 notes 中报告）。' +
    '将全部生成以1行1资产追加到 ' + MANIFEST + '（provider/model/prompt/seed/cost_usd/plan_tier/sha256/license/generated_at。标注条款提供商 — Ideogram 标注条款 / Hunyuan3D Territory / ElevenLabs Studio Games 等 — 还必填 license_note（assets-config.md「Provenance」）。3D 资产还必填 kind/polycount/bone_count/rigged/format/units/bbox_authoring_m/validator。积分换算的估算用 cost_estimated:true）。' +
    '**Primary 发生 API 失败（4xx/5xx/timeout）时，禁止 fallback 1 段都不尝试就本地降级/占位符/must-replace 化**（因质量不合格的重新生成照旧固定 Primary — 本规则说的是 API 失败时的路由切换）。将 state/asset-routing.json 的 fallbacks 自上而下全段尝试，并将每次尝试的『路由名 + HTTP 状态（或失败原因）』必定列举到 degradedRoutes（例: "model_character: meshy:direct→422 / fal:meshy-v6→429 / tripo:direct→403 → local降级"）。仅在全段失败时才允许本地降级（retro-e3 问题7）。';
  const replanNote = (replanStories && replanStories.length > 0)
    ? '源自 Replan 的资产 story(JSON。应已反映到 design/assets.md。若条目遗漏，先追加到 design/assets.md 再纳入生成对象):\n' + JSON.stringify(replanStories)
    : '';

  let failedAssets = null; // null = 首次（全部未生成部分为对象）
  let lastVerdict = 'REJECT';

  for (let iter = 1; iter <= 3; iter++) {
    const isFallback = iter === 3;
    const target = failedAssets === null
      ? '对象: design/assets.md 中 ' + MANIFEST + ' 未记载的全部 ' + kind + ' 资产。' + (replanNote ? '\n' + replanNote : '')
      : '对象: 仅上次不合格的资产。failedAssets(JSON):\n' + JSON.stringify(failedAssets) + '\n按各 retryInstruction 重新生成。';
    const route = isFallback
      ? '【fallback 轮】因 AR-ASSET 2次不合格，切换到 state/asset-routing.json 的 fallback 提供商重新生成（参见 ' + DOCS + '/assets-config.md 的路由表）。'
      : '';

    const gen = await agentR(
      producerBrief + '\n' + target + '\n' + route + '\n' + budgetRule + '\n' + ASSET_COMMIT_RULE + '\n' +
      '全段实施生成后流水线（' + DOCS + '/assets-config.md「生成后流水线」节）后再报告。',
      { label: 'gen-' + kind + '-' + iter, phase: 'AssetGen', agentType: producerAgent, schema: ASSET_GEN_SCHEMA, effort: 'medium' }
    );
    if (gen === null) {
      unresolvedFindings.push('AssetGen(' + kind + '): 生成 agent 在 iteration ' + iter + ' 未返回结果');
      break;
    }
    // 披露事项的机械回收（与 budgetExceeded 无关始终收集 — 不让自由文本静默吞掉）
    for (const d of (gen.degradedRoutes || [])) {
      unresolvedFindings.push('AssetGen(' + kind + ')[降级] ' + d);
    }
    if (gen.notes && String(gen.notes).trim().length > 0) {
      unresolvedFindings.push('AssetGen(' + kind + ')[披露] ' + gen.notes);
    }
    if (gen.budgetExceeded) {
      unresolvedFindings.push('AssetGen(' + kind + '): 因预计超预算停止生成（未生成 ' + (typeof gen.remainingPlanned === 'number' ? gen.remainingPlanned : '不明') + ' 件。参见 state/budget.txt）');
      log('AssetGen(' + kind + '): 因预计超预算停止');
      break;
    }
    if (!gen.generated || gen.generated.length === 0) {
      if (failedAssets === null) {
        // 首次「生成 0 件」有 (a) 全部资产已生成 与 (b) API 全部失败 两种情况。用 remainingPlanned 区分
        if ((typeof gen.remainingPlanned === 'number' && gen.remainingPlanned > 0)) {
          unresolvedFindings.push('AssetGen(' + kind + '): 生成 0 件但仍残留 ' + gen.remainingPlanned + ' 件未生成对象（疑似 API 全部失败。notes: ' + (gen.notes || '无') + '）');
          lastVerdict = 'REJECT';
          break;
        }
        log('AssetGen(' + kind + '): 无生成对象（全部资产已生成 — 已确认 remainingPlanned 0）');
        lastVerdict = 'APPROVE';
        break;
      }
      // regen/fallback 轮生成 0 件 = 不合格资产仍未处理。不流向空列表的重新评审（=空洞的 APPROVE）（red-team 问题）
      unresolvedFindings.push('AssetGen(' + kind + '): iteration ' + iter + ' 的重新生成为 0 件（不合格的 ' + failedAssets.length + ' 件仍未处理而残留）');
      break;
    }

    const review = await agentR(
      'AR-ASSET 判定（' + kind + ' 批次、iteration ' + iter + '）。遵循 ' + DOCS + '/gates.md 的 AR-ASSET 节。\n' +
      '对象资产(JSON): ' + JSON.stringify(gen.generated || []) + '\n' +
      '核对对象: design/art-bible.json（style_block/palette/分辨率）、design/assets.md（尺寸/朝向/帧数）。\n' +
      '- 图像需打开实际文件，确认缩小到游戏内尺寸后的可辨识性与 Alpha 边缘质量\n' +
      '- 音频确认长度、响度、规格一致。BGM 需通过生成报告与文件确认已完成循环验证\n' +
      '- 3D（MDL/ANM）按 gates.md AR-ASSET 的 3D 要点机械检查（gltf validate / 多边形数、骨骼数 / authoring 尺度 / 风格用 ' + EP.rawAssetDir + 'previews/ 的渲染。引擎导入后的项目按※节由 Integrate 侧负责）\n' +
      '- 在 ' + reviewFile + ' 按 ' + DOCS + '/review-loops.md 的追加写入格式追加 iteration 记录（追加写入是作为判定者的你的责任。日时使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）\n' +
      '响应的第1行为「AR-ASSET: APPROVE|CONCERNS|REJECT」，结构化返回的 verdict 也填入相同判定。\n' +
      '不合格资产必须附 retryInstruction（提示词修改方案）。\n' +
      '**重新生成无法解决的披露事项**（gates.md AR-ASSET 要点6: 源自 shippable:false 路由 / 经 fal 的 Meshy 许可继承未验证 / cost_estimated:true / must_replace 等）放入 disclosures 而非 failedAssets（放入 failedAssets 会触发无意义的重新生成循环。质量合格＋有披露事项则为 APPROVE + disclosures）。',
      { label: 'ar-asset-' + kind + '-' + iter, phase: 'AssetGen', agentType: 'art-reviewer', schema: ASSET_REVIEW_SCHEMA }
    );
    if (review === null) {
      unresolvedFindings.push('AssetGen(' + kind + '): art-reviewer 在 iteration ' + iter + ' 未返回结果');
      break;
    }
    for (const d of (review.disclosures || [])) {
      unresolvedFindings.push('[AR-ASSET][' + kind + '][披露] ' + d);
    }
    lastVerdict = review.verdict;
    verdictHistory.push({
      gate: 'AR-ASSET',
      artifact: 'assets-' + kind,
      iteration: iter,
      verdict: review.verdict,
      findings: (review.failedAssets || []).map(function (f) { return f.file + '（' + f.reason + '）'; })
        .concat((review.disclosures || []).map(function (d) { return '[披露] ' + d; }))
    });
    log('AR-ASSET(' + kind + ') iteration ' + iter + ': ' + review.verdict + '（不合格 ' + (review.failedAssets || []).length + '件）');

    if (review.verdict === 'APPROVE') {
      lastVerdict = 'APPROVE';
      break;
    }
    if ((review.failedAssets || []).length === 0) {
      // 非 APPROVE 却 failedAssets 为空 = 批次整体问题（风格锁定违规等）或 reviewer 协议不一致。
      // 不转换为 APPROVE 放行（red-team 问题）— 因无法确定重新生成对象，以上报退出
      unresolvedFindings.push('AssetGen(' + kind + '): iteration ' + iter + ' 为 ' + review.verdict + ' 但 failedAssets 为空（可能是批次整体问题 — 需人类确认）');
      break;
    }
    failedAssets = review.failedAssets;
    if (isFallback) {
      unresolvedFindings.push(
        'AssetGen(' + kind + '): fallback 后仍有不合格资产: ' +
        failedAssets.map(function (f) { return f.file + '（' + f.reason + '）'; }).join(' / ')
      );
    }
  }
  return lastVerdict;
}

// ===== Phase: Replan =====
phase('Replan');
log('full-build 开始 / review-mode: ' + reviewMode + ' / feedback: ' + feedbackPath +
  '（全部 verdict 累积到 verdictHistory 后返回。full 模式下 skill 在完成后向人类全部展示）');

const replanResults = await parallel([
  () => agentR(
    'Phase 3 重新规划（tech-director）。\n' +
    '需阅读: ' + feedbackPath + '、state/stories.yaml、design/gdd.md、design/concept.md、design/assets.md、docs/architecture.md、' + DOCS + '/contract.md（§7 stories.yaml schema、§8 稳定ID）。\n' +
    '步骤:\n' +
    '1) 将 checkpoint-b-feedback 的各项落实为 story。新 story 的 ID 为既有最大 S-xx 的续号（禁止重编、删除），phase: build、status: todo、pillar 必须引用 design/concept.md 的 P-xx、assignee 为 contract §2 的 agent 名、acceptance 写成可验证的句子。平衡调整类 story 需**在 acceptance 中明示要修改的常量名**，同一常量不要分配给多个 story、多个 assignee（并行 lane 的共享文件规范 — 实现侧的改值例外以此明示为条件）。**资产 story（assignee 为 art-director / audio-designer）需在 title 开头加上资产类型标签 [IMG]/[SFX]/[BGM]/[MDL]/[ANM]（contract §8 的资产 ID 类型）**（workflow 据此机械分派到生成批次 — 无标签会落到 title/acceptance 的词汇推断，可能误配）\n' +
    '2) 涉及资产（图像/SFX/BGM/MDL/ANM）的 feedback 也要通过添加/修改条目反映到 design/assets.md（AssetGen 阶段以 design/assets.md 为生成对象的事实。assignee 为 art-director / audio-designer 的 story 也会作为生成对象列表传递。若需要**重新生成既有资产**，须将 design/assets.md 相应行的状态改为 must-replace 或 rejected — 对 MANIFEST 已记载资产的重新生成，此状态变更是唯一触发条件）\n' +
    '3) 与既有 phase: build 的未完成 story 合并，按依赖顺序（先需要的在前）整理并更新 state/stories.yaml\n' +
    '4) 更新 state/active.md（当前位置: Phase3 Replan 完成。日时使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）\n' +
    '返回: phase: build 且 status 不为 done 的全部 story（按应实现的顺序）。',
    { label: 'replan-stories', phase: 'Replan', agentType: 'tech-director', schema: STORY_LIST_SCHEMA, effort: 'medium' }
  ),
  () => agentR(
    'Phase 3 GDD 修订判断（game-designer）。\n' +
    '需阅读: ' + feedbackPath + '、design/gdd.md、design/concept.md。\n' +
    '仅当 checkpoint-b-feedback 要求变更游戏设计（数值、规则、流程）时，更新 design/gdd.md 的相关章节。\n' +
    '约束: 禁止添加、删除、变更支柱（P-xx）。在变更的章节注明源自 feedback。若无需变更则不改写任何内容，返回「无需变更」。',
    { label: 'replan-gdd', phase: 'Replan', agentType: 'game-designer' }
  )
]);

let replan = replanResults[0];
if (replanResults[1] === null || replanResults[1] === undefined) {
  // GDD 修订判断除 replanResults[1] 外不被引用 — 不让失败无记录（审计问题4）
  unresolvedFindings.push('Replan: GDD 修订判断 agent（game-designer）失败（feedback 可能未反映到 GDD）');
}
if (!replan || !Array.isArray(replan.stories)) {
  log('Replan: 未获得 tech-director 的结构化返回。从 stories.yaml 重新提取');
  replan = await agentR(
    '读取 state/stories.yaml，按应实现的顺序返回 phase: build 且 status 不为 done 的全部 story。不要修改文件。',
    { label: 'replan-extract', phase: 'Replan', agentType: 'tech-director', schema: STORY_LIST_SCHEMA, effort: 'low' }
  );
}
if (!replan || !Array.isArray(replan.stories)) {
  throw new Error('Replan 失败: 无法从 state/stories.yaml 获取 build story');
}

const codeStories = replan.stories.filter(function (s) { return ENGINEERS.indexOf(s.assignee) >= 0; });
// 将 art-director story 分派为 3D（MDL/ANM）与图像。第一判定是 Replan 提示词要求加在 title 开头的
// 资产类型标签（contract §8 的 ID 类型 — 测试机械验证与 contract 的同步: TODOS W-3）。
// 仅在标签缺失时 fallback 到 title/acceptance 的词汇推断
const artStories = replan.stories.filter(function (s) { return s.assignee === 'art-director'; });
// 大小写、全角括号（［］）经规范化后接受 — 不让 LLM 引起的标签写法差异绕过第一判定
const ASSET_TAG = /^\s*[\[［](MDL|ANM|IMG|SFX|BGM)[\]］]/i;
const assetTagOf = function (s) {
  const m = ASSET_TAG.exec(s.title || '');
  return m ? m[1].toUpperCase() : null;
};
// 词汇 fallback 忽略大小写，也捕获英文 token（fbx/glb/rig/mesh/model）（标签缺失时的下位判定）。
// fbx/glb 允许后缀（GLBs/FBXes — 与旧 substring 判定等价），rig/mesh/model 明确列举屈折形
// （单用 \b 会漏掉 rigged/meshes/models。裸前缀匹配会对 right 等产生误报，故不可）
const MODEL_WORDS = /MDL-|ANM-|3D|模型|网格|骨骼|\b(?:fbx|glb)\w*|\b(?:rig|rigged|rigging|mesh|meshes|model|models)\b/i;
const modelStories = artStories.filter(function (s) {
  const tag = assetTagOf(s);
  if (tag) return tag === 'MDL' || tag === 'ANM';
  // 2D 引擎不应用词汇 fallback — 「3D 风标志」等误报只会从 images 抢走资产、
  // 堆积伪 [BLOCKER] 而毫无益处。仅把显式标签（[MDL]/[ANM]）视为 3D
  if (!EP.assets3d) return false;
  return MODEL_WORDS.test((s.title || '') + ' ' + (s.acceptance || ''));
});
const imageStories = artStories.filter(function (s) { return modelStories.indexOf(s) < 0; });
const audioStories = replan.stories.filter(function (s) { return s.assignee === 'audio-designer'; });
if (!EP.assets3d && modelStories.length > 0) {
  // models 批次只在 3D 引擎下才会排入 — 不让 2D 引擎下被判为 3D 的 story 静默脱落
  unresolvedFindings.push('[BLOCKER] Replan: engine=' + engine + ' 不支持 3D 资产（MDL/ANM），却返回了 ' + modelStories.length + ' 件被判为 3D 的资产 story（从生成对象中脱落: ' + modelStories.map(function (s) { return s.id; }).join(', ') + ' — 需重新解读 design/assets.md 与 feedback）');
}
// 标签与 assignee 的交叉验证: 批次分派的第一键是 assignee（audio 固定为 audio-designer），
// 因此不一致的标签（art-director 的 [SFX] / audio-designer 的 [MDL] 等）会静默流入错误批次 — 记录并交给人类
for (const s of artStories.concat(audioStories)) {
  const t = assetTagOf(s);
  if (!t) continue;
  const wantAudio = t === 'SFX' || t === 'BGM';
  const isAudio = s.assignee === 'audio-designer';
  if (wantAudio !== isAudio) {
    unresolvedFindings.push('Replan: 资产 story ' + s.id + ' 的标签 [' + t + '] 与 assignee ' + s.assignee + ' 不一致（将在 assignee 侧的批次生成 — 需重新确认标签/负责人）');
  }
}
// lane 覆盖的残余漏洞（交叉验证只看 art/audio）: (a) 带资产标签的 story 被分配给 engineer 时，
// 会在代码 lane 被「实现」而不进入生成批次，(b) 不属于任何 lane 的
// assignee（拼写错误、非 lane agent）会绕过 codeStories/artStories/audioStories 的全部 filter
// 而完全脱落 — 两者都不静默放过而要记录
for (const s of replan.stories) {
  const t = assetTagOf(s);
  const isEngineer = ENGINEERS.indexOf(s.assignee) >= 0;
  const isAssetLane = s.assignee === 'art-director' || s.assignee === 'audio-designer';
  if (!isEngineer && !isAssetLane) {
    unresolvedFindings.push('[BLOCKER] Replan: story ' + s.id + ' 的 assignee「' + s.assignee + '」不属于任何实现/生成 lane，从所有 lane 中脱落（既不会实现也不会生成 — 需修正 assignee）');
  } else if (t && isEngineer) {
    unresolvedFindings.push('Replan: 带资产标签 [' + t + '] 的 story ' + s.id + ' 被分配给 engineer（' + s.assignee + '）而进入代码 lane（不会进入生成批次 — 需重新确认 assignee/标签）');
  }
}
log('Replan 完成: build story ' + replan.stories.length + '件（其中代码 ' + codeStories.length + '件 / 图像 ' + imageStories.length + '件 / 3D ' + modelStories.length + '件 / 音频 ' + audioStories.length + '件）');

// ===== Phase: Build ∥ AssetGen =====
// 阶段切换标记不在 thunk 内调用（并行时会交错）。分组通过 agent opts 的 phase 标签进行。
const assetGenThunks = [
  laneSafe('AssetGen(images) 轨道', () => assetBatchLoop(
    'images', 'art-director',
    '图像资产的批量生成（art-director）。需阅读: design/assets.md、design/art-bible.json、state/asset-routing.json、' + DOCS + '/assets-config.md、' + MANIFEST + '、state/budget.txt。\n' +
    '严格遵守风格一致性协议: 所有提示词机械地前置 art-bible.json 的 style_block，记录 seed，hero 共用 character_reference。' +
    '精灵图全数机械验证 Alpha 通道（禁止发布白背景 PNG）。' + (EP.assets3d ? '（3D 引擎无需 atlas 化。仅用于 UI、贴图用途）' : '实施至 atlas 化。'),
    imageStories
  )),
  laneSafe('AssetGen(audio) 轨道', () => assetBatchLoop(
    'audio', 'audio-designer',
    '音频资产的批量生成（audio-designer）。需阅读: design/assets.md、design/art-bible.md（音调参考）、state/asset-routing.json、' + DOCS + '/assets-config.md、' + MANIFEST + '、state/budget.txt。\n' +
    'SFX: ElevenLabs SFX v2 直接 REST（明示 duration_seconds。禁止经官方 MCP）。用通用词汇生成4个变体→选出最佳。\n' +
    'BGM: Eleven Music REST（model music_v2、用 composition_plan 指定段落长度、force_instrumental: true、记录 seed）。' +
    '**必须循环验证**: 拼接2次扫描接缝的爆音/RMS 阶跃，失败则重新生成。合格前不在 MANIFEST 中记录为可发布。\n' +
    EP.audioFormatLine,
    audioStories
  ))
];
if (EP.assets3d) {
  assetGenThunks.push(laneSafe('AssetGen(models) 轨道', () => assetBatchLoop(
    'models', 'art-director',
    '3D 模型/动画资产（MDL/ANM）的批量生成（art-director）。需阅读: design/assets.md（3D 模型/动画节）、design/art-bible.json（3D 风格方针、概念图）、state/asset-routing.json（model_* / anim 路由。Primary: Meshy 直接 API（密钥有效时）→ 第二候选: 经 fal 的 fal-ai/meshy/*。Meshy 直接 API 的 rigging/animation 返回 403 时，仅该资产类型切换到经 fal 并必须报告）、' + DOCS + '/assets-config.md（3D 路由表、生成后流水线 3D 节）、' + MANIFEST + '、state/budget.txt。\n' +
    '风格一致性: 将概念图（reference_images / character_reference）用作 image-to-3D 的输入。带 rig 的用 FBX / 静态的用 GLB。\n' +
    '实施生成后流水线中**不启动 Unity/UE 的各段**: schema 验证（GLB: gltf-transform validate / FBX: 用 Blender headless 转换为 GLB 后做同样的 validate）→ 多边形数/骨骼数/非流形检查 → authoring-time 尺寸测量记录到 MANIFEST 的 bbox_authoring_m → 用 Blender headless 渲染将预览图输出到 ' + EP.rawAssetDir + 'previews/。**不进行引擎导入**（引擎为单实例锁，导入、导入后包围盒再验证由 engineer 在 Polish 前的串行区间实施 — 参见 tech-stack 文档）。\n' +
    '无密钥降级（Blender 程序化+Rigify / 引擎内基元）时全部以 must_replace: true 记录。\n' +
    '对象还包括 design/assets.md 中状态为 must-replace / rejected 的既有 MDL/ANM（Replan 指定重新生成的资产）（即使 MANIFEST 已记载，只要状态如此就是重新生成对象）。',
    modelStories // 源自 Replan 的 3D 资产 story（ASSET_TAG 第一、MODEL_WORDS fallback 判定）+ design/assets.md 的状态变更为对象选定的事实
  )));
}
// assignee lane 拆分（retro-e2 方案A）: gameplay 与 ui 并行，lane 内维持依赖顺序（Replan 的返回顺序）。
// assignee 不明/非法与 implementStoryWithReview 侧的默认（gameplay-engineer）一致，进入 gameplay lane
const gameplayStories = codeStories.filter(function (s) { return s.assignee !== 'ui-engineer'; });
const uiStories = codeStories.filter(function (s) { return s.assignee === 'ui-engineer'; });
await parallel([
  // --- Build: assignee 2 lane 并行（lane 内顺序执行 + CR-CODE 循环。lane 期间无引擎验证 — 合流后 batchVerify） ---
  laneSafe('Build gameplay lane', async () => {
    for (const story of gameplayStories) {
      await implementStoryWithReview(story, 'Build');
    }
    log('Build gameplay lane 完成: 已处理 ' + gameplayStories.length + ' 个 story');
  }),
  laneSafe('Build ui lane', async () => {
    for (const story of uiStories) {
      await implementStoryWithReview(story, 'Build');
    }
    log('Build ui lane 完成: 已处理 ' + uiStories.length + ' 个 story');
  }),
  // --- AssetGen: 图像与音频（+3D 模型）并行，各自 AR-ASSET 循环 + 预算检查 ---
  laneSafe('AssetGen 轨道（含批次一致性检查）', async () => {
    await parallel(assetGenThunks);

    // 全部资产生成后: 批次一致性检查（style drift 检测）
    for (let pass = 1; pass <= 2; pass++) {
      const drift = await agentR(
        'AR-ASSET 批次一致性检查（style drift 检测、pass ' + pass + '）。\n' +
        '将 ' + EP.rawAssetDir + ' 的全部图像资产' + (EP.assets3d ? '与 3D 模型的渲染预览' : '') + ' 按 ' + MANIFEST + ' 的生成顺序排列，对照 design/art-bible.json（palette/style_block）检测随时间的调色板偏离、画风漂移、轮廓可辨识性的劣化。' +
        '判定要点见 ' + DOCS + '/gates.md 的 AR-ASSET 节。在 state/reviews/assets-batch.md 追加写入记录（追加写入是作为判定者的你的责任。日时使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）。\n' +
        '响应的第1行为「AR-ASSET: APPROVE|CONCERNS|REJECT」，结构化返回的 verdict 也填入相同判定。\n' +
        '对发生 drift 的资产附上 retryInstruction。',
        { label: 'ar-batch-drift-' + pass, phase: 'AssetGen', agentType: 'art-reviewer', schema: ASSET_REVIEW_SCHEMA }
      );
      if (!drift) {
        unresolvedFindings.push('AssetGen: 批次一致性检查未返回结果（pass ' + pass + '）');
        break;
      }
      verdictHistory.push({
        gate: 'AR-ASSET',
        artifact: 'assets-batch',
        iteration: pass,
        verdict: drift.verdict,
        findings: (drift.failedAssets || []).map(function (f) { return f.file + '（' + f.reason + '）'; })
      });
      log('AR-ASSET batch drift pass ' + pass + ': ' + drift.verdict + '（对象 ' + (drift.failedAssets || []).length + '件）');
      if (drift.verdict === 'APPROVE') break;
      if ((drift.failedAssets || []).length === 0) {
        // 与 assetBatchLoop 的同一情况同型: 不无记录地以非 APPROVE + failedAssets 为空退出
        unresolvedFindings.push('AssetGen: 批次一致性检查 pass ' + pass + ' 为 ' + drift.verdict + ' 但 failedAssets 为空（可能是批次整体问题 — 需人类确认）');
        break;
      }
      if (pass === 2) {
        unresolvedFindings.push(
          'AssetGen: style drift 在重新生成后仍残留: ' +
          drift.failedAssets.map(function (f) { return f.file; }).join(', ')
        );
        break;
      }
      const regen = await agentR(
        '重新生成被指出 style drift 的资产（art-director）。failedAssets(JSON):\n' + JSON.stringify(drift.failedAssets) + '\n' +
        '严格贴近 design/art-bible.json 的 style_block/palette，按 retryInstruction 重新生成。state/asset-routing.json 的路由、预算检查（MANIFEST 合计 vs state/budget.txt）、MANIFEST 追加照常。\n' +
        ASSET_COMMIT_RULE,
        { label: 'regen-drift', phase: 'AssetGen', agentType: 'art-director', schema: ASSET_GEN_SCHEMA, effort: 'medium' }
      );
      if (!regen || regen.budgetExceeded) {
        unresolvedFindings.push('AssetGen: drift 重新生成未完成（超预算或失败）');
        break;
      }
    }
  })
]);

// ===== 批量验证（Build lane 合流后的串行区间 — retro-e2 方案B。引擎启动从此处开始串行） =====
let buildVerifyOk = true;
if (codeStories.length > 0) {
  buildVerifyOk = await batchVerify('Build',
    '到此为止 Build lane（gameplay ' + gameplayStories.length + '件 / ui ' + uiStories.length + '件）已并行实现代码 story，' +
    'lane 期间未执行引擎验证（' + EP.techStackDoc + '「验证」节的验证批处理化）。请一次性验证、修正全部 story 的已提交代码。');
}
// 用于向后续提示词注入警告（与 integrate3d 的降级注入相同模式 — 评审问题 F3）
const BUILD_VERIFY_WARN = buildVerifyOk ? '' : '【警告: Build 批量验证仍未合格 — 参见 state/reviews/batch-verify.md。请以构建已损坏为前提作业】\n';

// ===== 3D 资产的引擎导入（串行区间。引擎为单实例锁 — tech-stack 文档） =====
let integrate3d = null; // 因 FullQA 要把降级报告注入 QA 提示词，保留在函数作用域外
if (EP.assets3d) {
  const INTEGRATE_SCHEMA = {
    type: 'object',
    required: ['ok', 'degradations'],
    properties: {
      ok: { type: 'boolean', description: '引擎导入后验证（gates.md AR-ASSET ※节）是否全部合格' },
      degradations: { type: 'array', items: { type: 'string' }, description: '降级、警告的列表（Humanoid→Generic 降级、尺度修正、导入警告等）。没有则为空数组' },
      summary: { type: 'string' },
    },
  };
  integrate3d = await agentR(
    BUILD_VERIFY_WARN +
    '将已生成的 3D 资产（MDL/ANM）导入 game/（engine: ' + engine + '。串行区间 — 没有其他启动 Unity/UE 的处理在运行）。\n' +
    '需阅读: ' + MANIFEST + '（本次追加部分）、design/assets.md、' + EP.techStackDoc + '「资产处理」、' + DOCS + '/gates.md 的 AR-ASSET ※节（引擎导入后验证是你的责任）。\n' +
    (engine === 'unity'
      ? '步骤: 将 ' + EP.rawAssetDir + ' 的合格资产复制到 game/Assets/Resources/Generated/{models,textures,audio}/ 并让 Unity 导入（Resources.Load 方式 — contract §11 / tech-stack-unity.md「资产处理」。AssetKeys 的值为 Resources 相对路径），带 rig 的 FBX 设置 ModelImporter 的 animationType 并确认 Avatar 生成（机械确认 Avatar.isValid。失败则降级为 Generic 并必须包含在 degradations 中）。用导入后包围盒验证尺度。将占位符替换为实际资产，并登记到资产常量（' + EP.configPath + '）。\n'
      : '步骤: 用 Interchange（Python: unreal.InterchangeManager）将 ' + EP.rawAssetDir + ' 的合格资产导入 game/Content/Generated/，带 rig 的确认重定向成功（失败必须包含在 degradations 中）。用导入后包围盒验证尺度（1 unit = 1cm）。登记到资产常量（' + EP.configPath + '）。\n') +
    '验证结果也记录到 ' + MANIFEST + ' 的 validator。验证: ' + EP.verifyCmd + ' 为 exit 0。\n' +
    '提交规范（导入专用）: 仅明示触碰过的路径进行 git add（' + (engine === 'unity' ? '例: git add game/Assets game/_generated state' : '例: git add game/Content game/_generated game/Source game/Config state') + '。禁止 git add -A — 不要漏掉 MANIFEST 的 validator 追加与导入资产）。' + GIT_RETRY_NOTE + '\n' +
    IDEMPOTENT_RULE + '\n' +
    '结构化返回: ok / degradations / summary。',
    { label: 'integrate-3d-assets', phase: 'AssetGen', agentType: 'gameplay-engineer', effort: 'medium', schema: INTEGRATE_SCHEMA }
  );
  if (integrate3d === null) {
    unresolvedFindings.push('AssetGen(3D): 引擎导入 agent 未返回结果（可能未导入）');
  } else {
    for (const d of (integrate3d.degradations || [])) {
      unresolvedFindings.push('AssetGen(3D)[Integrate] ' + d);
    }
    if (integrate3d.ok === false) {
      unresolvedFindings.push('AssetGen(3D)[Integrate] 引擎导入后验证不合格（详情见 degradations 与 ' + MANIFEST + ' 的 validator）');
    }
  }
}

// ===== Phase: Polish =====
phase('Polish');
const polishPlan = await agentR(
  BUILD_VERIFY_WARN +
  'Phase 3 Polish 计划（game-designer）。\n' +
  '需阅读: ' + EP.configPath + '、design/gdd.md（数值的初始值＋调整范围）、design/concept.md（支柱 P-xx）、' + feedbackPath + '、state/stories.yaml、' + DOCS + '/contract.md（§7 schema、§8 ID、§11 引擎）。\n' +
  '步骤:\n' +
  '1) 平衡确认: 对照 gdd 的意图、范围与已实现的游戏检查 ' + EP.configPath + ' 的当前值。调整须是**仅**通过修改 ' + EP.configPath + ' 的值即可完成的具体指定（常量名→新值与理由）\n' +
  '2) 起草 juice/手感 polish story: 屏幕震动、打击停顿、声音反馈、tween/缓动等。**仅限对支柱 P-xx 有贡献者**（以 story 的 pillar 明示贡献）。每个 story 需有可通过实际操作验证的 acceptance\n' +
  '3) 以续号 ID 添加到 state/stories.yaml（phase: build、status: todo、assignee 为 gameplay-engineer / ui-engineer）。平衡调整 story 需**在 acceptance 中明示要修改的常量名**，同一常量不要分配给多个 story、多个 assignee（避免并行 lane 的共享文件竞争 — 实现侧 LANE_RULE 的改值例外以此明示为条件）\n' +
  '返回: 添加的 polish story 列表（按应实现的顺序。平衡调整也 story 化并包含在内）。',
  { label: 'polish-plan', phase: 'Polish', agentType: 'game-designer', schema: STORY_LIST_SCHEMA, effort: 'medium' }
);

const polishAll = (polishPlan && Array.isArray(polishPlan.stories) ? polishPlan.stories : []);
const polishStories = polishAll.filter(function (s) { return ENGINEERS.indexOf(s.assignee) >= 0; });
const polishDropped = polishAll.filter(function (s) { return ENGINEERS.indexOf(s.assignee) < 0; });
if (polishDropped.length > 0) {
  // engineer 以外的 assignee（资产类、非 lane agent、拼写错误）的 polish story 不属于本阶段的
  // 实现对象 — 不静默丢弃，明示实际的 assignee 并记录（若断定为「资产类」，
  // 会把拼写错误的代码 story 误导向资产路径的恢复）
  unresolvedFindings.push('Polish: story ' + polishDropped.map(function (s) { return s.id + '（assignee: ' + s.assignee + '）'; }).join(', ') + ' 不属于 Polish 阶段的实现对象（若为资产类 assignee，正途是修改 design/assets.md 的状态（must-replace/rejected）→ 经 Replan；若为 engineer 拼写错误等则需修正 assignee — 人类确认）');
}
if (polishPlan === null) {
  unresolvedFindings.push('Polish: game-designer 未返回计划（polish 未实施）');
}
log('实现 Polish story ' + polishStories.length + '件（assignee lane 并行）');
// 在 Build 批量验证不合格的情况下进入 Polish 时，也把警告送达 lane 实现 agent（adversarial L-11 —
// 防止「其他 lane WIP 引起的错误可以忽略」的指示掩盖既有损坏）
laneContextWarn = BUILD_VERIFY_WARN;
const polishGameplay = polishStories.filter(function (s) { return s.assignee !== 'ui-engineer'; });
const polishUi = polishStories.filter(function (s) { return s.assignee === 'ui-engineer'; });
await parallel([
  laneSafe('Polish gameplay lane', async () => {
    for (const story of polishGameplay) {
      await implementStoryWithReview(story, 'Polish');
    }
  }),
  laneSafe('Polish ui lane', async () => {
    for (const story of polishUi) {
      await implementStoryWithReview(story, 'Polish');
    }
  })
]);
// Polish lane 合流后的批量验证（避免其后的 FullQA 成为首次引擎启动）
let polishVerifyOk = true;
if (polishStories.length > 0) {
  polishVerifyOk = await batchVerify('Polish',
    '到此为止 Polish lane（gameplay ' + polishGameplay.length + '件 / ui ' + polishUi.length + '件）已并行实现 polish story，' +
    'lane 期间未执行引擎验证。请一次性验证、修正全部 polish story 的已提交代码。');
}
const QA_VERIFY_WARN = (buildVerifyOk && polishVerifyOk) ? '' :
  '【警告: 批量验证（' + (!buildVerifyOk ? 'Build' : '') + (!buildVerifyOk && !polishVerifyOk ? '、' : '') + (!polishVerifyOk ? 'Polish' : '') + '）仍未合格 — 请先阅读 state/reviews/batch-verify.md 的诊断再做 QA】\n';

// ===== Phase: FullQA =====
phase('FullQA');
let audit = null;
let qaVerdict = null;
let qaBugs = [];
let qaFailedAcceptance = [];
let qaSummary = '';

await parallel([
  // 资产审计（MANIFEST 成本合计、预算比较、许可标记提取）
  // 写入目标为 state/reviews/assets-audit.md（qa/report.md 由并行的 QA-PLAY 的 qa-lead 记录专用）
  laneSafe('FullQA 资产审计轨道', async () => {
    audit = await agentR(
      '资产审计（qa-lead）。需阅读: ' + MANIFEST + '、state/budget.txt、' + DOCS + '/assets-config.md（「硬性禁止事项」「在 Checkpoint 向人类展示的许可标记」节）。\n' +
      '1) 合计 MANIFEST 的 cost_usd 作为 totalAssetCost，与作为 budgetUsd 的 state/budget.txt 比较（overBudget）\n' +
      '2) 许可标记提取: 除 assets-config.md 的展示项目（ElevenLabs Studio Games 条款 / Ideogram AI 生成标注条款 / 纯 AI 输出的著作权不确定性与有无人类参与记录）外，列举 MANIFEST 内 license 非 commercial-ok、must_replace: true、placeholder-nc 的残留。源自标注条款提供商（Ideogram/Hunyuan3D/ElevenLabs 等 — assets-config.md「Provenance」）的行中 license_note 缺失者列入 provenanceGaps\n' +
      '3) 对精灵图中混入白背景 PNG 做**全数**机械检查（对 MANIFEST 记载的全部图像资产用 ImageMagick/Pillow 检查有无 Alpha 通道与不透明背景。不是抽样而是全数 — 检查很轻量。违规者作为相当于 mustReplaceAssets 的项目包含在标记中）\n' +
      '3b) 列举 3D 资产（MDL/ANM）的 MANIFEST 必填字段（plan_tier / bbox_authoring_m / validator / license）记录缺失，以及源自 shippable:false 路由、cost_estimated:true 的资产（放入结构化返回的 provenanceGaps）\n' +
      '将结果追加写入 state/reviews/assets-audit.md（不写入 qa/report.md — 因为它由并行的 QA-PLAY 的记录专用。日时使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）。',
      { label: 'asset-audit', phase: 'FullQA', agentType: 'qa-lead', schema: AUDIT_SCHEMA }
    );
    if (audit === null) {
      unresolvedFindings.push('FullQA: 资产审计未返回结果（成本/许可未确认）');
    } else if (audit.overBudget) {
      unresolvedFindings.push('FullQA: 资产成本超出预算（$' + audit.totalAssetCost + ' / 预算 $' + audit.budgetUsd + '）');
    }
    if (audit && Array.isArray(audit.mustReplaceAssets) && audit.mustReplaceAssets.length > 0) {
      unresolvedFindings.push('FullQA: must_replace 资产残留: ' + audit.mustReplaceAssets.join(', '));
    }
    if (audit && Array.isArray(audit.provenanceGaps) && audit.provenanceGaps.length > 0) {
      for (const g of audit.provenanceGaps) {
        unresolvedFindings.push('FullQA[provenance] ' + g);
      }
    }
  }),
  // QA-PLAY（review-loops.md: MAX_ITER 1 = QA→非 APPROVE 则上报，不再二次复核）
  laneSafe('FullQA QA-PLAY 轨道', async () => {
    for (let round = 1; round <= 1; round++) {
      const qa = await agentR(
        QA_VERIFY_WARN +
        '完整QA（qa-lead、round ' + round + '/1）。遵循 ' + DOCS + '/gates.md 的 QA-PLAY 节（engine=' + engine + ' 的执行手段），' + EP.qaTarget + '。\n' +
        (integrate3d && (integrate3d.degradations || []).length > 0
          ? '【有来自 Integrate 的降级报告 — 相关位置需重点验证（尤其 rig 降级时必须目视确认动画播放）】: ' + integrate3d.degradations.join(' / ') + '\n'
          : '') +
        '范围: 对 state/stories.yaml 的**全部 story**（phase: prototype / build 两者）的 acceptance 逐一以实际操作回归验证。\n' +
        '另外: build 成功且 console 错误 0 / 核心循环1周（开始→挑战→结果→重新开始）/ 必需场景切换 Title→Menu→Game→Result→Menu 的1周（contract §11。含 Menu 的必需要素 = 开始游玩、游戏外显示、设置、退出导线 的实际存在。设置的实效性 — 音量变更对实际输出的反映与持久化 — 也要验证 — gates.md QA-PLAY 要点2。拍摄 Title/Menu/Game/Result 各画面的截图（Game 不可用开始瞬间的空盘面 — 在核心循环的主要对象出现的帧拍摄。gates.md 视觉证据））/ 元进度的持久化（gates.md 要点5: 保存→相当于重启→恢复一致，损坏存档→.bak 备份保存＋[SaveCorruption] 显式错误1次＋默认值恢复）/ 实际游玩感是否背离 design/concept.md 的支柱 P-xx。\n' +
        '视觉证据的机械检测＋目视（gates.md 视觉证据的目视义务）: 对全部截图做 magick 的 mean 检查（<0.02 / >0.98 = SUSPECT_BLANK → 切换拍摄方式重新拍摄）与主要 UI 文本的低对比度检查（crop + stddev < 0.05 = SUSPECT_LOW_CONTRAST → 以目视判定可读性 — gates.md 视觉证据），并务必用 Read 目视，将「画面中有什么」记录到 qa/report.md 的目视所见表。\n' +
        '将证据保存到 qa/evidence/，将结果写入 qa/report.md（作为 round ' + round + ' 追加）。在 state/reviews/qa.md 追加写入 iteration 记录（追加写入是作为判定者的你的责任。日时使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）。\n' +
        '响应的第1行为「QA-PLAY: APPROVE|CONCERNS|REJECT」，结构化返回的 verdict 也填入相同判定。\n' +
        'bug 需附 severity（blocker/major/minor）与负责人（gameplay-engineer/ui-engineer）返回。failedAcceptance 中放入全部不合格的 story ID，非 APPROVE 时在 summary 中写明判定理由。evidencePaths 放入已保存的证据路径，screenshotsVisuallyConfirmed 放入是否实施了目视（未实施则诚实填 false）。\n' +
        '判定: 仅当重大 bug 为 0 且 acceptance 全部通过时才 APPROVE。',
        { label: 'qa-play-' + round, phase: 'FullQA', agentType: 'qa-lead', schema: QA_SCHEMA, effort: 'medium' }
      );
      if (qa === null) {
        unresolvedFindings.push('FullQA: qa-lead 在 round ' + round + ' 未返回结果');
        break;
      }

      // 证据实际存在＋目视声明的独立机械验证（workflow 用另一 agent 确认 qa-lead 的自我申报）
      {
        const evCheck = await agentR(
          [
            '只读的验证任务。对以下证据路径列表，用 Bash（`test -s`、`stat`）机械验证各文件实际存在且大小非0。禁止创建、修改、删除文件。',
            '证据路径(JSON): ' + JSON.stringify(qa.evidencePaths || []),
            '另外用 ls 确认 qa/evidence/ 直下的实际文件列表并返回到 extraFilesInEvidenceDir。',
          ].join('\n'),
          { label: 'verify-evidence-' + round, phase: 'FullQA', effort: 'low', schema: EVIDENCE_CHECK_SCHEMA }
        );
        const missing = [];
        if (!evCheck) {
          missing.push('证据验证 agent 未返回结果');
        } else {
          // 完备性核对: 要求 evidencePaths 的每个路径都以 exists && nonEmpty 出现在 checks 中
          // （防止验证 agent 返回 checks:[] 或部分回答时伪装合格）
          const byPath = {};
          for (const c of (evCheck.checks || [])) byPath[c.path] = c;
          for (const p of (qa.evidencePaths || [])) {
            const c = byPath[p];
            if (!c) missing.push(p + '（未出现在验证结果中 — 未验证）');
            else if (!c.exists || !c.nonEmpty) missing.push(p + '（' + (!c.exists ? '不存在' : '0字节') + '）');
          }
        }
        if ((qa.evidencePaths || []).length === 0) missing.push('evidencePaths 为空（无证据的判定无效 — qa-lead.md）');
        if (qa.screenshotsVisuallyConfirmed !== true) missing.push('截图的 Read 目视未实施（screenshotsVisuallyConfirmed=false）');
        if (missing.length > 0) {
          if (qa.verdict === 'APPROVE') {
            qa.verdict = 'CONCERNS';
            log('FullQA round ' + round + ': 证据/目视的机械验证不合格 → 将 APPROVE 降为 CONCERNS');
          }
          unresolvedFindings.push('FullQA round ' + round + ' 证据/目视的机械验证不合格: ' + missing.join(' / '));
        }
      }

      qaVerdict = qa.verdict;
      qaBugs = qa.bugs || [];
      qaFailedAcceptance = Array.isArray(qa.failedAcceptance) ? qa.failedAcceptance : [];
      qaSummary = qa.summary || '';
      verdictHistory.push({
        gate: 'QA-PLAY',
        artifact: 'qa',
        iteration: round,
        verdict: qa.verdict,
        findings: qaBugs.map(function (b) { return '[' + b.severity + '] ' + b.summary; })
          .concat(qaFailedAcceptance.map(function (id) { return 'acceptance 不合格: ' + id; }))
      });
      log('QA-PLAY round ' + round + ': ' + qa.verdict + '（bug ' + qaBugs.length + '件 / acceptance 不合格 ' + qaFailedAcceptance.length + '件）');
      if (qa.verdict === 'APPROVE') break; // 合格仅限 verdict === APPROVE（禁止按 bug 数量的合格捷径）

      // MAX_ITER 1: 仅 1 次 QA-PLAY，非 APPROVE 时仍尝试修正一次（不做第2次复核以节省 token）。
      // 修正按代码规范顺序执行（避免同一文件竞争）
      const order = ['gameplay-engineer', 'ui-engineer'];
      for (const eng of order) {
        const mine = qaBugs.filter(function (b) { return (b.assignee || 'gameplay-engineer') === eng; });
        const myAcceptance = qaFailedAcceptance;
        if (mine.length === 0 && myAcceptance.length === 0) continue;
        const qaFix = await agentR(
          '修正 QA-PLAY round ' + round + ' 检出的问题（QA-PLAY 为 review 1次上限，修正后不再重新判定 — 结果将直接上报给人类）。\n' +
          'bugs(JSON):\n' + JSON.stringify(mine) + '\n' +
          '不合格 acceptance(story ID): ' + JSON.stringify(myAcceptance) + '（仅处理自己负责的部分。不触碰负责范围外）\n' +
          '参考: qa/report.md（复现步骤、证据）、state/stories.yaml（相关 acceptance）、' + EP.techStackDoc + '（规范: 调优仅在 ' + EP.configPath + ' 中进行）。\n' +
          '修正后使 ' + EP.verifyCmd + ' 为 exit 0，并将修正内容追加到 qa/report.md 的相应 bug。若修正原因是引擎/测试运行器引起的一般规律（环境陷阱），立即追加写入 tech-stack 文档的「已知陷阱」节（没有则新建 — gates.md QA-PLAY）。\n' +
          '执行 git commit -m "QA-PLAY round ' + round + ' fix (' + eng + ')"。' + CODE_COMMIT_RULE + '\n' +
          IDEMPOTENT_RULE,
          { label: 'qa-fix-' + round + '-' + eng, phase: 'FullQA', agentType: eng, effort: 'medium' }
        );
        if (qaFix === null) {
          // 与 prototype.js 的 QA fix 失败记录同型（审计问题5: 不无记录地把修正失败流向重新 QA）
          unresolvedFindings.push('FullQA: round ' + round + ' 的修正 agent（' + eng + '）失败（负责的 bug/acceptance 未修正即进入重新 QA）');
        }
      }
    }
    if (qaVerdict !== 'APPROVE') {
      unresolvedFindings.push(
        // qaVerdict === null 是因 qa-lead 失败导致的中断（已 break）— 若写成「到达2次」
        // 会让人把未实施的 round 误读为已实施，因此区分措辞
        (qaVerdict === null
          ? 'FullQA: QA-PLAY 在未取得判定的情况下中断（qa-lead 失败 — 上限1次未用完）。'
          : 'FullQA: QA-PLAY 到达上限（review 1次）仍非 APPROVE（' + qaVerdict + '）。') +
        (qaSummary ? ' 理由: ' + qaSummary + '。' : '') +
        (qaFailedAcceptance.length ? ' 不合格 acceptance: ' + qaFailedAcceptance.join(', ') + '。' : '') +
        ' 残留 bug: ' + (qaBugs.length ? qaBugs.map(function (b) { return '[' + b.severity + '] ' + b.summary; }).join(' / ') : '参见 qa/report.md')
      );
    }
  })
]);

// ===== Phase: Final =====
phase('Final');
let cd = null;
for (let attempt = 1; attempt <= 2; attempt++) {
  cd = await agentR(
    'CD-CHECKPOINT 最终判定（creative-director、attempt ' + attempt + '/2）。遵循 ' + DOCS + '/gates.md 的 CD-CHECKPOINT 节。\n' +
    '对象: Checkpoint C（成品交付）的展示物一套。\n' +
    '需阅读: design/brief.md、design/concept.md（支柱）、design/gdd.md、qa/report.md、qa/evidence/、state/stories.yaml、' + MANIFEST + '、state/reviews/ 下。\n' +
    '未解决事项(JSON。须诚实全部披露。**以 [BLOCKER] 开头的项目与降级（Humanoid→Generic / 占位符 / Fallback / shippable:false）在 summary 的开头单独警告，不埋没在列表中** — gates.md CD-CHECKPOINT 要点3): ' + JSON.stringify(unresolvedFindings) + '\n' +
    '资产审计(JSON): ' + JSON.stringify(audit) + '\n' +
    '返回内容:\n' +
    '- verdict（APPROVE/CONCERNS/REJECT。REJECT 时将展示给人类之前应修正的点放入 mustFix）\n' +
    '- summary: 让人类能在5分钟内做出判断的摘要（做了什么 / 希望判断什么 / 不隐瞒地列举已知问题、妥协点。[BLOCKER]、降级在开头单独警告）\n' +
    '- playInstructions: 启动步骤（' + EP.playInstructions + '）与操作方法、看点\n' +
    '响应的第1行为「CD-CHECKPOINT: APPROVE|CONCERNS|REJECT」，结构化返回的 verdict 也填入相同判定。\n' +
    '将判定按 ' + DOCS + '/review-loops.md 的格式追加写入 state/reviews/checkpoint-c.md（追加写入是作为判定者的你的责任。日时使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出 — 禁止凭推测填写）。',
    { label: 'cd-checkpoint-' + attempt, phase: 'Final', agentType: 'creative-director', schema: CD_SCHEMA, effort: 'high' }
  );
  if (cd === null) {
    unresolvedFindings.push('Final: creative-director 未返回 CD-CHECKPOINT 判定');
    break;
  }
  verdictHistory.push({
    gate: 'CD-CHECKPOINT',
    artifact: 'checkpoint-c',
    iteration: attempt,
    verdict: cd.verdict,
    findings: cd.mustFix || []
  });
  log('CD-CHECKPOINT attempt ' + attempt + ': ' + cd.verdict);
  if (cd.verdict !== 'REJECT') break;
  if (attempt === 2) {
    unresolvedFindings.push('Final: CD-CHECKPOINT 再判定仍为 REJECT。mustFix: ' + (cd.mustFix || []).join(' / '));
    break;
  }
  const cdFix = await agentR(
    'CD-CHECKPOINT 为 REJECT。在展示给人类之前修正以下内容（review-loops.md: 修正后仅再判定1次）。mustFix(JSON):\n' + JSON.stringify(cd.mustFix || []) + '\n' +
    '修正展示物（摘要、qa/report.md、产出物的一致性），若需修改代码则按相关 engineer 的规范（' + EP.techStackDoc + '）以最小限度进行，并通过相当于 typecheck/build 的验证（' + EP.verifyCmd + '）。\n' +
    '若有变更则执行 git commit。' + CODE_COMMIT_RULE + '\n' +
    IDEMPOTENT_RULE,
    { label: 'cd-fix', phase: 'Final', agentType: 'tech-director', effort: 'high' }
  );
  if (cdFix === null) {
    // 与 prototype.js / concept-design.js 的同型记录对称化（若再判定以非 REJECT 通过，fix 失败就会沉默）
    unresolvedFindings.push('Final: 针对 CD-CHECKPOINT REJECT 指示的修正 agent 失败（mustFix 未处理即进入再判定）');
  }
}

// 状态的确定（不触碰 state/stage.txt — stage 切换是 /forge-build skill 的责任）
await agentR(
  'Phase 3 结束处理（tech-director）。\n' +
  '更新 state/active.md: 当前位置=等待 Checkpoint C 展示 / 下一步操作=人类的验收判断（review-mode: ' + reviewMode + '）/ 未解决事项(JSON): ' + JSON.stringify(unresolvedFindings) + '\n' +
  '日时使用 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出（禁止凭推测填写）。\n' +
  '注意: 不更新 state/stage.txt（stage 切换由 /forge-build skill 进行）。',
  { label: 'finalize-state', phase: 'Final', agentType: 'tech-director', effort: 'low' }
);

// ---- 返回值（Checkpoint C 材料。向人类展示是 skill 侧的责任）----------------
return {
  summary: cd && cd.summary
    ? cd.summary
    : '未能获得 CD-CHECKPOINT 的摘要。请直接确认 qa/report.md 与 state/reviews/。',
  playInstructions: cd && cd.playInstructions
    ? cd.playInstructions
    : '用 ' + EP.playInstructions + ' 启动。操作参见 design/gdd.md。',
  qaReportPath: 'qa/report.md',
  totalAssetCost: audit && typeof audit.totalAssetCost === 'number' ? audit.totalAssetCost : null,
  licenseFlags: audit && Array.isArray(audit.licenseFlags) ? audit.licenseFlags : [],
  unresolvedFindings: unresolvedFindings,
  verdictHistory: verdictHistory,
  verdict: cd && cd.verdict ? cd.verdict : 'CONCERNS'
};
