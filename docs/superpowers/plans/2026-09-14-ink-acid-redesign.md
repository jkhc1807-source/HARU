# 먹·애시드 디자인 개편 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하드코딩된 380개 색을 29개 토큰으로 정리한 뒤, 그 위에 먹·애시드 시각 언어를 적용하고 모바일 구조와 브랜드 자산을 함께 개편한다.

**Architecture:** 2단계로 진행한다. 1단계는 색값을 유지한 채 토큰으로 치환하고 픽셀 비교로 역할 배정이 옳은지 검증한다. 2단계는 토큰 값 11개를 교체하고 컴포넌트·타이포·모션·브랜드 자산을 바꾼다. 색의 역할은 CSS 속성(`color:`, `border*:`, `background*:`)으로 기계적으로 판정하므로 380개를 손으로 분류하지 않는다.

**Tech Stack:** Next.js 16 (App Router) / vinext 0.0.50 / React 19 / 순수 CSS / `sharp`(이미 설치됨, Next.js 동봉) / chrome-devtools MCP

**Spec:** `docs/superpowers/specs/2026-09-14-ink-acid-redesign-design.md`

## Global Constraints

- **새 npm 의존성을 추가하지 않는다.** 픽셀 비교는 이미 설치된 `sharp`를 쓴다.
- Tailwind·SCSS 등 새 스타일 체계를 도입하지 않는다. 순수 CSS를 유지한다.
- **기능 로직을 일절 변경하지 않는다.** 출발지, 즐겨찾기, 일정 생성·저장·공유, 관리자 권한, 카카오 검색, Supabase 동기화는 손대지 않는다.
- **기존 CSS 클래스명을 유지한다.** `tests/rendered-html.test.mjs`가 `header-main-actions`, `header-more-actions`, `discovery-header`, `place-category-icon`, `stop-actions`, `between-stops`, `spot-editor`, `spot-actions-footer` 클래스와 한글 문구를 검사한다. 클래스명을 바꾸면 테스트가 깨진다. 마크업 변경은 Task 7(히어로)에 한정한다.
- 모든 UI 문구는 한국어다.
- **12px 미만 글씨 금지.** `--t-micro: 12px`가 하한이다.
- **`--acid`를 밝은 배경 위 글자색으로 쓰지 않는다.** 대비 1.15로 보이지 않는다. 면으로만 쓴다.
- 터치 타깃 최소 44px (`--tap`).
- 320·390·768·1440px에서 가로 넘침 0.
- `prefers-reduced-motion: reduce`를 존중한다.
- 검증 명령: `npx tsc --noEmit`, `npm test`(vinext build + 테스트 19개), `npx next build`(Vercel 배포 경로).
- 작업 브랜치는 `redesign/ink-acid`. `main`에 병합하지 않는다.
- 복원 지점: `design-before-2026-09-14` 태그.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `app/tokens.css` (신규) | 29개 토큰 정의. 앞으로 색을 바꿀 때 만지는 유일한 파일 |
| `app/globals.css` (수정) | `tokens.css` import, 토큰 사용, 컴포넌트 스타일 |
| `app/page.tsx` (수정) | 히어로 마크업, 아이콘 stroke, 모션 클래스 |
| `app/layout.tsx` (수정) | 파비콘 연결 |
| `app/icon.svg` (신규) | 파비콘. Next.js가 자동 링크 |
| `lib/trip-image.ts` (수정) | 일정 이미지 팔레트 동기화 |
| `scripts/compare-shots.mjs` (신규) | 픽셀 비교. 1단계 게이트 |
| `scripts/audit-ui.mjs` (신규) | 브라우저 주입용 감사 스크립트 문자열 |
| `scripts/make-og.mjs` (신규) | OG 이미지 SVG → PNG 생성 |
| `public/og.png` (교체) | 2.4MB → 200KB 이하 |

---

## Task 1: 검증 도구

이후 모든 Task가 이 도구로 판정된다. 먼저 만든다.

**Files:**
- Create: `scripts/compare-shots.mjs`
- Create: `scripts/audit-ui.mjs`

**Interfaces:**
- Produces: `node scripts/compare-shots.mjs <before.png> <after.png>` → 종료코드 0(통과)/1(불합격), 요약 출력
- Produces: `scripts/audit-ui.mjs`가 `export const AUDIT_SCRIPT: string` — 브라우저 `evaluate_script`에 넣을 함수 소스

- [ ] **Step 1: 픽셀 비교 스크립트 작성**

Create `scripts/compare-shots.mjs`:

```js
// 1단계 게이트: 역할 배정이 옳은지 판정한다.
// 허용   = 채널당 차이 24 이하 (같은 역할의 인접색을 합친 결과)
// 불합격 = 채널당 차이 24 초과 (레이아웃 밀림, 명암 반전, 텍스트/배경 뒤바뀜)
import sharp from "sharp";

const TOLERANCE = 24;      // 채널당 허용 차이 (0-255)
const MAX_HARD_RATIO = 0.002; // 불합격 픽셀 허용 비율 0.2% (안티에일리어싱 여유)

const [, , beforePath, afterPath] = process.argv;
if (!beforePath || !afterPath) {
  console.error("사용법: node scripts/compare-shots.mjs <before.png> <after.png>");
  process.exit(2);
}

async function raw(path) {
  const img = sharp(path).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
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
```

- [ ] **Step 2: 스크립트가 자기 자신과 비교하면 통과하는지 확인**

Run:
```bash
node -e "import('sharp').then(async s=>{await s.default({create:{width:40,height:40,channels:3,background:'#123456'}}).png().toFile('/tmp/t1.png');await s.default({create:{width:40,height:40,channels:3,background:'#123456'}}).png().toFile('/tmp/t2.png');await s.default({create:{width:40,height:40,channels:3,background:'#a03456'}}).png().toFile('/tmp/t3.png')})"
node scripts/compare-shots.mjs /tmp/t1.png /tmp/t2.png
```
Expected: `통과`, 종료코드 0

- [ ] **Step 3: 큰 차이는 불합격으로 잡히는지 확인**

Run: `node scripts/compare-shots.mjs /tmp/t1.png /tmp/t3.png; echo "exit=$?"`
Expected: `불합격` 출력, `exit=1`

- [ ] **Step 4: UI 감사 스크립트 작성**

Create `scripts/audit-ui.mjs`:

