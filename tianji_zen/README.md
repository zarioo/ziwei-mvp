# tianji_zen

`tianji_zen` 是 `src/app/ios-demo` 的 Flutter iOS 客户端重构版本。

当前首版能力：

- `Home`：出生信息录入、调用 `/api/ziwei/natal` 排盘、查看命盘摘要和 12 宫盘面
- `Script`：按大限拼接 payload，调用 `/api/llm-json` 和 `/api/ai/chat/stream` 生成人生剧本
- `Chat`：生成命盘 JSON、管理历史会话、流式接收 AI 回答、支持手动追加文本附件

## 本地运行

先在仓库根目录启动 Next.js 服务：

```bash
npm run dev
```

再启动 Flutter App：

```bash
cd tianji_zen
flutter run
```

## 真机安装

1. 用 Xcode 打开 [ios/Runner.xcworkspace](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/tianji_zen/ios/Runner.xcworkspace)
2. 选择你的开发者 Team，并确认 Bundle Identifier 可签名
3. 在 App 首页右上角设置 API 地址
4. 真机不要使用 `http://127.0.0.1:3000`，请改成你电脑的局域网地址，例如 `http://192.168.1.10:3000`
5. 连接 iPhone 后运行 `Runner`

## 检查命令

```bash
flutter analyze
flutter test
```
