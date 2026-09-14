// 1단계 게이트: 역할 배정이 옳은지 판정한다.
// 실측 근거 — 같은 역할의 인접색을 병합할 때 채널 차이는 최대 80(#6e8e20 -> --ink),
// 역할을 잘못 배정하면 187 이상(선이 먹색으로 187, 텍스트가 배경색으로 213)이다.
// 두 무리 사이인 96을 경계로 삼는다.
// 허용   = 채널당 차이 96 이하
// 불합격 = 채널당 차이 96 초과 (레이아웃 밀림, 명암 반전, 텍스트/배경 뒤바뀜)
import sharp from "sharp";

const TOLERANCE = 96;      // 채널당 허용 차이 (0-255)
const MAX_HARD_RATIO = 0.002; // 불합격 픽셀 허용 비율 0.2% (안티에일리어싱 여유)

const [, , beforePath, afterPath] = process.argv;
if (!beforePath || !afterPath) {
  console.error("사용법: node scripts/compare-shots.mjs <before.png> <after.png>");
  process.exit(2);
}

async function raw(path) {
  try {
    const img = sharp(path).ensureAlpha();
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height, ch: info.channels };
  } catch (err) {
    console.error(`이미지를 읽지 못했다: ${path} — ${err.message}`);
    process.exit(2);
  }
}

const a = await raw(beforePath);
const b = await raw(afterPath);

if (a.w !== b.w || a.h !== b.h) {
  console.error(`크기 불일치: ${a.w}x${a.h} vs ${b.w}x${b.h} — 레이아웃이 바뀌었다. 불합격`);
  process.exit(1);
}

let soft = 0, hard = 0, worst = 0;
for (let i = 0; i < a.data.length; i += a.ch) {
  let d = 0;
  for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a.data[i + c] - b.data[i + c]));
  if (d === 0) continue;
  if (d > worst) worst = d;
  if (d <= TOLERANCE) soft++; else hard++;
}

const total = a.w * a.h;
const hardRatio = hard / total;
console.log(`전체 ${total} px`);
console.log(`  허용 차이(<=${TOLERANCE}): ${soft} px (${(soft / total * 100).toFixed(2)}%)`);
console.log(`  불합격 차이(>${TOLERANCE}): ${hard} px (${(hardRatio * 100).toFixed(3)}%)`);
console.log(`  최대 채널 차이: ${worst}`);

if (hardRatio > MAX_HARD_RATIO) {
  console.error(`불합격: 큰 차이 픽셀이 ${(MAX_HARD_RATIO * 100).toFixed(1)}%를 넘는다. 역할 배정을 확인하라.`);
  process.exit(1);
}
console.log("통과");