```js
// 브라우저에 주입해 실행하는 감사 스크립트.
// chrome-devtools MCP 의 evaluate_script 에 이 문자열을 넘긴다.
export const AUDIT_SCRIPT = `() => {
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(",").map(Number);
    return p[3] === 0 ? null : [p[0], p[1], p[2]];
  };
  const lum = (rgb) => {
    const s = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c) return c;
      n = n.parentElement;
    }
    return [255, 255, 255];
  };

  const visible = [...document.querySelectorAll("body *")].filter(e => e.offsetParent !== null);

  const tinyText = visible
    .filter(e => e.textContent?.trim() && !e.children.length)
    .map(e => ({ t: e.textContent.trim().slice(0, 24), size: parseFloat(getComputedStyle(e).fontSize) }))
    .filter(x => x.size < 12);

  const smallTap = visible
    .filter(e => /^(BUTTON|A|INPUT|SELECT|SUMMARY|TEXTAREA)$/.test(e.tagName))
    .map(e => { const r = e.getBoundingClientRect();
      return { t: (e.innerText || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter(x => x.h > 0 && (x.h < 44 || x.w < 44));

  const lowContrast = visible
    .filter(e => e.textContent?.trim() && !e.children.length)
    .map(e => {
      const cs = getComputedStyle(e);
      const fg = parse(cs.color);
      if (!fg) return null;
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const r = ratio(fg, bgOf(e));
      return { t: e.textContent.trim().slice(0, 24), ratio: +r.toFixed(2), need: large ? 3 : 4.5 };
    })
    .filter(x => x && x.ratio < x.need);

  const d = document.documentElement;
  const overflow = [...document.querySelectorAll("body *")]
    .filter(e => e.getBoundingClientRect().right > d.clientWidth + 1)
    .map(e => typeof e.className === "string" ? e.className : e.tagName);

  return {
    폭: d.clientWidth,
    가로넘침: d.scrollWidth > d.clientWidth,
    넘치는요소: [...new Set(overflow)].slice(0, 8),
    작은글씨_개수: tinyText.length, 작은글씨: tinyText.slice(0, 8),
    작은터치_개수: smallTap.length, 작은터치: smallTap.slice(0, 8),
    낮은대비_개수: lowContrast.length, 낮은대비: lowContrast.slice(0, 8),
  };
}\`;
```

- [ ] **Step 5: 감사 스크립트가 유효한 JS 인지 확인**

Run: `node -e "import('./scripts/audit-ui.mjs').then(m=>{new Function('return '+m.AUDIT_SCRIPT);console.log('구문 정상, 길이', m.AUDIT_SCRIPT.length)})"`
Expected: `구문 정상, 길이 <숫자>`

- [ ] **Step 6: 커밋**

```bash
git add scripts/compare-shots.mjs scripts/audit-ui.mjs
git commit -m "chore: add pixel diff and UI audit tooling for the redesign"
```

---

## Task 2: 기준 스크린샷과 토큰 파일

**Files:**
- Create: `app/tokens.css`
- Modify: `app/globals.css` (첫 줄에 import 추가)
- Create: `docs/superpowers/shots/` (기준 스크린샷 보관)

**Interfaces:**
- Consumes: `scripts/compare-shots.mjs` (Task 1)
- Produces: `app/tokens.css`가 29개 토큰을 `:root`에 정의. 1단계에서는 **기존 색값**을 담는다
- Produces: `docs/superpowers/shots/before-{320,390,768,1440}.png`

- [ ] **Step 1: dev 서버를 3000 포트로 띄운다**

```bash
npm run dev
```
`http://localhost:3000` 확인. 3000이 아니면 점유 프로세스를 정리하고 다시 띄운다. 카카오 도메인이 3000에만 등록돼 있어 다른 포트에서는 지도가 뜨지 않는다.

- [ ] **Step 2: 기준 스크린샷 4장 캡처**

chrome-devtools MCP로 `http://localhost:3000/` 을 연 뒤, 각 폭마다 `resize_page` → `take_screenshot`(`fullPage: true`, `format: "png"`, `filePath` 지정).

| 폭 | 저장 경로 |
| --- | --- |
| 320 | `docs/superpowers/shots/before-320.png` |
| 390 | `docs/superpowers/shots/before-390.png` |
| 768 | `docs/superpowers/shots/before-768.png` |
| 1440 | `docs/superpowers/shots/before-1440.png` |

각 캡처 전에 3초 대기한다. `editorial-reveal` 등장 애니메이션이 끝나야 한다. 애니메이션 중에 찍으면 흐릿하게 나와 비교가 무의미해진다.

- [ ] **Step 3: 토큰 파일 작성 (1단계 값 — 기존 색 유지)**

Create `app/tokens.css`:

```css
/* 하루여행 디자인 토큰
   1단계: 기존 색값을 역할별로 모았다. 색 계열은 아직 초록이다.
   2단계에서 색 11줄만 먹·애시드 팔레트로 교체한다. */
:root {
  /* 색 (11) */
  --ink:        #213e35;
  --ink-soft:   #4a5b52;
  --ink-faint:  #6d7a72;
  --paper:      #f6f7f2;
  --surface:    #ffffff;
  --line:       #dce3db;
  --line-bold:  #213e35;
  --acid:       #c8db97;
  --acid-deep:  #a9c176;
  --danger:     #b34d36;
  --ok:         #45610b;

  /* 타이포 (6) */
  --t-hero:  clamp(42px, 9vw, 68px);
  --t-h2:    clamp(24px, 4vw, 34px);
  --t-h3:    17px;
  --t-body:  14px;
  --t-small: 13px;
  --t-micro: 12px;

  /* 간격 (6) */
  --s1: 4px;
  --s2: 8px;
  --s3: 12px;
  --s4: 20px;
  --s5: 32px;
  --s6: 56px;

  /* 형태 (6) */
  --bd:             1.5px solid var(--line);
  --bd-bold:        2px solid var(--line-bold);
  --shadow-hard:    6px 6px 0 var(--ink);
  --radius:         0;
  --radius-control: 4px;
  --tap:            44px;
}
```

- [ ] **Step 4: globals.css 에서 import**

`app/globals.css` 의 기존 첫 두 줄은 다음과 같다.

```css
@import url("https://cdn.jsdelivr.net/gh/sunn-us/SUIT/fonts/static/woff2/SUIT.css");
@import "tailwindcss";
```

그 **바로 아래**에 한 줄을 추가한다. CSS `@import`는 다른 규칙보다 앞에 와야 한다.

```css
@import "./tokens.css";
```

기존 `:root { --ink:#213e35; ... }` 줄은 **아직 지우지 않는다.** Task 5에서 정리한다. 지금 지우면 아직 치환하지 않은 `var(--green)` 등이 깨진다.

- [ ] **Step 5: 빌드가 통과하는지 확인**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 0, 테스트 19개 통과

- [ ] **Step 6: 화면이 그대로인지 확인**

1440px 스크린샷을 다시 찍어 `docs/superpowers/shots/after-1440.png` 로 저장한 뒤:

Run: `node scripts/compare-shots.mjs docs/superpowers/shots/before-1440.png docs/superpowers/shots/after-1440.png`
Expected: `통과`. 토큰을 정의만 하고 사용하지 않았으므로 차이가 없어야 한다.

- [ ] **Step 7: 커밋**

```bash
git add app/tokens.css app/globals.css docs/superpowers/shots
git commit -m "feat: add the design token layer with current colour values"
```

---

## Task 3: 중성색 치환 (흰색·회색)

가장 위험이 낮은 군부터 시작한다. 흰색 65종, 밝은 회색 52종, 중간 회색 12종이 사실상 같은 역할을 한다.

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `app/tokens.css` (Task 2), `scripts/compare-shots.mjs` (Task 1)

- [ ] **Step 1: 역할별 색 목록 뽑기**

색의 역할은 CSS 속성으로 판정한다. 다음 스크립트로 목록을 확인한다.

```bash
node -e '
const css=require("fs").readFileSync("app/globals.css","utf8");
const rx=/([a-z-]+)\s*:\s*([^;{}]*#[0-9a-fA-F]{3,8}[^;{}]*)/g;
const roles={};
for(const m of css.matchAll(rx)){
  const prop=m[1], val=m[2];
  for(const h of val.match(/#[0-9a-fA-F]{3,8}/g)||[]){
    const role = /^color$/.test(prop) ? "텍스트"
      : /border/.test(prop) ? "선"
      : /background/.test(prop) ? "배경"
      : /shadow/.test(prop) ? "그림자" : "기타:"+prop;
    (roles[role]=roles[role]||new Set()).add(h.toLowerCase());
  }
}
for(const [r,s] of Object.entries(roles)) console.log(r.padEnd(12), s.size+"종");
'
```

이 목록을 보고 어떤 색이 어떤 역할인지 파악한다. 손으로 380개를 분류하지 않는다.

- [ ] **Step 2: 흰색 계열을 `--surface` 로 치환**

`#fff`, `#ffffff`, `#fffefb`, `#fffef9`, `#fbfdf7`, `#fbfaf6` 등 명도 235 이상이면서 채도가 거의 없는 색을 찾아 `var(--surface)` 로 바꾼다.

```bash
node -e '
const fs=require("fs");
const p="app/globals.css";
let s=fs.readFileSync(p,"utf8");
const norm=h=>h.length===4?"#"+h.slice(1).split("").map(c=>c+c).join(""):h.slice(0,7);
const isNearWhite=h=>{const n=norm(h.toLowerCase());const [r,g,b]=[1,3,5].map(i=>parseInt(n.slice(i,i+2),16));
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  return mn>=235 && (mx-mn)<=12;};
let n=0;
s=s.replace(/#[0-9a-fA-F]{3,8}\b/g,h=>{ if(isNearWhite(h)){n++;return "var(--surface)"} return h; });
fs.writeFileSync(p,s,"utf8");
console.log("치환:",n,"곳");
'
```

- [ ] **Step 3: 회색 계열을 명도에 따라 치환**

명도 200~235는 `--line`, 90~200은 `--ink-faint`, 90 미만은 `--ink` 로 보낸다. 단 **`border` 속성 안의 회색은 `--line`** 으로 강제한다.

```bash
node -e '
const fs=require("fs");
const p="app/globals.css";
let s=fs.readFileSync(p,"utf8");
const norm=h=>h.length===4?"#"+h.slice(1).split("").map(c=>c+c).join(""):h.slice(0,7);
const info=h=>{const n=norm(h.toLowerCase());const [r,g,b]=[1,3,5].map(i=>parseInt(n.slice(i,i+2),16));
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  return {L:0.2126*r+0.7152*g+0.0722*b, S:mx===0?0:(mx-mn)/mx};};
let n=0;
// 선언 단위로 처리해 속성명을 안다
s=s.replace(/([a-z-]+)(\s*:\s*)([^;{}]*)/g,(all,prop,sep,val)=>{
  if(!/#[0-9a-fA-F]{3,8}/.test(val)) return all;
  const out=val.replace(/#[0-9a-fA-F]{3,8}\b/g,h=>{
    const {L,S}=info(h);
    if(S>0.10) return h;              // 유채색은 다음 Task 에서
    n++;
    if(/border/.test(prop)) return "var(--line)";
    if(L>=200) return "var(--line)";
    if(L>=90)  return "var(--ink-faint)";
    return "var(--ink)";
  });
  return prop+sep+out;
});
fs.writeFileSync(p,s,"utf8");
console.log("치환:",n,"곳");
'
```

- [ ] **Step 4: 빌드 확인**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 0, 테스트 19개 통과

- [ ] **Step 5: 픽셀 게이트 — 4개 폭 전부**

각 폭에서 `after-<폭>.png` 를 다시 캡처한 뒤:

```bash
for w in 320 390 768 1440; do
  echo "=== ${w}px ==="
  node scripts/compare-shots.mjs docs/superpowers/shots/before-$w.png docs/superpowers/shots/after-$w.png || echo "!!! ${w}px 불합격"
done
```
Expected: 네 폭 모두 `통과`

불합격이면 그 폭의 화면을 열어 무엇이 달라졌는지 확인한다. 흔한 원인은 흰색으로 판정된 색이 실제로는 강조 배경이었던 경우다. 해당 색만 되돌리고 다시 검증한다.

- [ ] **Step 6: 커밋**

```bash
git add app/globals.css docs/superpowers/shots
git commit -m "refactor: map neutral colours onto tokens"
```

---

## Task 4: 유채색 치환과 1단계 완료

초록 197종을 포함한 유채색 전부를 토큰으로 보낸다.

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Task 3 결과

- [ ] **Step 1: 유채색을 역할과 명도로 치환**

```bash
node -e '
const fs=require("fs");
const p="app/globals.css";
let s=fs.readFileSync(p,"utf8");
const norm=h=>h.length===4?"#"+h.slice(1).split("").map(c=>c+c).join(""):h.slice(0,7);
const info=h=>{const n=norm(h.toLowerCase());const [r,g,b]=[1,3,5].map(i=>parseInt(n.slice(i,i+2),16));
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
  let H=-1; if(d){ if(mx===r)H=((g-b)/d)%6; else if(mx===g)H=(b-r)/d+2; else H=(r-g)/d+4; H=Math.round(H*60+360)%360; }
  return {L:0.2126*r+0.7152*g+0.0722*b, H};};
let n=0;
s=s.replace(/([a-z-]+)(\s*:\s*)([^;{}]*)/g,(all,prop,sep,val)=>{
  if(!/#[0-9a-fA-F]{3,8}/.test(val)) return all;
  const out=val.replace(/#[0-9a-fA-F]{3,8}\b/g,h=>{
    const {L,H}=info(h); n++;
    // 빨강 계열은 오류색
    if(H>=340||H<20) return "var(--danger)";
    // 밝은 연두는 강조색
    if(H>=60&&H<110&&L>=170) return "var(--acid)";
    if(H>=60&&H<110&&L>=140) return "var(--acid-deep)";
    // 나머지 초록 계열은 역할 + 명도
    if(/border/.test(prop)) return L>=190 ? "var(--line)" : "var(--line-bold)";
    if(/shadow/.test(prop)) return "var(--ink)";
    if(/background/.test(prop)) return L>=225 ? "var(--paper)" : "var(--ink)";
    // color 등 텍스트
    if(L>=140) return "var(--ink-faint)";
    if(L>=90)  return "var(--ink-soft)";
    return "var(--ink)";
  });
  return prop+sep+out;
});
fs.writeFileSync(p,s,"utf8");
console.log("치환:",n,"곳");
'
```

- [ ] **Step 2: 남은 hex 가 없는지 확인**

```bash
echo "남은 hex: $(grep -oE '#[0-9a-fA-F]{3,8}' app/globals.css | wc -l)"
grep -oE '#[0-9a-fA-F]{3,8}' app/globals.css | sort -u | head -20
```

`tokens.css` 가 아닌 `globals.css` 에 hex 가 남아 있으면 각각 확인한다. 어느 역할 토큰에도 맞지 않는 색이면 사유를 주석으로 남기고 그대로 둔다. 스펙 6장이 이를 허용한다.

- [ ] **Step 3: 옛 토큰 정의 제거**

`app/globals.css` 안의 기존 `:root { --ink:#213e35; --green:#285747; --lime:#c8db97; --cream:#f6f7f2; --line:#dce3db; }` 줄과, 그 뒤에 추가된 `--forest`, `--clay`, `--paper-green`, `--hairline` 등 옛 토큰 정의를 삭제한다. 사용처가 남아 있으면 다음 명령으로 찾아 새 토큰으로 바꾼다.

```bash
grep -oE 'var\(--[a-z-]+\)' app/globals.css | sort -u
```

`tokens.css` 에 정의된 29개 이름만 남아야 한다.

- [ ] **Step 4: 빌드 확인**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 0, 테스트 19개 통과

- [ ] **Step 5: 1단계 완료 게이트 — 4개 폭 픽셀 비교**

```bash
for w in 320 390 768 1440; do
  echo "=== ${w}px ==="
  node scripts/compare-shots.mjs docs/superpowers/shots/before-$w.png docs/superpowers/shots/after-$w.png || echo "!!! ${w}px 불합격"
done
```
Expected: 네 폭 모두 `통과`

여기가 1단계의 마지막 관문이다. 통과하면 380개 색의 역할 배정이 옳다는 뜻이고, 2단계는 토큰 값만 바꾸면 된다.

- [ ] **Step 6: 커밋**

```bash
git add app/globals.css docs/superpowers/shots
git commit -m "refactor: map remaining colours onto tokens

Phase 1 complete: every colour now flows through the token layer and the
pixel gate passes at 320/390/768/1440."
```

---

## Task 5: A 팔레트 적용

토큰 값 11줄만 바꾼다. 1단계가 옳았다면 이 한 번의 변경으로 사이트 전체 색이 바뀐다.

**Files:**
- Modify: `app/tokens.css`

- [ ] **Step 1: 색 토큰 교체**

`app/tokens.css` 의 색 블록을 다음으로 교체한다. 나머지(타이포·간격·형태)는 그대로 둔다.

```css
  /* 색 (11) — 먹 & 애시드 */
  --ink:        #14150F;  /* 제목·본문·강조 테두리 */
  --ink-soft:   #4A4B44;  /* 보조 텍스트 */
  --ink-faint:  #6D6E67;  /* 캡션·비활성. --paper 위 대비 4.51 */
  --paper:      #F1F0EA;  /* 페이지 배경 */
  --surface:    #FFFFFF;  /* 카드 */
  --line:       #D9D8D0;  /* 기본 테두리 */
  --line-bold:  #14150F;  /* 카드 테두리 */
  --acid:       #D6FF3D;  /* 강조. 면으로만 — 흰 배경 위 글자로 쓰면 대비 1.15 */
  --acid-deep:  #B4DC1E;  /* 호버·누름 */
  --danger:     #C43B22;  /* 오류. 대비 4.60 */
  --ok:         #2D7B4D;  /* 성공. 대비 4.54 */
```

첫 줄 주석의 "1단계" 문구도 함께 고친다.

```css
/* 하루여행 디자인 토큰
   색을 바꾸려면 아래 11줄만 고치면 된다. */
```

- [ ] **Step 2: 빌드 확인**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 0, 테스트 19개 통과

- [ ] **Step 3: 화면 확인과 대비 감사**

1440px와 390px에서 화면을 열고 `scripts/audit-ui.mjs` 의 `AUDIT_SCRIPT` 를 브라우저에 주입해 실행한다.

Expected: `낮은대비_개수`가 0. 0이 아니면 해당 요소가 `--acid`를 글자색으로 쓰고 있을 가능성이 높다. 배경으로 바꾸거나 `--ink`로 교체한다.

이 시점에는 `작은글씨_개수`와 `작은터치_개수`가 아직 0이 아니다. Task 9에서 처리한다.

- [ ] **Step 4: 이 시점 스크린샷 보관**

1440px 화면을 `docs/superpowers/shots/palette-1440.png` 로 저장한다. 이후 Task들이 무엇을 바꿨는지 대조할 기준이 된다.

- [ ] **Step 5: 커밋**

```bash
git add app/tokens.css docs/superpowers/shots
git commit -m "feat: switch the palette to ink and acid"
```

---

## Task 6: 컴포넌트 규칙

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `app/tokens.css` (Task 5)

- [ ] **Step 1: 컴포넌트 규칙을 파일 끝에 추가**

기존 규칙을 하나씩 찾아 고치는 대신, 파일 끝에 새 섹션을 두어 덮어쓴다. 나중 규칙이 이긴다. 기존 코드를 흩뜨리지 않는 방식이다.

`app/globals.css` 맨 끝에 추가한다.

```css
/* 2026-09-14: 먹·애시드 컴포넌트 규칙 */

/* 카드·패널 — 각지고, 굵은 테두리, 하드 섀도 */
.planner-card,
.admin-stats li,
.admin-table-wrap,
.result,
.stop-card,
.time-warning {
  border: var(--bd-bold);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-hard);
}

/* 기본 버튼 — 먹 배경에 라임 글씨 */
.primary,
.search-section form button {
  border: 0;
  border-radius: var(--radius-control);
  background: var(--ink);
  color: var(--acid);
  font-weight: 900;
}
.primary:hover:enabled,
.search-section form button:hover:enabled { background: #000; }

/* 보조 버튼 */
.ghost,
.route-optimize,
.origin-locate,
.origin-favorite-add,
.origin-clear,
.admin-table td button {
  border: var(--bd-bold);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font-weight: 800;
}

/* 칩 — 테두리만, 선택 시 먹 채움 */
.chips button {
  border: var(--bd-bold);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
}
.chips .active {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--acid);
}
.chips .active .preference-icon { color: var(--acid); }

/* 방문 번호 — 배지 없이 큰 숫자 */
.stop-number {
  display: inline-block;
  min-width: auto;
  height: auto;
  padding: 0;
  margin-right: var(--s2);
  border: 0;
  border-radius: 0;
  background: none;
  color: var(--ink);
  font-size: 36px;
  font-weight: 900;
  line-height: .85;
  letter-spacing: -2px;
}

/* 섹션 구분은 배경색이 아니라 굵은 선 */
.section-head { border-bottom: var(--bd-bold); }
.search-section { background: var(--paper); border-top: var(--bd-bold); }

/* 지도는 액자에 넣는다 */
.map-panel, .map { border-radius: var(--radius); }
.map-panel { border: var(--bd-bold); }

/* 요약 숫자를 크게 */
.summary b { font-size: var(--t-h2); letter-spacing: -1.2px; font-variant-numeric: tabular-nums; }
.summary span { font-size: var(--t-micro); }
```

- [ ] **Step 2: 빌드 확인**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 0, 테스트 19개 통과

- [ ] **Step 3: 화면 확인**

1440px와 390px에서 확인한다. 특히 볼 것:
- 카드에 하드 섀도가 잘려 보이지 않는지 (부모에 `overflow: hidden` 이 있으면 잘린다. 있으면 그 부모에 우측·하단 여백 `var(--s2)` 를 준다)
- 선택된 칩의 아이콘이 라임으로 보이는지
- 방문 번호가 크게 나오는지

- [ ] **Step 4: 대비 감사**

`AUDIT_SCRIPT` 실행. Expected: `낮은대비_개수` 0

- [ ] **Step 5: 커밋**

```bash
git add app/globals.css
git commit -m "feat: apply the ink and acid component language"
```

---

## Task 7: 히어로 그래픽

사진을 버리고 동선 SVG로 바꾼다. 이 계획에서 마크업을 바꾸는 유일한 Task다.

**Files:**
- Modify: `app/page.tsx` (히어로 `<figure className="journey-photo">` 블록)
- Modify: `app/globals.css`
- Delete: `public/haru-forest.jpg`

- [ ] **Step 1: 현재 히어로 마크업 확인**

```bash
grep -n "journey-photo" app/page.tsx app/globals.css
```

`app/page.tsx` 의 `<figure className="journey-photo">…</figure>` 전체(이미지와 `figcaption` 포함)를 다음 Step의 SVG로 교체한다. 주변의 `.hero-copy`, `h1`, `.eyebrow` 는 건드리지 않는다.

- [ ] **Step 2: 동선 그래픽으로 교체**

`<figure className="journey-photo">` 부터 `</figure>` 까지를 다음으로 바꾼다.

```tsx
          <figure className="journey-route" aria-hidden="true">
            <svg viewBox="0 0 320 200" width="320" height="200" role="presentation" focusable="false">
              <path d="M40 46 H210" strokeDasharray="7 7" />
              <path d="M210 46 V150" strokeDasharray="7 7" />
              <path d="M210 150 H90" strokeDasharray="7 7" />
              <g className="jr-node"><circle cx="40" cy="46" r="15" /><text x="40" y="52">1</text></g>
              <g className="jr-node"><circle cx="210" cy="46" r="15" /><text x="210" y="52">2</text></g>
              <g className="jr-node"><circle cx="210" cy="150" r="15" /><text x="210" y="156">3</text></g>
              <g className="jr-node"><circle cx="90" cy="150" r="15" /><text x="90" y="156">4</text></g>
            </svg>
          </figure>
```

`aria-hidden="true"` 를 붙인 이유는 장식이기 때문이다. 같은 정보가 아래 일정 목록에 텍스트로 있으므로 스크린리더에 두 번 읽힐 필요가 없다.

- [ ] **Step 3: 스타일 추가**

`app/globals.css` 맨 끝에 추가한다.

```css
/* 2026-09-14: 히어로 동선 그래픽 */
.journey-route { margin: var(--s5) 0 0; display: flex; justify-content: center; }
.journey-route svg { width: 100%; max-width: 320px; height: auto; }
.journey-route path { fill: none; stroke: var(--ink); stroke-width: 2.5; stroke-linecap: round; }
.journey-route .jr-node circle { fill: var(--acid); stroke: var(--ink); stroke-width: 2.5; }
.journey-route .jr-node text {
  fill: var(--ink); font-size: 15px; font-weight: 900;
  text-anchor: middle; font-family: inherit;
}
@media(max-width:800px){ .journey-route { margin-top: var(--s4); } .journey-route svg { max-width: 260px; } }
```

- [ ] **Step 4: 옛 사진 스타일과 파일 제거**

```bash
grep -n "journey-photo\|haru-forest" app/globals.css app/page.tsx
```

`.journey-photo` 관련 CSS 규칙을 모두 삭제한다. 그다음:

```bash
git rm public/haru-forest.jpg
```

- [ ] **Step 5: 참조가 남지 않았는지 확인**

```bash
grep -rn "haru-forest\|journey-photo\|Charles Black\|unsplash" app/ lib/ components/ ; echo "(비어있으면 정리 완료)"
```

Unsplash 출처 링크도 함께 사라져야 한다. 사진을 쓰지 않으므로 표기 의무가 없다.

- [ ] **Step 6: 빌드와 테스트**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 0, 테스트 19개 통과

`rendered-html.test.mjs` 는 `journey-photo` 를 검사하지 않으므로 통과해야 한다. 실패하면 어떤 단언이 깨졌는지 확인하고, 삭제하지 말고 새 구조에 맞게 고친다.

- [ ] **Step 7: 모바일 히어로 높이 측정**

390px 화면에서 브라우저에 주입:

```js
() => { const h = document.querySelector(".hero").getBoundingClientRect().height;
  return { 히어로: Math.round(h), 화면배수: +(h / window.innerHeight).toFixed(2) }; }
```
Expected: `화면배수` 0.7 이하 (기존 1.4에서 절반 이하)

- [ ] **Step 8: 커밋**

```bash
git add app/page.tsx app/globals.css
git commit -m "feat: replace the hero photo with a route graphic"
```

---

## Task 8: 브랜드 자산

**Files:**
- Modify: `app/globals.css` (로고 마크)
- Create: `app/icon.svg`
- Delete: `public/favicon.svg`, `public/file.svg`, `public/globe.svg`, `public/window.svg`
- Create: `scripts/make-og.mjs`
- Replace: `public/og.png`

- [ ] **Step 1: 로고 마크를 A 팔레트로**

`app/globals.css` 맨 끝에 추가한다. 기존 `.brand-mark` 규칙을 찾아 고치는 대신 덮어쓴다.

```css
/* 2026-09-14: 로고 */
.brand-mark:before {
  background: var(--acid);
  box-shadow: 0 0 0 2px var(--ink);
}
.brand-mark:after {
  border-right: 2px solid var(--ink);
  border-bottom: 2px solid var(--ink);
}
.brand-mark i {
  background: var(--ink);
  border-color: var(--surface);
  box-shadow: 0 0 0 1px var(--ink);
}
.brand { font-weight: 900; letter-spacing: -1.2px; }
.brand-word b { background: var(--acid); color: var(--ink); padding: 0 3px; }
.brand small { font-size: var(--t-micro); color: var(--ink-faint); }
```

`.brand-word b` 가 원래 초록 글씨였던 `여행` 부분이다. 라임을 글자색이 아니라 배경으로 쓴다.

- [ ] **Step 2: 파비콘 생성**

Create `app/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#14150F"/>
  <path d="M14 22 H40" stroke="#D6FF3D" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 6"/>
  <path d="M40 22 V42" stroke="#D6FF3D" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 6"/>
  <circle cx="14" cy="22" r="7" fill="#D6FF3D"/>
  <circle cx="40" cy="42" r="7" fill="#D6FF3D"/>
</svg>
```

`app/icon.svg` 에 두면 Next.js가 자동으로 `<link rel="icon">` 을 넣는다. `layout.tsx` 를 고칠 필요가 없다.

토큰이 아니라 hex 를 직접 쓴 이유는 SVG 파일이 CSS 변수를 참조할 수 없기 때문이다. 색을 바꾸면 이 파일도 함께 고쳐야 한다는 뜻이므로 주석 대신 이 계획에 기록해 둔다.

- [ ] **Step 3: 스타터 잔재 삭제**

```bash
git rm public/favicon.svg public/file.svg public/globe.svg public/window.svg
```

- [ ] **Step 4: OG 이미지 생성 스크립트**

Create `scripts/make-og.mjs`:

```js
// OG 미리보기 이미지를 SVG 에서 PNG 로 굽는다. sharp 는 Next.js 와 함께 설치돼 있다.
import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#14150F"/>
  <rect x="80" y="250" width="404" height="86" fill="#D6FF3D"/>
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
```

- [ ] **Step 5: OG 이미지 생성**

Run: `node scripts/make-og.mjs`
Expected: `public/og.png 생성: <200 미만>KB`, 종료코드 0

기존 2.4MB 파일이 덮어써진다.

- [ ] **Step 6: 취향 아이콘 굵기**

`app/page.tsx` 에서 `strokeWidth="1.5"` 를 찾아 `"2.5"` 로 바꾼다.

```bash
grep -n 'strokeWidth' app/page.tsx
```

`categoryIconPaths` 의 경로 데이터는 건드리지 않는다.

- [ ] **Step 7: 파비콘이 실제로 걸리는지 확인**

```bash
curl -s http://localhost:3000/ | grep -oE '<link[^>]*rel="icon"[^>]*>'
```
Expected: `<link rel="icon" ...>` 한 줄 이상 출력. 비어 있으면 `app/icon.svg` 위치를 확인한다.

- [ ] **Step 8: 빌드와 커밋**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: 전부 통과

```bash
git add app/globals.css app/icon.svg app/page.tsx scripts/make-og.mjs public/og.png
git commit -m "feat: rework the logo, favicon and share image for ink and acid"
```

---

## Task 9: 모바일 구조

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: 타이포 하한과 터치 타깃을 일괄 적용**

`app/globals.css` 맨 끝에 추가한다.

```css
/* 2026-09-14: 모바일 구조 — 12px 하한, 44px 터치 타깃 */

/* 12px 미만으로 내려간 곳을 하한으로 끌어올린다 */
.brand small,
.eyebrow,
.section-head p,
.search-section .eyebrow,
.summary span,
.stop-info,
.stop-card p,
.stop-card small,
.kakao-review-link,
.between-stops,
.drag-guide,
.search-feedback,
.planner-feedback,
.origin-feedback,
.origin-transit,
.time-select-field select,
.location-row .time-select-label,
.result small,
.region-suggestions button,
.region-suggestions span,
.route-optimize-wrap > span,
.transit-meta,
.missing-preferences,
.admin-note,
.admin-stats span,
.admin-table,
.admin-table th,
footer {
  font-size: var(--t-micro);
}

/* 터치 타깃 44px */
button,
.ghost,
.chips button,
summary,
.origin-favorite > button,
.origin-favorite-remove,
.admin-table td button,
.region-suggestions button,
input:not([type="radio"]):not([type="checkbox"]),
select {
  min-height: var(--tap);
}
.origin-favorite-remove { min-width: var(--tap); }

/* 아이콘만 있는 작은 버튼도 폭을 확보한다 */
.stop-actions > summary { min-width: var(--tap); }
```

`input[type="radio"]` 를 제외한 이유는 지역 모드 선택(행정동/지하철역)의 라디오가 시각적으로 숨겨져 있고, 실제 터치 대상은 감싸는 `label` 이기 때문이다.

- [ ] **Step 2: 지도 높이와 히어로 여백**

계속해서 추가한다.

```css
@media(max-width:800px){
  .map-panel, .map { min-height: 480px; }
  .hero { padding: var(--s5) var(--s4) var(--s5); }
  .planner-card { padding: var(--s4); }
}
```

- [ ] **Step 3: 감사 스크립트로 검증 — 네 폭 전부**

각 폭(320·390·768·1440)에서 `AUDIT_SCRIPT` 를 실행한다.

Expected: 모든 폭에서
- `작은글씨_개수` 0
- `작은터치_개수` 0
- `낮은대비_개수` 0
- `가로넘침` false

0이 아닌 항목이 있으면 출력된 요소 목록을 보고 위 선택자에 추가한다.

- [ ] **Step 4: 전체 문서 높이 확인**

390px 화면에서:

```js
() => ({ 화면수: +(document.body.scrollHeight / window.innerHeight).toFixed(1) })
```
Expected: 3.4 이하 (기존 4.3에서 감소)

- [ ] **Step 5: 빌드와 커밋**

Run: `npx tsc --noEmit && npm test`

```bash
git add app/globals.css
git commit -m "feat: raise the type floor and tap targets for mobile"
```

---

## Task 10: 모션 3종

**Files:**
- Modify: `app/globals.css`
- Modify: `app/page.tsx` (카운트업)

- [ ] **Step 1: 하드 섀도 눌림과 라임 와이프**

`app/globals.css` 맨 끝에 추가한다.

```css
/* 2026-09-14: 물리적 모션 */

/* 1. 하드 섀도 눌림 — 누르면 2px 밀리며 그림자가 접힌다 */
.primary,
.ghost,
.chips button,
.route-optimize,
.origin-locate,
.search-section form button {
  transition: transform .08s ease, box-shadow .08s ease;
}
.primary:active:enabled,
.ghost:active:enabled,
.chips button:active,
.route-optimize:active,
.origin-locate:active:enabled,
.search-section form button:active:enabled {
  transform: translate(2px, 2px);
  box-shadow: none;
}
.planner-card:active { box-shadow: var(--shadow-hard); }

/* 2. 라임 와이프 — 일정 생성 완료 시 헤드라인 하이라이트가 쓸려 들어온다 */
.hero h1 em {
  position: relative;
  color: var(--ink);
  font-style: normal;
}
.hero h1 em:before {
  content: "";
  position: absolute;
  inset: 0 -6px;
  z-index: -1;
  background: var(--acid);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform .5s cubic-bezier(.2,.8,.2,1);
}
.hero h1 em.wiped:before { transform: scaleX(1); }

@media(prefers-reduced-motion:reduce){
  .primary,.ghost,.chips button,.route-optimize,.origin-locate,
  .search-section form button { transition: none }
  .primary:active:enabled,.ghost:active:enabled,.chips button:active,
  .route-optimize:active,.origin-locate:active:enabled,
  .search-section form button:active:enabled { transform: none }
  .hero h1 em:before { transition: none; transform: scaleX(1) }
}
```

`inset: 0 -6px` 와 `z-index: -1` 로 글자 뒤에 깔리게 한다. 라임 위에 먹 글씨가 놓이므로 대비 15.94를 유지한다.

- [ ] **Step 2: 와이프를 일정 생성에 연결**

`app/page.tsx` 의 `<h1>` 을 찾는다.

```bash
grep -n "오늘 어디로" app/page.tsx
```

현재는 `<h1>오늘 어디로<br/><em>떠나볼까요?</em></h1>` 형태다. `<em>` 에 클래스를 붙인다.

```tsx
          <h1>오늘 어디로<br/><em className={plan.length ? "wiped" : ""}>떠나볼까요?</em></h1>
```

`plan` 은 이미 이 컴포넌트의 상태다. 일정이 생기면 하이라이트가 쓸려 들어온다.

- [ ] **Step 3: 숫자 카운트업**

`app/page.tsx` 의 `export default function Home()` 앞에 훅을 추가한다.

```tsx
function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}
```

`Home()` 안, `const total = useMemo(...)` 아래에 추가한다.

```tsx
  const shownTotal = useCountUp(total);
  const shownCount = useCountUp(plan.length);
```

요약 표시부(`.summary`)에서 `Math.floor(total / 60)`, `total % 60`, `plan.length` 를 각각 `Math.floor(shownTotal / 60)`, `shownTotal % 60`, `shownCount` 로 바꾼다. `totalTravel` 은 그대로 둔다 — 세 숫자가 동시에 움직이면 산만하다.

- [ ] **Step 4: 지도 워커·경로선·마커를 먹색으로**

스펙 2장이 정한 대로 주황 워커를 폐기한다. 흰 지도 위에서 형광 라임 선은 대비가 낮아 보이지 않으므로 경로선에 쓰지 않는다.

먼저 현재 색이 어디에 있는지 찾는다.

```bash
grep -n strokeColor|route-walker|kakao-number-marker app/page.tsx app/globals.css
```

세 곳을 고친다.

1. `app/page.tsx` 의 `new window.kakao.maps.Polyline({ ... strokeColor: "..." })` 값을 `"#14150F"` 로 바꾼다. 카카오 SDK 에 넘기는 값이라 CSS 변수를 쓸 수 없다.
2. `app/globals.css` 맨 끝에 다음을 추가한다.

```css
/* 2026-09-14: 지도 요소를 먹색으로 */
.route-walker { color: var(--ink); }
.route-walker .rw-shadow { fill: rgba(20, 21, 15, .18); }
.kakao-number-marker {
  background: var(--ink);
  border-color: var(--surface);
  color: var(--surface);
}
.kakao-number-marker--visited {
  background: var(--acid);
  color: var(--ink);
}
.travel-label {
  border: 1.5px solid var(--ink);
  background: var(--surface);
  color: var(--ink);
  font-size: var(--t-micro);
}
```

워커 SVG 의 선은 `currentColor` 를 쓰므로 `.route-walker { color }` 한 줄로 바뀐다. 바뀌지 않으면 SVG 안에 색이 하드코딩된 것이므로 `WALKER_SVG` 상수(`app/page.tsx:109` 부근)를 확인한다.

3. 확인: 일정을 새로 만들어 워커가 먹색으로 움직이고, 지나간 마커가 라임으로 바뀌는지 본다.

- [ ] **Step 5: 빌드와 테스트**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 0, 테스트 19개 통과

- [ ] **Step 6: 모션 동작 확인**

브라우저에서:
1. `나만의 하루 만들기` 를 누른다 → 헤드라인 하이라이트가 왼쪽에서 쓸려 들어오고, 요약 숫자가 올라가는지 본다
2. 버튼을 누른 채로 둔다 → 2px 밀리며 그림자가 접히는지 본다

모션 감소 설정 확인은 `emulate` 로 `prefers-reduced-motion` 을 켠 뒤 같은 동작을 반복한다. 세 모션 모두 즉시 최종 상태로 가야 한다.

- [ ] **Step 7: 커밋**

```bash
git add app/globals.css app/page.tsx
git commit -m "feat: add press, wipe and count-up motion and recolour the map"
```

---

## Task 11: 일정 이미지 팔레트 동기화

이걸 빠뜨리면 앱은 먹·애시드인데 저장한 PNG 는 초록으로 나온다.

**Files:**
- Modify: `lib/trip-image.ts:23-27`
- Modify: `tests/trip-image.test.mjs`

- [ ] **Step 1: 팔레트 상수 교체**

`lib/trip-image.ts` 의 다음 다섯 줄을

```ts
const INK = "#213e35";
const GREEN = "#285747";
const LIME = "#c8db97";
const CREAM = "#f6f7f2";
const MUTED = "#7d948b";
```

이렇게 바꾼다.

```ts
// app/tokens.css 와 같은 값을 유지한다. 색을 바꾸면 양쪽을 함께 고친다.
const INK = "#14150F";
const GREEN = "#14150F";   // 헤더 배경도 먹으로 통일
const LIME = "#D6FF3D";
const CREAM = "#F1F0EA";
const MUTED = "#6D6E67";
```

`GREEN` 은 헤더 배경에만 쓰인다. 이름이 더 이상 맞지 않지만 사용처가 한 곳뿐이라 이름 변경은 하지 않는다. 위 주석으로 의도를 남긴다.

- [ ] **Step 2: 헤더 부제 색 확인**

`buildTripImageLayout` 안에서 헤더 부제가 `fill: "#cbd7d2"` 로 하드코딩돼 있다.

```bash
grep -n '#cbd7d2' lib/trip-image.ts
```

먹 배경 위에서 읽히도록 `"#B9B8B0"` 으로 바꾼다.

- [ ] **Step 3: 팔레트 회귀 테스트 추가**

`tests/trip-image.test.mjs` 맨 끝에 추가한다.

```js
test("이미지 팔레트는 먹·애시드 토큰을 따른다", async () => {
  const { buildTripImageLayout } = await import("../lib/trip-image.ts");
  const layout = buildTripImageLayout(input);
  const fills = new Set(layout.ops.map(op => op.fill.toUpperCase()));

  assert.ok(fills.has("#14150F"), "먹색이 쓰여야 한다");
  assert.ok(fills.has("#D6FF3D"), "형광 라임이 쓰여야 한다");
  assert.ok(!fills.has("#285747"), "옛 초록이 남아 있으면 안 된다");
  assert.ok(!fills.has("#C8DB97"), "옛 라임이 남아 있으면 안 된다");
});
```

- [ ] **Step 4: 테스트 실행**

Run: `node --test tests/trip-image.test.mjs`
Expected: 5개 통과 (기존 4 + 신규 1)

- [ ] **Step 5: 실제 렌더링 확인**

브라우저에서 `더보기 → 이미지 저장` 을 눌러 내려받은 PNG 를 연다. 먹 배경에 라임 강조가 나와야 한다.

- [ ] **Step 6: 커밋**

```bash
git add lib/trip-image.ts tests/trip-image.test.mjs
git commit -m "feat: sync the saved image palette with ink and acid"
```

---

## Task 12: 전체 회귀와 문서

**Files:**
- Modify: `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/NEXT_SESSION.md`

- [ ] **Step 1: 전체 검증**

```bash
npx tsc --noEmit && npm test && npx next build
```
Expected: 타입 오류 0, 테스트 20개 통과(기존 19 + Task 11 신규 1), 빌드 성공에 라우트 7개

- [ ] **Step 2: 네 폭 감사**

320·390·768·1440px 각각에서 `AUDIT_SCRIPT` 실행.

Expected: 모든 폭에서 `가로넘침` false, `작은글씨_개수` 0, `작은터치_개수` 0, `낮은대비_개수` 0

- [ ] **Step 3: 관리자·콜백 화면 확인**

`/admin` 과 `/auth/callback` 을 열어 먹·애시드가 적용됐는지 본다. `/admin` 은 Supabase 미설정 시 안내 문구가 뜨는 것이 정상이다. 두 화면에서도 감사 스크립트를 실행한다.

- [ ] **Step 4: 자산 크기 확인**

```bash
ls -la public/
echo "og.png: $(( $(stat -c%s public/og.png) / 1024 ))KB"
```
Expected: `og.png` 200KB 이하, `haru-forest.jpg` 없음, 스타터 svg 3개 없음

- [ ] **Step 5: 토큰 정리 결과 기록**

```bash
echo "globals.css 잔여 hex: $(grep -oE '#[0-9a-fA-F]{3,8}' app/globals.css | sort -u | wc -l)"
echo "tokens.css 토큰 수: $(grep -cE '^\s+--' app/tokens.css)"
echo "var() 사용: $(grep -o 'var(--' app/globals.css | wc -l)"
```

수치를 다음 Step 문서에 적는다.

- [ ] **Step 6: 문서 갱신**

`docs/PROJECT_CONTEXT.md` 맨 위 제목 바로 아래에 추가한다. `<잔여>` 등은 Step 5의 실제 수치로 채운다.

```markdown
## 최신 작업 — 2026-09-14 먹·애시드 디자인 개편

- 하드코딩된 색 380개를 `app/tokens.css` 의 토큰 29개로 정리했다. 색을 바꾸려면 그 파일의 색 11줄만 고치면 된다. `globals.css` 잔여 hex <잔여>개.
- 시각 방향을 초록·크림 여행 매거진에서 **먹·애시드 고대비 에디토리얼**로 바꿨다. 종이색 배경, 먹색 텍스트와 굵은 테두리, 형광 라임 강조.
- 형광 라임은 밝은 배경 위 글자색으로 쓰지 않는다. 대비 1.15로 보이지 않는다. 면으로만 쓴다.
- 히어로 사진(430KB)을 버리고 앱이 만드는 결과물인 동선 SVG 로 바꿨다. 모바일 히어로가 1.4화면에서 절반 이하로 줄었다.
- 파비콘이 그동안 연결돼 있지 않았다(스타터 기본 아이콘, HTML 링크 없음). `app/icon.svg` 로 새로 만들었다.
- `og.png` 를 2.4MB 에서 200KB 이하로 줄였다. `node scripts/make-og.mjs` 로 다시 굽는다.
- 12px 미만 글씨 46곳과 44px 미만 터치 타깃 16개를 모두 없앴다.
- 일정 이미지(`lib/trip-image.ts`) 팔레트도 함께 바꿨다. 앱과 저장 이미지가 어긋나지 않는다.
- 검증 도구: `scripts/compare-shots.mjs`(픽셀 비교), `scripts/audit-ui.mjs`(대비·글씨·터치 감사).
- 복원 지점은 `design-before-2026-09-14` 태그다.
```

`docs/ROADMAP.md` 맨 위에 추가한다.

```markdown
- [x] 2026-09-14 색 토큰 체계 정리 (380색 → 29토큰)
- [x] 2026-09-14 먹·애시드 시각 언어 적용
- [x] 2026-09-14 모바일 타이포 하한·터치 타깃·히어로 압축
- [x] 2026-09-14 로고·파비콘·OG 이미지 개편
- [ ] 실기기에서 먹·애시드 화면 확인
```

`docs/NEXT_SESSION.md` 의 `## 지금 상태 한 줄` 을 갱신하고, `## 남은 일` 의 검증 목록에 다음을 추가한다.

```markdown
- [ ] **먹·애시드 개편 실기기 확인** — 형광 라임이 실제 화면에서 너무 강하지 않은지, 하드 섀도가 잘리지 않는지.
```

- [ ] **Step 7: 커밋**

```bash
git add docs/
git commit -m "docs: record the ink and acid redesign"
```

- [ ] **Step 8: 사용자 확인 요청**

푸시하지 않는다. 다음을 보고한다.

- 1440px·390px 스크린샷
- 네 폭 감사 결과 (전부 0)
- 검증 명령 3종 결과
- `og.png` 크기 변화
- 미검증 항목: 실기기 터치, 로그인 필요한 화면

배포는 사용자 승인 후 `main` 병합으로 진행한다.

---

## 자체 점검

**스펙 대비 반영 범위**

| 스펙 항목 | Task |
| --- | --- |
| 토큰 29개 (색 11·타이포 6·간격 6·형태 6) | 2, 5 |
| 색 대비 AA | 5 Step 3, 9 Step 3, 12 Step 2 |
| 라임을 글자색으로 금지 | Global Constraints, 5 Step 3 |
| 12px 하한 | 9 |
| 44px 터치 타깃 | 9 |
| 컴포넌트 규칙 (카드·버튼·칩·번호·구분선) | 6 |
| 크기 대비 (숫자 크게) | 6 Step 1 (`.stop-number`, `.summary b`) |
| 모션 3종 + 모션 감소 | 10 |
| 워커·경로선 먹색 | 10 Step 4 |
| 지도 액자 | 6 Step 1 |
| 모바일 히어로 압축 | 7 Step 7 |
| 반응형 정리 | 9 Step 2 |
| 히어로 동선 그래픽 | 7 |
| 로고 | 8 Step 1 |
| 파비콘 | 8 Step 2, 7 |
| OG 이미지 | 8 Step 4, 5 |
| 취향 아이콘 굵기 | 8 Step 6 |
| 스타터 잔재 삭제 | 8 Step 3 |
| 일정 이미지 팔레트 | 11 |
| 1단계 픽셀 게이트 | 1, 3, 4 |
| 2단계 검증 항목 | 12 |
| 관리자·콜백 화면 | 12 Step 3 |

**플레이스홀더 점검:** "TBD", "적절히", "필요시" 없음. 모든 코드 Step 에 실제 코드가 있다. Task 12 Step 6 의 `<잔여>` 는 Step 5 에서 측정해 채우도록 명시했다.

**이름 일관성:** `--ink`, `--ink-soft`, `--ink-faint`, `--paper`, `--surface`, `--line`, `--line-bold`, `--acid`, `--acid-deep`, `--danger`, `--ok`, `--t-hero`, `--t-h2`, `--t-h3`, `--t-body`, `--t-small`, `--t-micro`, `--s1`~`--s6`, `--bd`, `--bd-bold`, `--shadow-hard`, `--radius`, `--radius-control`, `--tap` — Task 2 정의와 Task 3·5·6·9·10 사용처가 일치한다. `AUDIT_SCRIPT`, `compare-shots.mjs` 이름도 Task 1 정의와 이후 사용이 일치한다.
