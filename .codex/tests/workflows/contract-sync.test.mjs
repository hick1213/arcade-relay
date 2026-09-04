// contract §8 的资产 ID 类型、状态词汇与 workflow 脚本内手写复述的机械同步验证（TODOS W-3）。
// workflow 脚本无法读取文件（contract §4），因此单一事实来源化由本测试承担:
// 当 contract §8 新增类型、变更词汇时，若脚本的 ASSET_TAG / MODEL_WORDS / 标签指示
// 未跟进，会在此处失败（防止静默的分派漂移）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url).pathname; // .codex/
const read = (p) => readFile(root + p, 'utf8');

test('W-3: contract §8 的资产 ID 类型全部出现在 full-build.js 的标签判定、标签指示中', async () => {
  const contract = await read('docs/contract.md');
  const assetLine = contract.split('\n').find((l) => l.includes('资产:') && l.includes('IMG-01'));
  assert.ok(assetLine, '找不到 contract §8 的资产 ID 行');
  const kinds = [...new Set([...assetLine.matchAll(/`([A-Z]{2,4})-01`/g)].map((m) => m[1]))];
  assert.ok(kinds.length >= 5, '无法从 contract §8 解析资产 ID 类型: ' + JSON.stringify(kinds));

  const src = await read('workflows/full-build.js');
  const tag = src.match(/const ASSET_TAG = \/(.+?)\/[a-z]*;/);
  assert.ok(tag, 'full-build.js 中没有 ASSET_TAG');
  for (const k of kinds) {
    assert.ok(tag[1].includes(k), 'ASSET_TAG 不包含 contract §8 的类型 ' + k + '（contract 变更后脚本未跟进）');
  }
  const mw = src.match(/const MODEL_WORDS = \/(.+?)\/[a-z]*;/);
  assert.ok(mw && mw[1].includes('MDL-') && mw[1].includes('ANM-'), 'MODEL_WORDS（词汇 fallback）不包含 MDL-/ANM-');
  // Replan 提示词的标签指示列举了 §8 的全部类型（由解析出的 kinds 派生 —
  // 若用固定字面量，contract 新增类型后标签指示的旧列举会被放过）
  const tagInstr = src.match(/在 title 开头加上资产类型标签 ([^（]+)（contract §8/);
  assert.ok(tagInstr, 'Replan 提示词中找不到标签指示文');
  for (const k of kinds) {
    assert.ok(tagInstr[1].includes('[' + k + ']'), 'Replan 标签指示未列举 contract §8 的类型 ' + k);
  }
});

test('license_note 的转记必需规范已接线到两个 workflow 的生成提示词与 FullQA 审计', async () => {
  // assets-config.md「Provenance」将 license_note 设为必需 — 生成 agent 遵循提示词的
  // 字段列举，因此一旦从列举中消失，记录与审计都会静默变空（防止审计问题6再发）
  const cfg = await read('docs/assets-config.md');
  assert.ok(cfg.includes('license_note'), 'assets-config.md 中的 license_note 规范已消失');
  const fb = await read('workflows/full-build.js');
  assert.ok((fb.match(/license_note/g) || []).length >= 2, 'full-build.js 的生成提示词/审计中没有 license_note 接线');
  const proto = await read('workflows/prototype.js');
  assert.ok(proto.includes('license_note'), 'prototype.js 的生成提示词中没有 license_note 接线');
});

test('视觉证据的 SUSPECT_LOW_CONTRAST 阈值在 gates.md 与两个 workflow 提示词中一致', async () => {
  const gates = await read('docs/gates.md');
  const g = gates.match(/低于 ([0-9.]+) 视为低对比度疑似（SUSPECT_LOW_CONTRAST）/);
  assert.ok(g, '无法解析 gates.md 的 SUSPECT_LOW_CONTRAST 阈值行');
  const threshold = g[1];
  for (const f of ['workflows/full-build.js', 'workflows/prototype.js']) {
    const src = await read(f);
    assert.ok(src.includes('stddev < ' + threshold + ' = SUSPECT_LOW_CONTRAST'),
      f + ' 的 QA 提示词阈值与 gates.md（' + threshold + '）漂移');
  }
});

test('W-3: contract §8 的资产状态词汇（5值）与脚本的复述一致', async () => {
  const contract = await read('docs/contract.md');
  const m = contract.match(/资产状态词汇（仅此5值）: `([^`]+)`/);
  assert.ok(m, '无法解析 contract §8 的状态词汇行');
  const vocab = m[1].split('|').map((s) => s.trim());
  // canary: 词汇变更时在此失败，促使下方的复述处（手写 must-replace / rejected 的
  // Replan/AssetGen 提示词）跟进
  assert.deepEqual([...vocab].sort(), ['approved', 'generated', 'must-replace', 'planned', 'rejected'].sort(),
    'contract §8 的状态词汇已变更 — 请让 workflow 脚本的手写复述（must-replace/rejected）跟进');
  // 重新生成触发器（状态变更为 must-replace / rejected）的复述由 full-build.js（Replan/AssetGen）持有
  const fb = await read('workflows/full-build.js');
  assert.ok(fb.includes('must-replace') && fb.includes('rejected'),
    'full-build.js 的状态词复述（must-replace/rejected）已消失 — 重新生成触发器规范的退化');
  const proto = await read('workflows/prototype.js');
  assert.ok(proto.includes('must-replace'),
    'prototype.js 的 must-replace 复述（fallback 降级的状态规范）已消失');
});
