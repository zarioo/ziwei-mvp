/**
 * 这个页面是入口页，负责引导用户进入排盘页面。
 */
export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>紫微斗数排盘 MVP</h1>
      <p style={{ marginBottom: 12 }}>
        请前往排盘页面进行出生信息输入与结果展示。
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        <a href="/ios-demo">进入 iOS App Demo</a>
        <a href="/pan">进入接口排盘</a>
        <a href="/pan-iztro">进入iztro排盘</a>
      </div>
    </main>
  );
}
