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
    return <div className="auth-control auth-user">
      <span title={user.email}>{name}</span>
      <button type="button" className="ghost secondary" disabled={isLoading} onClick={onSignOut}>로그아웃</button>
    </div>;
  }

  return <div className="auth-control">
    <button type="button" className="ghost auth-login-button" disabled={isLoading} onClick={onSignIn}>
      {isLoading ? "로그인 확인 중…" : "Google로 로그인"}
    </button>
  </div>;
}
