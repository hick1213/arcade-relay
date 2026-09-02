// full-build.js 并行化相关的分支、接线测试（DSL 桩 harness）
import test from 'node:test';
import assert from 'node:assert/strict';
import { runWorkflow, callsBy, promptsBy } from './harness.mjs';

const WF = new URL('../../workflows/full-build.js', import.meta.url).pathname;
const ARGS = { reviewMode: 'lean', engine: 'phaser', checkpointBFeedbackPath: 'state/checkpoint-b-feedback.md' };

const gp = (id, title) => ({ id, title: title || id, assignee: 'gameplay-engineer', pillar: 'P-01', acceptance: 'a' });
const ui = (id, title) => ({ id, title: title || id, assignee: 'ui-engineer', pillar: 'P-01', acceptance: 'a' });
const R = (match, reply) => ({ match, reply });

const QA_OK = { verdict: 'APPROVE', bugs: [], failedAcceptance: [], evidencePaths: ['qa/evidence/e.png'], screenshotsVisuallyConfirmed: true };
const EV_OK = { checks: [{ path: 'qa/evidence/e.png', exists: true, nonEmpty: true }], extraFilesInEvidenceDir: [] };

function baseRoutes(batchReply) {
  return [
    R(/^replan-stories$/, { stories: [gp('S-01'), ui('S-02'), gp('S-03')] }),
    R(/^polish-plan$/, { stories: [gp('S-10'), ui('S-11')] }),
    R(/^qa-play-/, QA_OK),
    R(/^verify-evidence-/, EV_OK),
    R(/^batch-verify-/, batchReply),
  ];
}

test('happy path: batch-verify 在 Build/Polish 的合流点各1次、无 BLOCKER', async () => {
  const { result, calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes({ ok: true, fixedNotes: [], unresolved: [] }) });
  assert.equal(callsBy(calls, /^batch-verify-build$/).length, 1);
  assert.equal(callsBy(calls, /^batch-verify-polish$/).length, 1);
  assert.ok(!result.unresolvedFindings.some((f) => f.includes('batch-verify')), JSON.stringify(result.unresolvedFindings));
  // 不注入警告
  assert.ok(!promptsBy(calls, /^polish-plan$/)[0].includes('警告'));
  assert.ok(!promptsBy(calls, /^qa-play-1$/)[0].includes('批量验证'));
});

test('lane 分配: 全部 code story 恰好1个 lane、lane 内顺序保持、注入 LANE_RULE', async () => {
  const { calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes({ ok: true, fixedNotes: [], unresolved: [] }) });
  const implLabels = callsBy(calls, /^impl-s-0[123]$/).map((c) => c.label);
  assert.deepEqual([...implLabels].sort(), ['impl-s-01', 'impl-s-02', 'impl-s-03']);
  // gameplay lane 内的相对顺序: S-01 先于 S-03
  assert.ok(implLabels.indexOf('impl-s-01') < implLabels.indexOf('impl-s-03'));
  for (const p of promptsBy(calls, /^impl-s-0[123]$/)) {
    assert.ok(p.includes('并行 lane 规范'), 'impl 提示词中没有 LANE_RULE');
    assert.ok(!p.includes('不执行 `npm run build`') || p.includes('自己编辑的文件引起'), 'phaser laneVerify 未限定为 own-file');
  }
  // close-（APPROVE 后处理）也有 LANE_RULE（stories.yaml 保护）
  for (const p of promptsBy(calls, /^close-/)) assert.ok(p.includes('并行 lane 规范'));
  // CR-CODE 评审者为只读 + lane 前提
  for (const p of promptsBy(calls, /^cr-/)) {
    assert.ok(p.includes('只读'), '评审者没有禁止启动引擎');
    assert.ok(p.includes('实体尚未实现'), '评审者没有 lane 前提');
  }
});

