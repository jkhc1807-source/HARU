// OG 미리보기 이미지를 SVG 에서 PNG 로 굽는다. sharp 는 Next.js 와 함께 설치돼 있다.
import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#14150F"/>
  <rect x="76" y="250" width="510" height="92" fill="#D6FF3D"/>
  <text x="80" y="150" fill="#D6FF3D" font-family="sans-serif" font-size="28" font-weight="700" letter-spacing="6">HARU / A DAY WELL SPENT</text>
  <text x="80" y="240" fill="#FFFFFF" font-family="sans-serif" font-size="96" font-weight="800" letter-spacing="-4">오늘 어디로</text>
  <text x="92" y="326" fill="#14150F" font-family="sans-serif" font-size="96" font-weight="800" letter-spacing="-4">떠나볼까요?</text>
  <text x="80" y="420" fill="#B9B8B0" font-family="sans-serif" font-size="34" font-weight="500">취향과 시간을 고르면 하루 동선이 완성돼요</text>
  <path d="M80 520 H360" stroke="#D6FF3D" stroke-width="5" stroke-dasharray="12 12"/>
  <path d="M360 520 H640" stroke="#D6FF3D" stroke-width="5" stroke-dasharray="12 12"/>
  <circle cx="80" cy="520" r="18" fill="#D6FF3D"/>
  <circle cx="360" cy="520" r="18" fill="#D6FF3D"/>
  <circle cx="640" cy="520" r="18" fill="#D6FF3D"/>
</svg>`;

const out = "public/og.png";
await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(out);
const { size } = await import("node:fs").then(m => m.promises.stat(out));
console.log(`${out} 생성: ${Math.round(size / 1024)}KB`);
if (size > 200 * 1024) { console.error("200KB 초과. 색 수를 줄이거나 요소를 단순화하라."); process.exit(1); }
