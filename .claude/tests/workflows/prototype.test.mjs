// prototype.js 并行化相关的分支、接线测试（DSL 桩 harness）
import test from 'node:test';
import assert from 'node:assert/strict';
import { runWorkflow, callsBy, promptsBy } from './harness.mjs';

const WF = new URL('../../workflows/prototype.js', import.meta.url).pathname;
const ARGS = { reviewMode: 'lean', engine: 'phaser' };
const R = (match, reply) => ({ match, reply });

const SETUP = {
  prototypeStories: [
    { id: 'S-01', title: '元进度持久化', assignee: 'gameplay-engineer', pillar: 'P-01', acceptance: 'a' },
    { id: 'S-02', title: 'Title 场景', assignee: 'ui-engineer', pillar: 'P-01', acceptance: 'a' },
    { id: 'S-03', title: 'Menu 场景', assignee: 'ui-engineer', pillar: 'P-01', acceptance: 'a' },
    { id: 'S-04', title: '核心循环与环境视觉', assignee: 'gameplay-engineer', pillar: 'P-01', acceptance: '可见的地面/背景、灯光、相机构图与画面布局已确定' }, // 满足全部 engine 的必需环境要素（validateSetup 的 acceptance 验证）
  ],
  titleStoryId: 'S-02',
  menuStoryId: 'S-03',
  metaPersistenceStoryId: 'S-01',
  environmentStoryId: 'S-04', // retro-e3: 环境视觉 story 被加入 SETUP_SCHEMA 的 required
};
const CROSSCHECK = {
  found: [
    { id: 'S-02', exists: true, assignee: 'ui-engineer', phase: 'prototype' },
    { id: 'S-03', exists: true, assignee: 'ui-engineer', phase: 'prototype' },
    { id: 'S-01', exists: true, assignee: 'gameplay-engineer', phase: 'prototype' },
    { id: 'S-04', exists: true, assignee: 'gameplay-engineer', phase: 'prototype', acceptance: '可见的地面/背景、灯光、相机构图与画面布局已确定' }, // 环境 story 的实体 acceptance 也会被核对
  ],
};
const QA_OK = { verdict: 'APPROVE', criticalBugs: [], failedAcceptance: [], evidencePaths: ['qa/evidence/e.png'], screenshotsVisuallyConfirmed: true };
const EV_OK = { checks: [{ path: 'qa/evidence/e.png', exists: true, nonEmpty: true }], extraFilesInEvidenceDir: [] };

// route 采用前缀匹配（使 agentR 带 '-retry' 的 label 也能命中同一 route — retro-e3 问题5）
function baseRoutes(batchReply, qaReply) {
  return [
    R(/^setup-scaffold-stories/, SETUP),
    R(/^setup-crosscheck-stories/, CROSSCHECK),
    R(/^qa-play-round/, qaReply || QA_OK),
    R(/^verify-evidence-round/, EV_OK),
    R(/^batch-verify-/, batchReply),
  ];
}
const BATCH_OK = { ok: true, fixedNotes: [], unresolved: [] };

test('happy path: lane 合流后 batch-verify 1次，Integrate/QA 无警告', async () => {
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes({ ok: true, fixedNotes: [], unresolved: [] }) });
  assert.equal(callsBy(calls, /^batch-verify-build$/).length, 1);
  // batch-verify 在全部 implement 完成后（合流后）被调用
  const order = calls.map((c) => c.label);
  const lastImpl = Math.max(...['implement-S-01', 'implement-S-02', 'implement-S-03', 'implement-S-04'].map((l) => order.indexOf(l)));
  assert.ok(order.indexOf('batch-verify-build') > lastImpl, 'batch-verify 在 lane 完成前就运行了');
  assert.ok(!promptsBy(calls, /^integrate-assets$/)[0].includes('警告'));
  assert.ok(result.unresolvedFindings.every((f) => !f.includes('batch-verify')));
});

