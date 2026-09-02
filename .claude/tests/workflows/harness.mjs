// Workflow DSL 桩 harness — 在注入全局对象（agent/parallel/pipeline/
// phase/log/args/budget）的桩之下完整执行 .claude/workflows/*.js。
//
// 验证对象仅限「脚本自行决定的部分」: 提示词接线、分支、上报累积、
// lane 分配。不复现真实 Workflow 运行时的行为（缓存、并行上限、schema 强制重试）。
// parallel 在桩中也与 DSL 一样「把异常压成 null」（thunk 抛出也不会崩）。
//
// 执行: node --test .claude/tests/workflows/*.test.mjs（指定目录在 Node 24 下会 MODULE_NOT_FOUND — 必须用 glob）
import { readFile } from 'node:fs/promises';

// 从 JSON Schema 合成最小的合法值（仅 required、enum 取首个值、boolean 为 false —
// 以免默认触发 budgetExceeded/overBudget 等「true = 异常」标志）
export function fromSchema(schema) {
  if (!schema || !schema.type) return 'ok';
  switch (schema.type) {
    case 'object': {
      const o = {};
      for (const k of (schema.required || [])) o[k] = fromSchema((schema.properties || {})[k]);
      return o;
    }
    case 'array': return [];
    case 'string': return schema.enum ? schema.enum[0] : 'x';
    case 'number': return 0;
    case 'boolean': return false;
    default: return 'x';
  }
}

// routes: [{ match: RegExp(label), reply: object | (call) => object }] — 先匹配者优先。
// 不匹配时返回 fromSchema(opts.schema) 的默认响应。
export async function runWorkflow(path, { args, routes = [] } = {}) {
  const src = await readFile(path, 'utf8');
  const body = src.replace(/^export const meta/m, 'const meta');
  const calls = [];
  const logs = [];
  const phases = [];

  async function agent(prompt, opts = {}) {
    const call = { label: String(opts.label || ''), prompt: String(prompt), opts };
    calls.push(call);
    for (const r of routes) {
      if (r.match.test(call.label)) {
        const v = typeof r.reply === 'function' ? r.reply(call) : r.reply;
        return v === null ? null : structuredClone(v);
      }
    }
    return fromSchema(opts.schema);
  }
  const parallel = (thunks) => Promise.all(
    thunks.map(async (t) => { try { return await t(); } catch { return null; } })
  );
  const pipeline = async (items, ...stages) => {
    const out = [];
    let i = 0;
    for (const item of items) {
      let v = item;
      try { for (const s of stages) v = await s(v, item, i); } catch { v = null; }
      out.push(v); i++;
    }
    return out;
  };
  const phase = (t) => { phases.push(String(t)); };
  const log = (m) => { logs.push(String(m)); };
  const budget = { total: null, spent: () => 0, remaining: () => Infinity };

  const fn = new Function(
    'agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget',
    '"use strict"; return (async () => {\n' + body + '\n})();'
  );
  const result = await fn(agent, parallel, pipeline, phase, log, args, budget);
  return { result, calls, logs, phases };
}

export const callsBy = (calls, re) => calls.filter((c) => re.test(c.label));
export const promptsBy = (calls, re) => callsBy(calls, re).map((c) => c.prompt);
