export const dynamic = "force-dynamic";

export async function GET() {
  const kakaoJavaScriptKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY || "";
  return Response.json(
    { kakaoJavaScriptKey },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