test('lane 分配: gameplay=S-01,S-04 / ui=S-02,S-03，lane 内顺序保持', async () => {
  const { calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes({ ok: true, fixedNotes: [], unresolved: [] }) });
  const order = calls.map((c) => c.label).filter((l) => l.startsWith('implement-'));
  assert.deepEqual([...order].sort(), ['implement-S-01', 'implement-S-02', 'implement-S-03', 'implement-S-04']);
  assert.ok(order.indexOf('implement-S-01') < order.indexOf('implement-S-04'), 'gameplay lane 内顺序');
  assert.ok(order.indexOf('implement-S-02') < order.indexOf('implement-S-03'), 'ui lane 内顺序');
});

test('batch-verify 不合格: 向 Integrate 与 QA 注入警告 + 累积 BLOCKER', async () => {
  const routes = baseRoutes({ ok: false, fixedNotes: [], unresolved: ['ui 引用断裂'] });
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(promptsBy(calls, /^integrate-assets$/)[0].includes('警告: Build 批量验证未通过'));
  assert.ok(promptsBy(calls, /^qa-play-round1$/)[0].includes('警告: Build 批量验证未通过'));
  assert.ok(result.unresolvedFindings.some((f) => f.includes('[batch-verify] ui 引用断裂')));
});

test('H-3/L-9: fixedNotes 进入 knownIssues，ok:true+unresolved 视为不合格', async () => {
  const routes = baseRoutes({ ok: true, fixedNotes: ['修复了孤立 import'], unresolved: ['残留'] });
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.knownIssues.some((k) => k.includes('batch-verify 修复/未经 CR-CODE')));
  assert.ok(promptsBy(calls, /^integrate-assets$/)[0].includes('警告'), 'L-9 回归: unresolved 残留时警告消失了');
});

test('提示词接线: produce/revise 为 laneVerify（仅限 own-file），bookkeep 为指定路径 commit，reviewer 只读', async () => {
  const { calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes({ ok: true, fixedNotes: [], unresolved: [] }) });
  for (const p of promptsBy(calls, /^implement-/)) {
    assert.ok(p.includes('自己编辑的文件导致'), 'produce 的 laneVerify 不是仅限 own-file');
    assert.ok(p.includes('并行 lane 纪律'), 'produce 中没有 LANE_RULE');
  }
  for (const p of promptsBy(calls, /^bookkeep-/)) {
    assert.ok(p.includes(': status done" -- state/stories.yaml'), 'bookkeep 仍是不带路径的 git commit（F-3 回归）');
    assert.ok(p.includes('不要触碰'), 'bookkeep 中没有 active.md 禁令');
  }
  for (const p of promptsBy(calls, /^cr-code-/)) {
    assert.ok(p.includes('只读'), 'reviewer 中没有禁止启动引擎');
  }
  const gen = promptsBy(calls, /^generate-assets-images-prototype$/)[0];
  assert.ok(gen.includes('state/reviews'), '资产提交没有 state 限定（H-4）');
});

test('M-8a: 同一 bug 跨 round 时 fix-qa label 仍按 round 唯一', async () => {
  const qaReply = (call) => call.label.endsWith('round1')
    ? { verdict: 'CONCERNS', criticalBugs: [{ title: '崩溃', detail: 'd', assignee: 'gameplay-engineer' }], failedAcceptance: [], evidencePaths: ['qa/evidence/e.png'], screenshotsVisuallyConfirmed: true }
    : QA_OK;
  const { calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes({ ok: true, fixedNotes: [], unresolved: [] }, qaReply) });
  assert.equal(callsBy(calls, /^fix-qa-r1-gameplay-engineer-0$/).length, 1, 'fix-qa label 不是 round 作用域');
});

// ---- retro-e3 跟进: agentR 重试 ----

