# 人生剧本评分引擎 V2

## 入口
- 评分引擎主入口：[`src/services/life-script/index.ts`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/src/services/life-script/index.ts)
- HTTP 入口：[`src/app/api/ziwei/life-script/route.ts`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/src/app/api/ziwei/life-script/route.ts)

## 调用方式
1. 前端点击 `/pan` 页的“生成人生剧本”按钮。
2. 后端先固定生成完整 9 段大限的 canonical fortune JSON。
3. 再把这份 JSON 送入 `generateLifeScript()`。
4. 最终保存两份文件：
   - `*-fortune.json`：评分引擎正式输入源
   - `*-life-script.json`：评分结果

## 结果结构
- `scores`：5 个维度在 9 个 decade 上的分数
- `rankings`：每个维度的 decade 排名
- `time_axis`：每段 decade 的时间轴
- `preview_summary`：后端直接生成的付费前摘要
- `llm_facts`：只给后续大模型扩写，不允许它重新计算
- `debug_trace`：可审计的完整计算过程，仅在 `debug=true` 时返回
- `debug_markdown`：给人工核对用的调试报告，仅在 `debug=true` 时返回

## debug 模式
- 默认 `debug=false`：只返回正式业务结果
- 传入 `debug=true`：额外返回
  - `debug_trace.input_snapshot`
  - `debug_trace.per_decade`
  - `debug_trace.rankings_trace`
  - `debug_trace.summary_trace`
  - `debug_markdown`

`debug_trace` 的目标不是替代源码，而是让你在不打开代码的前提下，也能逐段核对：
- 哪些宫位参与了每个维度计算
- triad 实际引用了哪几座静态宫
- 每个单宫的 5 个模块分别贡献了多少
- 生年四化、大限四化、风险提示分别贡献了多少
- 维度 raw、风险修正、归一化比例、45~100 展示分怎样变化
- ranking 和 preview_summary 为什么会得出当前结果

## 计算公式
- 单宫原始分 = 主星模块分 + 辅星模块分 + 静态修正模块分 + 生年四化修正分 + 大限四化修正分
- 维度原始分 = 主宫/辅宫/三方四正/身宫修正后的加权和
- 维度最终 raw = 维度原始分 + 风险提示修正分
- 展示分 = `45 + ((raw - 该维度下限) / (该维度上限 - 该维度下限)) × 55`
- 最终展示分会 `clamp` 到 `45~100`

主星模块的细则：
- 单颗主星分 = 主星基础分 × 状态系数 × 宫位适配系数
- 主星模块分 = 所有主星单星分平均值 × `(1 + 0.10 × (主星数 - 1))`
- 再按维度模块上限截顶

辅星模块的细则：
- 吉辅与煞曜统一进入辅星模块
- 单颗辅星分 = 辅星基础分 × 状态系数 × 宫位适配系数
- 辅星模块分 = 所有辅星分相加，再按维度模块上限截顶

静态修正模块的细则：
- 静态修正模块 = 小星/杂曜 + 十二长生 + 神煞
- 再整体截在 `-5 ~ +5`

## 规则文件
- [`config/life-script/dimension-weights.yaml`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/config/life-script/dimension-weights.yaml)
  控制五大维度主宫、辅宫、三方、身宫、模块上限与每个维度自己的 raw 区间
- [`config/life-script/star-base-scores.yaml`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/config/life-script/star-base-scores.yaml)
  控制主星 × 维度基础分
- [`config/life-script/star-state-coeff.yaml`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/config/life-script/star-state-coeff.yaml)
  控制庙旺平陷系数
- [`config/life-script/palace-affinity.yaml`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/config/life-script/palace-affinity.yaml)
  控制主星/辅星 × 宫位适配系数
- [`config/life-script/helper-stars.yaml`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/config/life-script/helper-stars.yaml)
  控制正向辅星基础分
- [`config/life-script/malefic-stars.yaml`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/config/life-script/malefic-stars.yaml)
  控制负向辅星基础分
- [`config/life-script/changsheng.yaml`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/config/life-script/changsheng.yaml)
  控制十二长生修正
- [`config/life-script/misc-gods.yaml`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/config/life-script/misc-gods.yaml)
  同时控制小星/杂曜与神煞修正
- [`config/life-script/transformations.yaml`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/config/life-script/transformations.yaml)
  分别控制生年四化与大限四化的固定修正值
- [`config/life-script/risk-alert.yaml`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/config/life-script/risk-alert.yaml)
  控制“冲本命某宫”在不同维度上的风险查表修正
- [`config/life-script/normalization.yaml`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/config/life-script/normalization.yaml)
  控制统一展示区间，当前是 `45~100`
- [`config/life-script/summary-templates.yaml`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/config/life-script/summary-templates.yaml)
  控制摘要文案模板

## 如何改参数
- 想调某颗主星在某个维度更强或更弱：改 `star-base-scores.yaml`
- 想调同一颗星在某个宫更适合或更不适合：改 `palace-affinity.yaml`
- 想调某个维度的 raw 上下限：改 `dimension-weights.yaml` 里该维度的 `normalization`
- 想调整体展示区间：改 `normalization.yaml`
- 想调主星/辅星模块截顶力度：改 `dimension-weights.yaml` 里的 `module_caps`
- 想调四化影响力度：改 `transformations.yaml`
- 想调风险提示的惩罚力度：改 `risk-alert.yaml`

## 如何新增星曜
1. 先在 [`src/services/life-script/constants.ts`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/src/services/life-script/constants.ts) 的 `STAR_ZH_TO_KEY` 增加映射。
2. 如果它是辅星或凶曜，也同步加入 `HELPER_STAR_KEYS` 或 `MALEFIC_STAR_KEYS`。
3. 再到对应 YAML 增加分值配置。
4. 如果它走辅星模块，还要补 `helper-stars.yaml` 或 `malefic-stars.yaml`，以及需要的 `palace-affinity.yaml`。
5. 如果它属于小星/杂曜或神煞修正，则补 `misc-gods.yaml`。

## 示例
```bash
npm run test
curl -X POST http://localhost:3000/api/ziwei/life-script \
  -H "Content-Type: application/json" \
  -d '{"calendar":"solar","date":"1984-7-24","timeIndex":6,"gender":"女","language":"zh-CN","fileBaseName":"demo-fortune"}'
```
