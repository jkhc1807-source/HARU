import type { User } from "@supabase/supabase-js";

export type AuthControlProps = {
  user: User | null;
  isLoading: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function AuthControl({ user, isLoading, onSignIn, onSignOut }: AuthControlProps) {
  if (user) {
    const name = user.user_metadata?.full_name || user.email || "로그인 사용자";
    return <details className="auth-control auth-user">
      <summary aria-label="계정 메뉴 열기">
        <span className="auth-avatar" aria-hidden="true">{name.slice(0, 1)}</span>
        <span className="auth-user-name" title={user.email}>{name}</span>
      </summary>
      <div className="auth-user-menu">
        <span title={user.email}>{user.email}</span>
        <button type="button" disabled={isLoading} onClick={onSignOut}>로그아웃</button>
      </div>
    </details>;
  }

  return <div className="auth-control">
    <button type="button" className="ghost auth-login-button" disabled={isLoading} onClick={onSignIn}>
      {isLoading ? "로그인 확인 중…" : "Google로 로그인"}
    </button>
  </div>;
}