test('agentR 重试: 首次 null 时以 -retry label + 前置 resume 守卫仅重试1次并恢复', async () => {
  let crosscheckCalls = 0;
  const routes = [
    R(/^setup-scaffold-stories/, SETUP),
    R(/^setup-crosscheck-stories/, (call) => {
      crosscheckCalls++;
      return call.label.endsWith('-retry') ? CROSSCHECK : null;
    }),
    R(/^qa-play-round/, QA_OK),
    R(/^verify-evidence-round/, EV_OK),
    R(/^batch-verify-/, BATCH_OK),
  ];
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.equal(crosscheckCalls, 2, 'null 后恰好只重试1次');
  assert.equal(callsBy(calls, /^setup-crosscheck-stories$/).length, 1);
  const retry = callsBy(calls, /^setup-crosscheck-stories-retry$/);
  assert.equal(retry.length, 1, '没有以带 -retry 的 label 重新调用');
  // 禁止盲目重新执行: 重试在前置 resume 守卫（确认已完成作业、禁止重复执行）的基础上保留原提示词
  assert.ok(retry[0].prompt.startsWith('【重试执行】'), '重试没有前置 resume 守卫');
  assert.ok(retry[0].prompt.endsWith(callsBy(calls, /^setup-crosscheck-stories$/)[0].prompt), '重试没有保留原提示词');
  // 已恢复并继续进入实现阶段（不落入上报）
  assert.equal(callsBy(calls, /^implement-/).length, 4);
  assert.ok(!result.unresolvedFindings.some((f) => f.includes('独立核对')));
});

test('agentR 重试: 2次 null 则到达原有的上报（生成 agent 失败）', async () => {
  const routes = [R(/^generate-assets-images-prototype/, null)].concat(baseRoutes(BATCH_OK));
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.equal(callsBy(calls, /^generate-assets-images-prototype$/).length, 1);
  assert.equal(callsBy(calls, /^generate-assets-images-prototype-retry$/).length, 1, '重试仅1次（没有第2次及以后）');
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('[AR-ASSET][assets-images-prototype] 生成 agent 失败')),
    '重试后仍为 null 则照旧上报'
  );
});

// ---- retro-e3 跟进: Setup 环境视觉 story 的机械验证 ----

test('Setup 环境验证: environmentStoryId 不存在则退回→以修正响应继续，crosscheck 核对必需的4个 story', async () => {
  const routes = [
    R(/^setup-scaffold-stories/, { ...SETUP, environmentStoryId: 'S-99' }),
    R(/^setup-fix-required-stories/, SETUP),
    R(/^setup-crosscheck-stories/, CROSSCHECK),
    R(/^qa-play-round/, QA_OK),
    R(/^verify-evidence-round/, EV_OK),
    R(/^batch-verify-/, BATCH_OK),
  ];
  const { calls } = await runWorkflow(WF, { args: ARGS, routes });
  const fix = promptsBy(calls, /^setup-fix-required-stories$/);
  assert.equal(fix.length, 1, '退回（setup-fix-required-stories）没有发出1次');
  assert.ok(fix[0].includes('environmentStoryId=S-99'), '缺失 ID 没有出现在退回措辞中');
  assert.ok(fix[0].includes('环境的最低限度视觉表现 story'), '退回措辞中没有环境 story 的必需要求');
  assert.ok(fix[0].includes('背景、画面布局'), '退回措辞的必需环境要素不是 engine=phaser 的集合（挪用 unity 要求会让修正被 validator 判为不合格）');
  // 独立核对（crosscheck）以 Title/Menu/元进度/环境的4个 story 为对象
  const cc = promptsBy(calls, /^setup-crosscheck-stories$/)[0];
  for (const id of ['S-01', 'S-02', 'S-03', 'S-04']) {
    assert.ok(cc.includes('"' + id + '"'), 'crosscheck 对象中没有 ' + id);
  }
  assert.equal(callsBy(calls, /^implement-/).length, 4, '修正响应后没有继续进入实现阶段');
});

