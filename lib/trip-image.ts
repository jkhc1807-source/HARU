export type DrawOp =
  | { type: "rect"; x: number; y: number; w: number; h: number; fill: string }
  | { type: "text"; x: number; y: number; text: string; font: string; fill: string; align?: "left" | "right" }
  | { type: "circle"; x: number; y: number; r: number; fill: string };

export type TripImageStop = { order: number; name: string; category: string; start: string; end: string };
export type TripImageInput = {
  city: string;
  startTime: string;
  endTime: string;
  totalMinutes: number;
  walkMinutes: number;
  stops: TripImageStop[];
};

export type TripImageLayout = { width: number; height: number; ops: DrawOp[] };

const WIDTH = 900;
const PADDING = 56;
const HEADER_HEIGHT = 210;
const ROW_HEIGHT = 96;
const FOOTER_HEIGHT = 92;
const INK = "#213e35";
const GREEN = "#285747";
const LIME = "#c8db97";
const CREAM = "#f6f7f2";
const MUTED = "#7d948b";

function clip(text: string, maxChars: number) {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`;
}

function formatDuration(minutes: number) {
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

export function buildTripImageLayout(input: TripImageInput): TripImageLayout {
  const bodyHeight = input.stops.length ? input.stops.length * ROW_HEIGHT : ROW_HEIGHT;
  const height = HEADER_HEIGHT + bodyHeight + FOOTER_HEIGHT;
  const ops: DrawOp[] = [
    { type: "rect", x: 0, y: 0, w: WIDTH, h: height, fill: CREAM },
    { type: "rect", x: 0, y: 0, w: WIDTH, h: HEADER_HEIGHT, fill: GREEN },
    { type: "text", x: PADDING, y: 74, text: "HARU / A DAY WELL SPENT", font: "700 18px sans-serif", fill: LIME },
    { type: "text", x: PADDING, y: 132, text: clip(`${input.city}에서의 하루`, 22), font: "700 46px sans-serif", fill: "#ffffff" },
    { type: "text", x: PADDING, y: 176, text: `${input.startTime}–${input.endTime} · ${formatDuration(input.totalMinutes)} · 도보 ${input.walkMinutes}분`, font: "500 20px sans-serif", fill: "#cbd7d2" },
  ];

  if (!input.stops.length) {
    ops.push({ type: "text", x: PADDING, y: HEADER_HEIGHT + 56, text: "아직 담은 장소가 없어요", font: "700 24px sans-serif", fill: MUTED });
  }

  input.stops.forEach((stop, index) => {
    const top = HEADER_HEIGHT + index * ROW_HEIGHT;
    ops.push({ type: "rect", x: PADDING, y: top + 20, w: WIDTH - PADDING * 2, h: ROW_HEIGHT - 12, fill: "#ffffff" });
    ops.push({ type: "circle", x: PADDING + 42, y: top + 62, r: 22, fill: GREEN });
    ops.push({ type: "text", x: PADDING + 42, y: top + 70, text: String(stop.order), font: "800 20px sans-serif", fill: "#ffffff", align: "right" });
    ops.push({ type: "text", x: PADDING + 84, y: top + 58, text: clip(stop.name, 20), font: "700 26px sans-serif", fill: INK });
    ops.push({ type: "text", x: PADDING + 84, y: top + 88, text: `${stop.category} · ${stop.start}–${stop.end}`, font: "500 17px sans-serif", fill: MUTED });
  });

  const footerTop = HEADER_HEIGHT + bodyHeight;
  ops.push({ type: "text", x: PADDING, y: footerTop + 52, text: "하루여행 · 가볍게 떠나는 하루를 위해", font: "600 18px sans-serif", fill: MUTED });
  ops.push({ type: "text", x: WIDTH - PADDING, y: footerTop + 52, text: "이동시간은 직선거리 기준 추정치예요", font: "500 15px sans-serif", fill: MUTED, align: "right" });

  return { width: WIDTH, height, ops };
}

export function renderTripImage(canvas: HTMLCanvasElement, layout: TripImageLayout) {
  const scale = 2;
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.scale(scale, scale);
  for (const op of layout.ops) {
    context.fillStyle = op.fill;
    if (op.type === "rect") {
      context.fillRect(op.x, op.y, op.w, op.h);
    } else if (op.type === "circle") {
      context.beginPath();
      context.arc(op.x, op.y, op.r, 0, Math.PI * 2);
      context.fill();
    } else {
      context.font = op.font;
      context.textAlign = op.align === "right" ? "right" : "left";
      context.fillText(op.text, op.x, op.y);
    }
  }
}
