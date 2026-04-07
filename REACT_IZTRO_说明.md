# react-iztro 组件原理说明

## 📚 文档位置

### 1. 官方文档和源码
- **GitHub 仓库**: https://github.com/SylarLong/react-iztro
- **官方文档**: https://docs.iztro.com
- **npm 包**: https://www.npmjs.com/package/react-iztro

### 2. 本地代码位置
项目中的 react-iztro 代码位于：
```
node_modules/react-iztro/
├── lib/                    # 编译后的 JavaScript 代码
│   ├── Iztrolabe/         # 主组件（星盘容器）
│   ├── Izpalace/          # 宫位组件（显示单个宫位）
│   ├── Izstar/            # 星曜组件（显示单个星曜）
│   └── IzpalaceCenter/    # 中宫组件（显示中心信息）
├── README.md              # 使用说明
└── package.json           # 包信息
```

## 🔍 工作原理（简化版）

### 整体流程
```
用户输入（生日、时辰、性别）
    ↓
iztro 库计算星盘数据
    ↓
iztro-hook 提供 React Hook（useIztro）
    ↓
react-iztro 组件渲染星盘界面
```

### 核心依赖关系
1. **iztro** - 核心计算库，负责：
   - 根据生日时辰计算星盘
   - 生成十二宫数据
   - 计算星曜位置
   - 处理国际化（i18n）

2. **iztro-hook** - React Hook 封装，提供：
   - `useIztro()` Hook
   - 自动处理星盘数据更新
   - 处理运限（大限、流年等）

3. **react-iztro** - React 组件，负责：
   - 渲染星盘 UI
   - 显示宫位、星曜
   - 处理用户交互

## 🎯 宫位名称显示原理

### 问题：为什么显示"仆役"而不是"交友"？

**原因分析：**

1. **数据生成阶段**（iztro 库）
   - iztro 库在生成星盘数据时，会使用 i18n（国际化）系统
   - 宫位名称的 key 是 `friendsPalace`
   - 在 `node_modules/iztro/lib/i18n/locales/zh-CN/palace.js` 中定义：
     ```javascript
     friendsPalace: '仆役'  // 默认翻译
     ```
   - iztro 生成数据时，会把 `friendsPalace` 翻译成 `"仆役"`，并存储在 `palace.name` 中

2. **组件渲染阶段**（react-iztro）
   - `Izpalace` 组件直接显示 `palace.name`
   - 代码位置：`node_modules/react-iztro/lib/Izpalace/Izpalace.js` 第 166 行
   ```javascript
   palace.name  // 直接显示，已经是"仆役"字符串了
   ```

### 解决方案

**方案 1：修改 i18n 资源（推荐）**
在生成星盘数据之前修改翻译资源：

```typescript
import iztroI18n from "iztro/lib/i18n";

// 在组件加载时修改
useEffect(() => {
  // 使用 i18next 的 addResource 方法覆盖翻译
  iztroI18n.default.addResource("zh-CN", "translation", "friendsPalace", "交友");
}, []);
```

**方案 2：修改生成后的数据**
在数据生成后，遍历修改 palace.name：

```typescript
// 在 useIztro 返回的数据中修改
if (astrolabe?.palaces) {
  astrolabe.palaces.forEach(palace => {
    if (palace.name === "仆役") {
      palace.name = "交友";
    }
  });
}
```

## 📖 如何阅读源码

### 1. 从入口开始
查看 `src/app/pan/page.tsx`：
- 这是你项目中使用 react-iztro 的地方
- 可以看到如何传入参数给 `Iztrolabe` 组件

### 2. 理解组件结构
```
Iztrolabe（星盘容器）
  ├── Izpalace（12个宫位组件，循环渲染）
  │     ├── Izstar（星曜组件，显示主星、辅星）
  │     └── 宫位名称显示（palace.name）
  └── IzpalaceCenter（中宫，显示运限控制）
```

### 3. 关键文件说明

**Iztrolabe.js** - 主组件
- 使用 `useIztro` Hook 获取星盘数据
- 管理运限显示状态（大限、流年等）
- 渲染 12 个宫位组件

**Izpalace.js** - 宫位组件
- 接收 `palace` 对象作为 props
- 显示宫位名称：`palace.name`（第 166 行）
- 显示星曜列表
- 显示运限信息

**Izstar.js** - 星曜组件
- 显示单个星曜的名称、亮度、四化等

## 🔧 修改建议

### 当前实现的问题
你的代码中使用了 `iztroI18n.addResource`，但这个方法可能不存在或不起作用。

### 正确的修改方式

查看 `node_modules/iztro/lib/i18n/index.js`，iztro 使用的是 `i18next` 库。

**方法 1：直接修改 i18next 实例**
```typescript
import iztroI18n from "iztro/lib/i18n";

useEffect(() => {
  // i18next 的 addResource 方法
  iztroI18n.default.addResourceBundle(
    "zh-CN",
    "translation",
    { friendsPalace: "交友" },
    true, // 合并模式
    true  // 覆盖已存在的
  );
}, []);
```

**方法 2：在生成数据前修改**
```typescript
import { setLanguage } from "iztro/lib/i18n";
import iztroI18n from "iztro/lib/i18n";

// 在生成星盘前修改
useEffect(() => {
  // 修改翻译资源
  iztroI18n.default.addResourceBundle(
    "zh-CN",
    "translation",
    { friendsPalace: "交友" },
    true,
    true
  );
}, []);
```

## 💡 你能看懂吗？

### 难度评估
- **基础部分**（组件使用）：⭐⭐ 简单
  - 只需要知道如何传参数给组件
  - 类似使用其他 React 组件

- **中级部分**（理解数据流）：⭐⭐⭐ 中等
  - 需要理解 React Hooks
  - 需要理解数据如何从 iztro 传递到组件

- **高级部分**（修改源码）：⭐⭐⭐⭐ 较难
  - 需要理解 i18n 系统
  - 需要理解组件内部实现
  - 可能需要修改 node_modules（不推荐）

### 学习建议
1. **先看 README**：`node_modules/react-iztro/README.md`
2. **看使用示例**：你的 `src/app/pan/page.tsx` 就是很好的例子
3. **理解数据流**：从输入 → iztro 计算 → 组件渲染
4. **逐步深入**：先理解组件如何使用，再理解内部实现

## 🐛 调试技巧

### 查看生成的数据
```typescript
const { astrolabe } = useIztro({...});
console.log("星盘数据：", astrolabe);
console.log("宫位数据：", astrolabe?.palaces);
```

### 查看 i18n 翻译
```typescript
import { t } from "iztro/lib/i18n";
console.log("friendsPalace 翻译：", t("friendsPalace"));
```

## 📝 总结

1. **react-iztro** 是一个 React 组件，用于显示紫微斗数星盘
2. **数据来源**：iztro 库计算生成
3. **显示逻辑**：组件直接显示 `palace.name`，这个值在数据生成时就已经确定了
4. **修改方法**：需要在数据生成前修改 i18n 翻译资源
5. **代码位置**：主要在 `node_modules/react-iztro/lib/` 目录下

希望这个说明能帮助你理解 react-iztro 的工作原理！如果有具体问题，可以继续提问。

