/**
 * 持久化 I/O 层（唯一允许引用 localStorage 的层 — tech-stack.md 规范 9）。
 * SaveAdapter 实现于此; systems/ scenes/ ui/ 不得直接调用 localStorage。
 * 键: SAVE_KEY（arcaderelay-save）。损坏协议: .bak 备份 + [SaveCorruption] 日志 1 次 + 默认值重建 + recovered 传播。
 */
