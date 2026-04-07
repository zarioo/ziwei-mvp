import Link from "next/link";
import styles from "./PanShell.module.css";

type PanShellProps = {
  active: "api" | "iztro";
  children: React.ReactNode;
};

export default function PanShell({ active, children }: PanShellProps) {
  // 这个壳组件负责左侧导航和页面结构，便于两种排盘方式对比
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>紫微排盘</div>
        <nav className={styles.nav}>
          <Link
            className={`${styles.link} ${
              active === "api" ? styles.active : ""
            }`}
            href="/pan"
          >
            接口排盘
          </Link>
          <Link
            className={`${styles.link} ${
              active === "iztro" ? styles.active : ""
            }`}
            href="/pan-iztro"
          >
            iztro排盘
          </Link>
        </nav>
        <p className={styles.note}>
          说明：接口排盘走后端计算，iztro排盘走前端直算，方便对比。
        </p>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}

