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
}`;