test('batch-verify null: 累积 BLOCKER + 向 Polish/Integrate/QA 注入警告 + 也传播到 Polish 实现 lane', async () => {
  const { result, calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes(null) });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('[BLOCKER]') && f.includes('批量验证 agent 未返回结果')));
  assert.ok(promptsBy(calls, /^polish-plan$/)[0].includes('警告: Build 批量验证仍未合格'));
  assert.ok(promptsBy(calls, /^qa-play-1$/)[0].includes('批量验证'));
  // L-11: 警告也送达 Polish 的实现 agent
  for (const p of promptsBy(calls, /^impl-s-1[01]$/)) assert.ok(p.includes('警告: Build 批量验证仍未合格'), '警告未送达 Polish 实现 lane');
});

test('batch-verify ok:false + unresolved: 单独 BLOCKER + 警告', async () => {
  const routes = baseRoutes({ ok: false, fixedNotes: [], unresolved: ['S-01 的类型不一致'] });
  const { result, calls } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('[batch-verify] S-01 的类型不一致')));
  assert.ok(promptsBy(calls, /^qa-play-1$/)[0].includes('批量验证'));
});

test('batch-verify ok:false + unresolved 为空: 合成 BLOCKER', async () => {
  const { result } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes({ ok: false, fixedNotes: [], unresolved: [] }) });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('[BLOCKER]') && f.includes('未达到合格')));
});

test('L-9: 即使 ok:true，只要 unresolved 非空警告就不会消失', async () => {
  const routes = baseRoutes({ ok: true, fixedNotes: [], unresolved: ['残留问题'] });
  const { result, calls } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('[batch-verify] 残留问题')));
  assert.ok(promptsBy(calls, /^qa-play-1$/)[0].includes('批量验证'), 'ok:true+unresolved 时警告为空（L-9 退化）');
});

test('H-3: fixedNotes 进入人类可见渠道（unresolvedFindings）', async () => {
  const routes = baseRoutes({ ok: true, fixedNotes: ['修正 S-02 引起的未定义引用'], unresolved: [] });
  const { result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('batch-verify修正/未经 CR-CODE') && f.includes('S-02 引起')));
});

test('polish story 为 0 件时 Polish batch-verify 不运行', async () => {
  const routes = [
    R(/^replan-stories$/, { stories: [gp('S-01')] }),
    R(/^polish-plan$/, { stories: [] }),
    R(/^qa-play-/, QA_OK),
    R(/^verify-evidence-/, EV_OK),
    R(/^batch-verify-/, { ok: true, fixedNotes: [], unresolved: [] }),
  ];
  const { calls } = await runWorkflow(WF, { args: ARGS, routes });
  assert.equal(callsBy(calls, /^batch-verify-build$/).length, 1);
  assert.equal(callsBy(calls, /^batch-verify-polish$/).length, 0);
});

test('提交规范: hash 实证验证与共享文件单独提交出现在 impl 提示词中 / 资产提交限定为 state/reviews', async () => {
  const { calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes({ ok: true, fixedNotes: [], unresolved: [] }) });
  const impl = promptsBy(calls, /^impl-s-01$/)[0];
  assert.ok(impl.includes('git show --stat'), '没有 hash 实证验证（M-6）');
  assert.ok(impl.includes('单独提交'), '没有共享文件立即单独提交（M-5）');
  const gen = promptsBy(calls, /^gen-images-1$/)[0];
  assert.ok(gen.includes('state/reviews'), '没有资产提交的 state 限定（H-4）');
  assert.ok(!gen.includes('design docs state`'), '资产提交仍是整个 state 目录');
});

// ---- retro-e3 跟进: agentR 重试 ----

