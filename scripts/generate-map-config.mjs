import { existsSync, readFileSync, writeFileSync } from "node:fs";

const localEnvUrl = new URL("../.env.local", import.meta.url);
const envText = existsSync(localEnvUrl) ? readFileSync(localEnvUrl, "utf8") : "";
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
  process.env.KAKAO_JAVASCRIPT_KEY ||
  process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY ||
  entries.KAKAO_JAVASCRIPT_KEY ||
  entries.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY ||
  "";

if (!/^[A-Za-z0-9_-]{20,}$/.test(kakaoJavaScriptKey)) {
  throw new Error(
    "Set a valid KAKAO_JAVASCRIPT_KEY in the environment or .env.local",
  );
}

writeFileSync(
  new URL("../public/map-config.json", import.meta.url),
  `${JSON.stringify({ kakaoJavaScriptKey })}\n`,
  "utf8",
);
