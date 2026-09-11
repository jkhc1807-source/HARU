"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Stats = { userCount: number; newUsersThisWeek: number; tripCount: number; favoriteCount: number; blockedCount: number };
type AdminUser = { id: string; email: string; displayName: string; role: string; isBlocked: boolean; createdAt: string; tripCount: number };

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUserId, setPendingUserId] = useState("");

  const authorizedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase 설정이 필요해요");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Google로 먼저 로그인해주세요");
    const response = await fetch(path, {
      ...init,
      headers: { ...init?.headers, authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "요청을 처리하지 못했어요");
    return payload;
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsPayload, usersPayload] = await Promise.all([
        authorizedFetch("/api/admin/stats"),
        authorizedFetch("/api/admin/users"),
      ]);
      setStats(statsPayload);
      setUsers(usersPayload.users);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "요청을 처리하지 못했어요");
    } finally {
      setIsLoading(false);
    }
  }, [authorizedFetch]);

  useEffect(() => { void load(); }, [load]);

  async function handleToggleBlock(user: AdminUser) {
    const nextBlocked = !user.isBlocked;
    if (!window.confirm(`${user.email} 계정을 ${nextBlocked ? "차단" : "차단 해제"}할까요?`)) return;
    setPendingUserId(user.id);
    try {
      await authorizedFetch("/api/admin/users/block", { method: "POST", body: JSON.stringify({ userId: user.id, isBlocked: nextBlocked }) });
      setUsers(current => current.map(item => item.id === user.id ? { ...item, isBlocked: nextBlocked } : item));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "계정 상태를 바꾸지 못했어요");
    } finally {
      setPendingUserId("");
    }
  }

  return <main className="admin-page">
    <h1>하루여행 관리자</h1>
    <p className="admin-note">가입자 통계와 계정 상태만 볼 수 있어요. 사용자의 출발지 주소와 일정 내용은 표시하지 않아요.</p>
    {errorMessage && <p className="admin-error" role="alert">{errorMessage}</p>}
    {isLoading && <p role="status">불러오는 중이에요…</p>}

    {stats && <ul className="admin-stats">
      <li><b>{stats.userCount}</b><span>전체 가입자</span></li>
      <li><b>{stats.newUsersThisWeek}</b><span>최근 7일 가입</span></li>
      <li><b>{stats.tripCount}</b><span>저장된 일정</span></li>
      <li><b>{stats.favoriteCount}</b><span>즐겨찾기 출발지</span></li>
      <li><b>{stats.blockedCount}</b><span>차단된 계정</span></li>
    </ul>}

    {users.length > 0 && <div className="admin-table-wrap">
      <table className="admin-table">
        <caption>가입 계정 목록 (최근 100개)</caption>
        <thead>
          <tr><th scope="col">이메일</th><th scope="col">이름</th><th scope="col">권한</th><th scope="col">일정 수</th><th scope="col">가입일</th><th scope="col">상태</th></tr>
        </thead>
        <tbody>
          {users.map(user => <tr key={user.id} className={user.isBlocked ? "blocked" : ""}>
            <td>{user.email}</td>
            <td>{user.displayName || "—"}</td>
            <td>{user.role === "admin" ? "관리자" : "일반"}</td>
            <td>{user.tripCount}</td>
            <td>{new Date(user.createdAt).toLocaleDateString("ko-KR")}</td>
            <td>
              <button type="button" aria-label={`${user.email} 계정 ${user.isBlocked ? "차단 해제" : "차단"}`} disabled={pendingUserId === user.id} onClick={() => handleToggleBlock(user)}>
                {pendingUserId === user.id ? "처리 중…" : user.isBlocked ? "차단 해제" : "차단"}
              </button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>}

    <p className="admin-back"><a href="/">하루여행으로 돌아가기</a></p>
  </main>;
}