test('Setup 环境验证: 环境 story 的 assignee 不是 gameplay-engineer 则为退回对象', async () => {
  const routes = [
    R(/^setup-scaffold-stories/, { ...SETUP, environmentStoryId: 'S-02' }), // S-02 是 ui-engineer
    R(/^setup-fix-required-stories/, SETUP),
    R(/^setup-crosscheck-stories/, CROSSCHECK),
    R(/^qa-play-round/, QA_OK),
    R(/^verify-evidence-round/, EV_OK),
    R(/^batch-verify-/, BATCH_OK),
  ];
  const { calls } = await runWorkflow(WF, { args: ARGS, routes });
  const fix = promptsBy(calls, /^setup-fix-required-stories$/);
  assert.equal(fix.length, 1);
  assert.ok(fix[0].includes('环境视觉 story S-02 的 assignee 不是 gameplay-engineer'), 'assignee 不正确的问题没有出现在退回措辞中');
  assert.equal(callsBy(calls, /^implement-/).length, 4, '修正响应后没有继续进入实现阶段');
});

test('Setup 环境验证: acceptance 缺少必需环境要素则退回（列举缺失要素）', async () => {
  const thinEnv = {
    ...SETUP,
    prototypeStories: SETUP.prototypeStories.map((st) =>
      st.id === 'S-04' ? { ...st, acceptance: '将背景可视化' } : st), // 未提及布局（phaser 要求是 背景+画面布局）
  };
  const routes = [
    R(/^setup-scaffold-stories/, thinEnv),
    R(/^setup-fix-required-stories/, SETUP),
    R(/^setup-crosscheck-stories/, CROSSCHECK),
    R(/^qa-play-round/, QA_OK),
    R(/^verify-evidence-round/, EV_OK),
    R(/^batch-verify-/, BATCH_OK),
  ];
  const { calls } = await runWorkflow(WF, { args: ARGS, routes });
  const fix = promptsBy(calls, /^setup-fix-required-stories$/);
  assert.equal(fix.length, 1, 'acceptance 描述不足时没有发出退回');
  assert.ok(fix[0].includes('缺少必需环境要素: 画面布局'), '缺失要素（画面布局）没有列举在退回措辞中');
  assert.equal(callsBy(calls, /^implement-/).length, 4, '修正响应后没有继续进入实现阶段');
});

test('Setup 环境验证: engine=unity 将仅有背景的 acceptance 判为不合格并要求「地面」', async () => {
  const bgOnly = {
    ...SETUP,
    prototypeStories: SETUP.prototypeStories.map((st) =>
      st.id === 'S-04' ? { ...st, acceptance: '背景、灯光、相机构图已确定' } : st), // 未提及地面（contract §11: 3D 必需可见的地面）
  };
  const routes = [
    R(/^setup-scaffold-stories/, bgOnly),
    R(/^setup-fix-required-stories/, SETUP),
    R(/^setup-crosscheck-stories/, CROSSCHECK),
    R(/^qa-play-round/, QA_OK),
    R(/^verify-evidence-round/, EV_OK),
    R(/^batch-verify-/, BATCH_OK),
  ];
  const { calls } = await runWorkflow(WF, { args: { reviewMode: 'lean', engine: 'unity' }, routes });
  const fix = promptsBy(calls, /^setup-fix-required-stories$/);
  assert.equal(fix.length, 1, '仅有背景的 acceptance 在 engine=unity 下没有被退回');
  assert.ok(fix[0].includes('缺少必需环境要素: 地面'), '缺失要素（地面）没有列举在退回措辞中');
});

test('Setup 环境验证: stories.yaml 实体的 phase 不是 prototype 则独立核对不合格', async () => {
  const ccBuildPhase = {
    found: CROSSCHECK.found.map((f) => (f.id === 'S-04' ? { ...f, phase: 'build' } : f)),
  };
  const routes = [
    R(/^setup-scaffold-stories/, SETUP),
    R(/^setup-crosscheck-stories/, ccBuildPhase),
    R(/^qa-play-round/, QA_OK),
    R(/^verify-evidence-round/, EV_OK),
    R(/^batch-verify-/, BATCH_OK),
  ];
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.equal(callsBy(calls, /^implement-/).length, 0, 'phase 不一致却进入了实现阶段');
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('phase 为 build')),
    'phase 不一致没有记录到 unresolvedFindings'
  );
});

