import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const kakaoJavaScriptKey = runtimeEnv.KAKAO_JAVASCRIPT_KEY || "";
  return Response.json(
    { kakaoJavaScriptKey },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