test('agentR 重试: batch-verify 首次 null 通过 -retry 恢复且无 BLOCKER/警告', async () => {
  let firstCalls = 0;
  const bv = (call) => {
    if (call.label.endsWith('-retry')) return { ok: true, fixedNotes: [], unresolved: [] };
    firstCalls++;
    return null;
  };
  const { result, calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes(bv) });
  assert.equal(firstCalls, 2, '不是 Build/Polish 各1次的首次调用');
  assert.equal(callsBy(calls, /^batch-verify-build-retry$/).length, 1, '未发出 Build 的 -retry');
  assert.equal(callsBy(calls, /^batch-verify-polish-retry$/).length, 1, '未发出 Polish 的 -retry');
  // 使用重试恢复的结果（没有按 null 处理的 BLOCKER 或向后续注入的警告）
  assert.ok(!result.unresolvedFindings.some((f) => f.includes('批量验证 agent 未返回结果')));
  assert.ok(!promptsBy(calls, /^qa-play-1$/)[0].includes('批量验证'), '已恢复却向 QA 注入了警告');
});

test('agentR 重试: CR 评审对2次 null 则照旧上报（不自动 APPROVE）', async () => {
  const routes = [
    R(/^cr-s-01-1/, null),   // 前缀匹配 = 带 '-retry' 的 label 也为 null（2次 null 的情况）
    R(/^sfh-s-01-1/, null),
  ].concat(baseRoutes({ ok: true, fixedNotes: [], unresolved: [] }));
  const { result, calls } = await runWorkflow(WF, { args: ARGS, routes });
  assert.equal(callsBy(calls, /^cr-s-01-1-retry$/).length, 1, '未发出 code-reviewer 侧的 -retry');
  assert.equal(callsBy(calls, /^sfh-s-01-1-retry$/).length, 1, '未发出 silent-failure-hunter 侧的 -retry');
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('S-01: CR-CODE iteration 1 的评审对双方均失败')),
    '重试后仍为 null 时未到达照旧的上报'
  );
  assert.ok(result.verdictHistory.some((v) => v.gate === 'CR-CODE' && v.artifact === 's-01' && v.iteration === 1 && v.verdict === 'CONCERNS'));
  // iteration 2 以正常评审（默认响应 findings 0 = APPROVE）恢复
  assert.ok(result.verdictHistory.some((v) => v.gate === 'CR-CODE' && v.artifact === 's-01' && v.iteration === 2 && v.verdict === 'APPROVE'));
});

// ---- retro-e3 跟进: fallback 必需措辞 / date -u 统一 / 导入目标 ----

test('fallback 必需措辞: gen 系提示词中包含全段尝试与路由名+HTTP 列举义务', async () => {
  const { calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes({ ok: true, fixedNotes: [], unresolved: [] }) });
  const gens = callsBy(calls, /^gen-(images|audio|models)-/);
  assert.ok(gens.length >= 2, '生成批次（images/audio）未启动');
  for (const c of gens) {
    assert.ok(c.prompt.includes('1 段都不尝试就本地降级'), c.label + ' 中没有「禁止 1 段都不尝试就本地降级」');
    assert.ok(c.prompt.includes('全段尝试'), c.label + ' 中没有 fallback 全段尝试的义务');
    assert.ok(c.prompt.includes('路由名 + HTTP 状态'), c.label + ' 中没有路由名+HTTP代码的列举义务');
    assert.ok(
      c.opts.schema.properties.degradedRoutes.description.includes('路由名+HTTP代码必填'),
      c.label + ' 的 ASSET_GEN_SCHEMA degradedRoutes description 未更新'
    );
  }
});

test('date -u 统一: replan/batch-verify/QA/CD/finalize 提示词指定 date -u 命令的执行输出', async () => {
  const { calls } = await runWorkflow(WF, { args: ARGS, routes: baseRoutes({ ok: true, fixedNotes: [], unresolved: [] }) });
  const DATE_CMD = 'date -u +%Y-%m-%dT%H:%M:%SZ';
  for (const re of [/^replan-stories$/, /^batch-verify-build$/, /^qa-play-1$/, /^cd-checkpoint-1$/, /^finalize-state$/]) {
    const p = promptsBy(calls, re)[0];
    assert.ok(p && p.includes(DATE_CMD), String(re) + ' 中没有 date -u 指定（留有推测填写的余地）');
  }
});

