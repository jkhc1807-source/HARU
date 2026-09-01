"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const hasExchangedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (hasExchangedRef.current) return;
    hasExchangedRef.current = true;
    const code = new URLSearchParams(window.location.search).get("code");
    const supabase = getSupabaseBrowserClient();
    if (!code || !supabase) {
      setErrorMessage("로그인을 완료하지 못했어요. 홈으로 돌아가 다시 시도해주세요.");
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setErrorMessage("로그인을 완료하지 못했어요. 홈으로 돌아가 다시 시도해주세요.");
      else window.location.replace("/");
    });
  }, []);

  return <main className="auth-callback">
    <h1>{errorMessage ? "로그인에 실패했어요" : "로그인을 완료하고 있어요…"}</h1>
    {errorMessage && <><p role="alert">{errorMessage}</p><a href="/">홈으로 돌아가기</a></>}
  </main>;
}
