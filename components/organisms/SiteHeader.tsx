import type { ReactNode } from "react";

export function SiteHeader({ children }: { children: ReactNode }) {
  return <header className="topbar">
    <div className="brand">
      <span className="brand-mark" aria-hidden="true"><i /></span>
      <span className="brand-word"><b>하루</b>여행</span>
      <small>하루가 가벼워지는 여행 플래너</small>
    </div>
    <div className="topbar-actions">{children}</div>
  </header>;
}