test('导入目标: engine=unity 的 integrate-3d 指向 Assets/Resources/Generated/ 且旧 Assets/Generated/ 残留为零', async () => {
  const { calls } = await runWorkflow(WF, {
    args: { reviewMode: 'lean', engine: 'unity', checkpointBFeedbackPath: 'state/checkpoint-b-feedback.md' },
    routes: baseRoutes({ ok: true, fixedNotes: [], unresolved: [] }),
  });
  const p = promptsBy(calls, /^integrate-3d-assets$/)[0];
  assert.ok(p && p.includes('game/Assets/Resources/Generated/'), 'integrate-3d 未指向新导入目标');
  for (const c of calls) {
    assert.ok(!c.prompt.includes('Assets/Generated/'), c.label + ' 中残留旧导入目标 Assets/Generated/');
  }
});

// ---- 审计跟进（2026-07-29）: lane 异常守卫 / 消除错误路径的无记录 / W-3 标签分派 / M-8b 幂等守卫 ----

const BATCH_OK = { ok: true, fixedNotes: [], unresolved: [] };

test('lane 异常: 即使 impl throw 也累积 [BLOCKER] + 其他 lane 继续（先于 parallel 的 null 吞掉）', async () => {
  const routes = [
    R(/^impl-s-01/, () => { throw new Error('schema mismatch'); }),
  ].concat(baseRoutes(BATCH_OK));
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('[BLOCKER] Build gameplay lane 因异常中断') && f.includes('schema mismatch')),
    'lane 异常无记录: ' + JSON.stringify(result.unresolvedFindings)
  );
  assert.equal(callsBy(calls, /^impl-s-02$/).length, 1, 'ui lane 被连带停止');
});

test('replan-gdd null: GDD 修订判断的失败进入 unresolvedFindings', async () => {
  const routes = [R(/^replan-gdd/, null)].concat(baseRoutes(BATCH_OK));
  const { result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('GDD 修订判断 agent（game-designer）失败')));
});

test('close null: APPROVE 后的 status:done 更新失败被记录', async () => {
  const routes = [R(/^close-s-01/, null)].concat(baseRoutes(BATCH_OK));
  const { result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('S-01: APPROVE 后的 status:done 更新 agent 失败')));
});

test('CR fix null: fix 失败按每个 iteration 记录', async () => {
  const routes = [
    R(/^cr-s-01-|^sfh-s-01-/, { findings: [{ summary: 'x', severity: 'major' }] }),
    R(/^fix-s-01-/, null),
  ].concat(baseRoutes(BATCH_OK));
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('S-01: CR-CODE iteration 1 的 fix agent 失败')));
  assert.ok(result.unresolvedFindings.some((f) => f.includes('S-01: CR-CODE iteration 2 的 fix agent 失败')));
  // M-8b: 重试频发的 fix 路径最需要幂等守卫（resume 重复应用的主战场）
  assert.ok(promptsBy(calls, /^fix-s-01-1$/)[0].includes('幂等守卫'), 'CR fix 提示词未前置幂等守卫');
});

test('drift 非 APPROVE + failedAssets 为空: 不无记录地退出，累积为人类确认事项', async () => {
  const routes = [
    R(/^ar-batch-drift-1/, { verdict: 'CONCERNS', failedAssets: [], disclosures: [] }),
  ].concat(baseRoutes(BATCH_OK));
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('批次一致性检查 pass 1 为 CONCERNS 但 failedAssets 为空')));
  assert.equal(callsBy(calls, /^ar-batch-drift-2/).length, 0, '未 break 而运行了 pass 2');
});