test('Setup 环境验证: 核对响应的字段省略不是跳过验证而是不合格', async () => {
  const ccOmitted = {
    found: CROSSCHECK.found.map((f) =>
      f.id === 'S-04' ? { id: 'S-04', exists: true } : f), // 省略 assignee/phase/acceptance
  };
  const routes = [
    R(/^setup-scaffold-stories/, SETUP),
    R(/^setup-crosscheck-stories/, ccOmitted),
    R(/^qa-play-round/, QA_OK),
    R(/^verify-evidence-round/, EV_OK),
    R(/^batch-verify-/, BATCH_OK),
  ];
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.equal(callsBy(calls, /^implement-/).length, 0, '字段省略却进入了实现阶段');
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('无法验证')),
    '字段省略（无法验证）没有记录到 unresolvedFindings'
  );
});

// ---- retro-e3 跟进: fallback 必需措辞 / date -u 统一 / 导入目标 ----

test('fallback 必需措辞: 生成类提示词中包含全段尝试与路由名+HTTP 列举义务', async () => {
  const { calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes(BATCH_OK) });
  const gens = callsBy(calls, /^generate-assets-/);
  assert.ok(gens.length >= 2, '生成批次（images/audio）没有启动');
  for (const c of gens) {
    assert.ok(c.prompt.includes('1 段 fallback 都不尝试就直接本地降级'), c.label + ' 中没有「禁止1段都不尝试就本地降级」');
    assert.ok(c.prompt.includes('全段尝试'), c.label + ' 中没有 fallback 全段尝试的义务');
    assert.ok(c.prompt.includes('路由名 + HTTP 状态'), c.label + ' 中没有路由名+HTTP 状态码的列举义务');
    assert.ok(
      c.opts.schema.properties.degradedRoutes.description.includes('路由名+HTTP 状态码必填'),
      c.label + ' 的 GEN_SCHEMA degradedRoutes description 没有更新'
    );
  }
});

test('date -u 统一: 填写时刻的提示词指定 date -u 命令的执行输出', async () => {
  const { calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes(BATCH_OK) });
  const DATE_CMD = 'date -u +%Y-%m-%dT%H:%M:%SZ';
  for (const re of [/^setup-scaffold-stories$/, /^batch-verify-build$/, /^integrate-assets$/, /^qa-play-round1$/, /^cd-checkpoint-b$/]) {
    const p = promptsBy(calls, re)[0];
    assert.ok(p && p.includes(DATE_CMD), String(re) + ' 中没有 date -u 指定（留有凭推测填写的余地）');
  }
});

test('导入目标: engine=unity 的 scaffold/Integrate 指向 Assets/Resources/Generated/ 且旧 Assets/Generated/ 残留为零', async () => {
  const { calls } = await runWorkflow(WF, {
    args: { reviewMode: 'lean', engine: 'unity' },
    routes: baseRoutes(BATCH_OK),
  });
  assert.ok(promptsBy(calls, /^setup-scaffold-stories$/)[0].includes('Assets/Resources/Generated/'), 'scaffold 没有指向新导入目标');
  assert.ok(promptsBy(calls, /^integrate-assets$/)[0].includes('game/Assets/Resources/Generated/'), 'Integrate 没有指向新导入目标');
  for (const c of calls) {
    assert.ok(!c.prompt.includes('Assets/Generated/'), c.label + ' 中残留旧导入目标 Assets/Generated/');
  }
});

// ---- 审计跟进（2026-07-29）: lane 异常守卫 / CD 重新判定 null 记录 / M-8b（fix-qa 按 bug 单位 label、幂等守卫） ----

