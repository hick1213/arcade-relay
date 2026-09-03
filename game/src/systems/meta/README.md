/**
 * 元进度逻辑（引擎无关层 — contract §11）。
 * 计划模块: metaTypes.ts（按版本区分的普通类型）/ metaSchema.ts（迁移函数链+验证）/
 * metaProgression.ts（接收 RunResult 返回新 SaveData 的纯 reducer）。
 * 禁止 import Phaser、禁止引用 localStorage。I/O 一律经 src/persistence/。
 */