test('QA fix null: 修正 agent 的失败被记录并进入重新 QA', async () => {
  const routes = [
    R(/^qa-fix-1-gameplay-engineer/, null),
    R(/^qa-play-1/, { verdict: 'CONCERNS', bugs: [{ summary: 'b', severity: 'major', assignee: 'gameplay-engineer' }], failedAcceptance: [], evidencePaths: ['qa/evidence/e.png'], screenshotsVisuallyConfirmed: true, summary: 'ng' }),
  ].concat(baseRoutes(BATCH_OK));
  const { result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('FullQA: round 1 的修正 agent（gameplay-engineer）失败')));
});

test('W-3: 资产 story 标签优先、无标签按词汇 fallback 分派、Replan 有标签指示、前置 M-8b 幂等守卫', async () => {
  const routes = [
    R(/^replan-stories$/, { stories: [gp('S-01'), ui('S-02'),
      { id: 'S-20', title: '[MDL] 敌人模型', assignee: 'art-director', pillar: 'P-01', acceptance: 'a' },
      { id: 'S-21', title: '[IMG] 3D标志风格图标', assignee: 'art-director', pillar: 'P-01', acceptance: 'a' },
      { id: 'S-22', title: '英雄的 rig 调整', assignee: 'art-director', pillar: 'P-01', acceptance: '更新 FBX' }, // 无标签 + 3D 词汇 = fallback 路径
      { id: 'S-23', title: '标题标志替换', assignee: 'art-director', pillar: 'P-01', acceptance: 'a' }, // 无标签 + 无词汇 = images
    ] }),
    R(/^polish-plan$/, { stories: [] }),
    R(/^qa-play-/, QA_OK),
    R(/^verify-evidence-/, EV_OK),
    R(/^batch-verify-/, BATCH_OK),
  ];
  const { calls } = await runWorkflow(WF, { args: { ...ARGS, engine: 'unity' }, routes });
  assert.ok(promptsBy(calls, /^replan-stories$/)[0].includes('资产类型标签'), 'Replan 中没有标签指示');
  const modelsPrompt = promptsBy(calls, /^gen-models-1$/)[0];
  const imagesPrompt = promptsBy(calls, /^gen-images-1$/)[0];
  assert.ok(modelsPrompt.includes('敌人模型'), '[MDL] 标签 story 未进入 models 批次');
  assert.ok(!modelsPrompt.includes('3D标志风格'), '含「3D」词汇的 [IMG] 标签 story 误配到 models（标签优先未生效）');
  assert.ok(imagesPrompt.includes('3D标志风格'), '[IMG] 标签 story 未进入 images 批次');
  assert.ok(modelsPrompt.includes('英雄的 rig 调整'), '无标签的 3D 词汇 story 未经 MODEL_WORDS fallback 进入 models');
  assert.ok(imagesPrompt.includes('标题标志替换'), '无标签、无词汇的 story 未进入 images');
  for (const re of [/^impl-s-01$/, /^close-s-01$/, /^integrate-3d-assets$/]) {
    assert.ok(promptsBy(calls, re)[0].includes('幂等守卫'), re + ' 未前置幂等守卫');
  }
});

test('lane 异常: Polish lane 与 AssetGen 轨道的 laneSafe 也实际触发', async () => {
  const routes = [
    R(/^impl-s-10/, () => { throw new Error('polish boom'); }),
    R(/^gen-images-1$/, () => { throw new Error('images boom'); }),
  ].concat(baseRoutes(BATCH_OK));
  const { result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('[BLOCKER] Polish gameplay lane 因异常中断') && f.includes('polish boom')));
  assert.ok(result.unresolvedFindings.some((f) => f.includes('[BLOCKER] AssetGen(images) 轨道 因异常中断') && f.includes('images boom')));
});

