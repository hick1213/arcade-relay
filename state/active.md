# state/active.md — 会话交接（更新: 2026-09-03T13:31:51Z）

## 当前位置
Phase 2 QA-PLAY fix（gameplay-engineer、S-03 系）完了:
- QA 重大指摘「核心循环（晨间排班→日间接客→夜间结算→事件卡）未实现」を解消。systems/ に純逻辑を実装: `dayCycle.ts`（晨→日→夜状态机、DAY_SERVICE_DURATION_S=180s 唯一硬计时、MORNING_GUIDE_TARGET_S 超时は按钮脉冲のみ）`assignment.ts`（两次点击指派＋容量约束＋拒绝提示）`training.ts`（+1/成长阶段 3 档）`customerFlow.ts`（客人到达/点单/上菜/收钱链、耐心・小费・离店罚）`kitchen.ts`（DISH_PREP(n)・掌勺手艺短缩・采购菜种）`economy.ts`（加算/工钱 30/破产判定）`eventCard.ts`+`eventCardData.ts`（3 张垂直切片卡池・弃牌堆・AMBITION_BIAS）`ambition.ts` `runEngine.ts`（组合根）。数值は全部 `src/config.ts` へ（gdd 数值表を転写、delta 驱动）
- 显示: `ui/GameplayView.ts` 新设（相位別の布局/气泡/耐心バー/跑堂移动/夜间结算面板、判定区は InputRouter 登録）。GameScene は createInitialRun/advanceRun/handleTapEvent の接线のみに轻薄化。破产・第 20 日夜「迎战」で Result へ自動迁移
- 検証: `cd game && npm run typecheck && npm run build` exit 0＋systems 純逻辑の headless 循环シミュレーション（排班→180s 日间→13 客服务/收入 25/工钱 −30→夜间翻卡→选项→天明→翌日、破产判定発火）成功。ブラウザ实机は qa-lead の QA-PLAY で再判定
- stories.yaml: S-02/S-03/S-05/S-06/S-08/S-09 → review

## 下一步操作
CR-CODE（S-03 系 diff）→ qa-lead による QA-PLAY 再判定（10 种点击输入・HUD 数值变动・核心循环一周の再検証）→ Checkpoint B

## 未解决事项（带入下一工序）
0. 【中】S-04 志向选择未接线 — GameScene 开局は `config.AMBITION.DEFAULT_ID='wealth'`（SILVER_START 150/REP 15）の暫定。志向选择 UI と run 快照初回保存（S-14 persistence）は別 story スコープ
1. 【中】S-19 終戦演出は build スコープ — 第 20 日夜は「迎战」→ Result（runComplete 暫定経路、endingBonus 占位 0＝S-20 接线待ち）
2. 【低】gdd 未定義の実装定数を config に追加（EAT_S=6、COLLECT_S=2、ACTION_FACTOR_MIN=0.2 ガード）— game-designer へ数值確認を推挙
3. 【高】IMG-01～30 / BGM-01・02 未生成 — 全部程序化占位（引续）
4. 【中】PausePanel「结束周目」は手動経路として残置（S-08 破産自動遷移と並存。削除判断は tech-director）
5. 【低】S-15 の Result→persist 接线（S-14 スコープ）は未実施 — Result 表示値は SaveData に反映されない（引续）
6. 【低】tsc/vite の chunk size 警告（1.51MB、Phaser 本体）— 情報告知のみ（引续）