test('lane 异常: implement 抛出异常也累积 [BLOCKER] + ui lane 继续', async () => {
  const routes = [
    R(/^implement-S-01/, () => { throw new Error('schema mismatch'); }),
  ].concat(baseRoutes(BATCH_OK));
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('[BLOCKER] Build gameplay lane 因异常中断') && f.includes('schema mismatch')),
    'lane 异常无记录: ' + JSON.stringify(result.unresolvedFindings)
  );
  assert.equal(callsBy(calls, /^implement-S-02$/).length, 1, 'ui lane 被连带停止');
  assert.equal(callsBy(calls, /^implement-S-03$/).length, 1);
});

test('M-8b: 同一 round、同一 assignee 的多个 bug 时 fix-qa label 也按 bug 单位唯一', async () => {
  const qaReply = (call) => call.label.endsWith('round1')
    ? { verdict: 'CONCERNS', criticalBugs: [
        { title: '崩溃A', detail: 'd', assignee: 'gameplay-engineer' },
        { title: '崩溃B', detail: 'd', assignee: 'gameplay-engineer' },
      ], failedAcceptance: [], evidencePaths: ['qa/evidence/e.png'], screenshotsVisuallyConfirmed: true }
    : QA_OK;
  const { calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes(BATCH_OK, qaReply) });
  assert.equal(callsBy(calls, /^fix-qa-r1-gameplay-engineer-0$/).length, 1);
  assert.equal(callsBy(calls, /^fix-qa-r1-gameplay-engineer-1$/).length, 1, '第2个 bug 与第1个 label 冲突');
});

test('M-8b: implement/bookkeep/integrate 有幂等守卫，bookkeep 有「已是 done」措辞', async () => {
  const { calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes(BATCH_OK) });
  for (const re of [/^implement-S-01$/, /^bookkeep-S-01$/, /^integrate-assets$/]) {
    assert.ok(promptsBy(calls, re)[0].includes('幂等守卫'), re + ' 没有前置幂等守卫');
  }
  assert.ok(promptsBy(calls, /^bookkeep-S-01$/)[0].includes('已是 done'), 'bookkeep 中没有幂等措辞（若已是 done 则不做任何事）');
});

test('CD 重新判定 null: 以初次 REJECT 状态展示的说明记录到 unresolvedFindings', async () => {
  const routes = [
    R(/^cd-checkpoint-b-rejudge/, null),
    R(/^cd-checkpoint-b/, { verdict: 'REJECT', summary: 's', playInstructions: 'p', evidencePaths: [], knownIssues: [], rejectInstructions: ['修好它'] }),
  ].concat(baseRoutes(BATCH_OK));
  const { result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('REJECT 后的重新判定 agent 失败')));
  assert.equal(result.verdict, 'REJECT');
});

test('M-8b: CR fix（revise）提示词也前置幂等守卫', async () => {
  const qaOkRoutes = baseRoutes(BATCH_OK);
  const routes = [
    R(/^cr-code-S-01-iter1/, { verdict: 'CONCERNS', findings: ['魔法数字'] }),
    R(/^cr-silent-S-01-iter1/, { verdict: 'APPROVE', findings: [] }),
  ].concat(qaOkRoutes);
  const { calls } = await runWorkflow(WF, { args: ARGS, routes });
  const fixPrompt = promptsBy(calls, /^fix-S-01-iter1$/)[0];
  assert.ok(fixPrompt, 'CONCERNS 后 fix agent 没有启动');
  assert.ok(fixPrompt.includes('幂等守卫'), 'revise 提示词没有前置幂等守卫');
});

test('lane 异常: AssetGen(images) track 的 laneSafe 也会实际触发', async () => {
  const routes = [
    R(/^generate-assets-images-prototype/, () => { throw new Error('images boom'); }),
  ].concat(baseRoutes(BATCH_OK));
  const { result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('[BLOCKER] AssetGen(images) track 因异常中断') && f.includes('images boom')),
    JSON.stringify(result.unresolvedFindings)
  );
});