test('cd-fix null: 针对 REJECT 指示的修正 agent 失败被记录（即使再判定通过也不沉默）', async () => {
  const routes = [
    R(/^cd-fix/, null),
    R(/^cd-checkpoint-1/, { verdict: 'REJECT', summary: 's', playInstructions: 'p', mustFix: ['修正'] }),
    R(/^cd-checkpoint-2/, { verdict: 'CONCERNS', summary: 's', playInstructions: 'p', mustFix: [] }),
  ].concat(baseRoutes(BATCH_OK));
  const { result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('REJECT 指示的修正 agent 失败')));
  assert.equal(result.verdict, 'CONCERNS');
});

// ---- silent-failure-hunter 问题的回归测试（2026-07-29） ----

test('FullQA 轨道异常: 即使资产审计 thunk throw 也累积 [BLOCKER] + QA-PLAY 继续', async () => {
  const routes = [
    R(/^asset-audit/, () => { throw new Error('audit boom'); }),
  ].concat(baseRoutes(BATCH_OK));
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('[BLOCKER] FullQA 资产审计轨道 因异常中断') && f.includes('audit boom')),
    'FullQA 资产审计的异常无记录: ' + JSON.stringify(result.unresolvedFindings)
  );
  assert.equal(callsBy(calls, /^qa-play-1$/).length, 1, 'QA-PLAY 轨道被连带停止');
});

test('FullQA 轨道异常: 即使 QA-PLAY thunk throw 也累积 [BLOCKER]（QA 未实施送达 CD）', async () => {
  const routes = [
    R(/^qa-play-1/, () => { throw new Error('qa boom'); }),
  ].concat(baseRoutes(BATCH_OK));
  const { result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(result.unresolvedFindings.some((f) => f.includes('[BLOCKER] FullQA QA-PLAY 轨道 因异常中断') && f.includes('qa boom')));
});

test('engine=phaser 下 [MDL] 标签 story 不静默脱落而累积 [BLOCKER]', async () => {
  const routes = [
    R(/^replan-stories$/, { stories: [gp('S-01'), ui('S-02'),
      { id: 'S-20', title: '[MDL] 敌人模型', assignee: 'art-director', pillar: 'P-01', acceptance: 'a' },
    ] }),
  ].concat(baseRoutes(BATCH_OK));
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('[BLOCKER]') && f.includes('不支持 3D 资产（MDL/ANM）') && f.includes('S-20')),
    '2D 引擎下 3D story 的脱落无记录: ' + JSON.stringify(result.unresolvedFindings)
  );
  assert.equal(callsBy(calls, /^gen-models-/).length, 0, 'phaser 下运行了 models 批次');
});

// ---- adversarial/Codex 问题的回归测试（2026-07-30） ----

test('标签/assignee 不一致被记录、phaser 下词汇 fallback 无效', async () => {
  const routes = [
    R(/^replan-stories$/, { stories: [gp('S-01'), ui('S-02'),
      { id: 'S-30', title: '[SFX] 打击音', assignee: 'art-director', pillar: 'P-01', acceptance: 'a' }, // 标签/负责人不一致
      { id: 'S-31', title: '3D风金属质感标志', assignee: 'art-director', pillar: 'P-01', acceptance: 'a' }, // phaser: 不应用词汇 fallback → 留在 images
    ] }),
    R(/^polish-plan$/, { stories: [] }),
  ].concat(baseRoutes(BATCH_OK));
  const { calls, result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('S-30') && f.includes('[SFX]') && f.includes('不一致')),
    '标签/assignee 不一致无记录: ' + JSON.stringify(result.unresolvedFindings)
  );
  assert.ok(promptsBy(calls, /^gen-images-1$/)[0].includes('3D风金属质感标志'), 'phaser 下词汇 fallback 触发导致从 images 脱落');
  assert.ok(!result.unresolvedFindings.some((f) => f.includes('S-31')), 'phaser 的无标签 story 堆积了伪 [BLOCKER]');
});

