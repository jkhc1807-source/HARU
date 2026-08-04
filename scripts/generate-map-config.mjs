import { readFileSync, writeFileSync } from "node:fs";

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const entries = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.trimStart().startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
);

const kakaoJavaScriptKey =
  entries.KAKAO_JAVASCRIPT_KEY || entries.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY || "";

if (!/^[A-Za-z0-9_-]{20,}$/.test(kakaoJavaScriptKey)) {
  throw new Error("A valid Kakao JavaScript key is required in .env.local");
}

writeFileSync(
  new URL("../public/map-config.json", import.meta.url),
  `${JSON.stringify({ kakaoJavaScriptKey })}\n`,
  "utf8",
);
