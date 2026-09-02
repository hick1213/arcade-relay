// concept-design.js 的分支、接线测试（DSL 桩 harness）
// 审计跟进（2026-07-29）: 消除 CD-CHECKPOINT REJECT 时单个 fix 失败无记录的问题（fixResults zip）
import test from 'node:test';
import assert from 'node:assert/strict';
import { runWorkflow, callsBy } from './harness.mjs';

const WF = new URL('../../workflows/concept-design.js', import.meta.url).pathname;
const ARGS = { briefPath: 'design/brief.md', reviewMode: 'lean', engine: 'phaser' };
const R = (match, reply) => ({ match, reply });

test('happy path: 全部 Gate 默认 APPROVE 时无 unresolved，4个 Gate 载入 verdictHistory', async () => {
  const { result, calls } = await runWorkflow(WF, { args: ARGS, routes: [] });
  assert.equal(result.verdict, 'APPROVE');
  assert.deepEqual(result.unresolvedFindings, [], JSON.stringify(result.unresolvedFindings));
  const gates = result.verdictHistory.map((v) => v.gate);
  for (const g of ['DR-CONCEPT', 'DR-GDD', 'AR-BIBLE', 'CD-CHECKPOINT']) {
    assert.ok(gates.includes(g), g + ' 不在 verdictHistory 中');
  }
  assert.equal(callsBy(calls, /^CD-CHECKPOINT 重新判定/).length, 0, 'APPROVE 却执行了重新判定');
});

test('CD REJECT: 单个 fix 的失败带指示内容载入 unresolvedFindings（成功的不载入）', async () => {
  const routes = [
    R(/^CD-CHECKPOINT 判定/, {
      verdict: 'REJECT', findings: ['骨架薄弱'], fixes: [
        { assignee: 'game-designer', artifact: 'design/concept.md', instruction: '将支柱缩减为3个' },
        { assignee: 'art-director', artifact: 'design/art-bible.md', instruction: '使调色板机器可读' },
      ],
    }),
    R(/^CD修正: design\/concept\.md/, null), // 前缀匹配 = 带 '-retry' 的 label 也返回 null（agentR 两次 null）
    R(/^CD-CHECKPOINT 重新判定/, { verdict: 'CONCERNS', findings: [], fixes: [] }),
  ];
  const { result, calls } = await runWorkflow(WF, { args: ARGS, routes });
  assert.ok(
    result.unresolvedFindings.some((f) =>
      f.includes('CD-CHECKPOINT: 修正指示「[game-designer] design/concept.md — 将支柱缩减为3个」的 fix agent 失败')),
    'fix 失败无记录: ' + JSON.stringify(result.unresolvedFindings)
  );
  assert.ok(
    !result.unresolvedFindings.some((f) => f.includes('design/art-bible.md — 使调色板')),
    '成功的 fix 也被记录为失败'
  );
  assert.equal(callsBy(calls, /^CD修正的处理记录/).length, 1, 'fix 后的处理记录 agent 未执行');
  assert.equal(result.verdict, 'CONCERNS', '重新判定的结果未被反映');
});