test('Polish: 资产类 assignee 的 story 不静默丢弃而被记录', async () => {
  const routes = [
    R(/^polish-plan$/, { stories: [gp('S-10'),
      { id: 'S-40', title: '添加命中特效图像', assignee: 'art-director', pillar: 'P-01', acceptance: 'a' },
    ] }),
  ].concat(baseRoutes(BATCH_OK));
  const { result } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('Polish') && f.includes('S-40') && f.includes('实现对象') && f.includes('art-director')),
    'Polish 的资产 story 丢弃无记录（或未显示 assignee）: ' + JSON.stringify(result.unresolvedFindings)
  );
});

// ---- code-review --fix 跟进（2026-07-31）: lane 覆盖的残余漏洞、标签规范化、幂等守卫覆盖的回归测试 ----

test('Replan: 分配给 engineer 的标签 story 被记录、非 lane assignee 为 [BLOCKER]、小写标签也规范化', async () => {
  const routes = [
    R(/^replan-stories$/, { stories: [gp('S-01'), ui('S-02'),
      { id: 'S-50', title: '[IMG] HUD 图标', assignee: 'ui-engineer', pillar: 'P-01', acceptance: 'a' }, // 标签 × engineer 分配 = 进入代码 lane
      { id: 'S-51', title: '粒子调整', assignee: 'art-directer', pillar: 'P-01', acceptance: 'a' },   // 拼写错误 = 从所有 lane 脱落
      { id: 'S-52', title: '[mdl] 敌人模型', assignee: 'art-director', pillar: 'P-01', acceptance: 'a' },     // 小写标签 = 规范化后进入 models
    ] }),
    R(/^polish-plan$/, { stories: [] }),
    R(/^qa-play-/, QA_OK),
    R(/^verify-evidence-/, EV_OK),
    R(/^batch-verify-/, BATCH_OK),
  ];
  const { calls, result } = await runWorkflow(WF, { args: { ...ARGS, engine: 'unity' }, routes });
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('S-50') && f.includes('代码 lane')),
    '标签 story 分配给 engineer 无记录: ' + JSON.stringify(result.unresolvedFindings)
  );
  assert.ok(
    result.unresolvedFindings.some((f) => f.includes('[BLOCKER]') && f.includes('S-51') && f.includes('从所有 lane 中脱落')),
    '非 lane assignee 从所有 lane 脱落无记录: ' + JSON.stringify(result.unresolvedFindings)
  );
  assert.ok(promptsBy(calls, /^gen-models-1$/)[0].includes('敌人模型'), '小写标签 [mdl] 未规范化，未进入 models 批次');
});

test('幂等守卫: bookkeep（到达 MAX_ITER）与 qa-fix 的提示词也被前置', async () => {
  const routes = [
    R(/^cr-s-01-|^sfh-s-01-/, { findings: [{ summary: 'x', severity: 'major' }] }), // 2 iteration 非 APPROVE → bookkeep 路径
    R(/^qa-play-1/, { verdict: 'CONCERNS', bugs: [{ summary: 'b', severity: 'major', assignee: 'gameplay-engineer' }], failedAcceptance: [], evidencePaths: ['qa/evidence/e.png'], screenshotsVisuallyConfirmed: true, summary: 'ng' }),
  ].concat(baseRoutes(BATCH_OK));
  const { calls } = await runWorkflow(WF, { args: ARGS, routes });
  const bookkeep = promptsBy(calls, /^bookkeep-s-01$/)[0];
  assert.ok(bookkeep, '到达 MAX_ITER 却未运行 bookkeep');
  assert.ok(bookkeep.includes('幂等守卫'), 'bookkeep 提示词未前置幂等守卫');
  const qaFix = promptsBy(calls, /^qa-fix-1-gameplay-engineer$/)[0];
  assert.ok(qaFix, 'QA CONCERNS 却未运行 qa-fix');
  assert.ok(qaFix.includes('幂等守卫'), 'qa-fix 提示词未前置幂等守卫');
});
