/** Renders 144x144 key images and 200x100 touch-strip (dial) images as SVG data URIs. */
export interface KeyView {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  /** accent color of the value */
  color?: string;
  /** history for the translucent background graph, oldest first */
  series?: number[];
  /** minimum value range of the graph, so tiny fluctuations don't look dramatic */
  minSpan?: number;
}

export const COLORS = { ok: "#38bdf8", warn: "#f87171", idle: "#94a3b8" };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const GRAPH = { top: 44, bottom: 136, maxPoints: 96 };

interface Area {
  width: number;
  top: number;
  bottom: number;
}
const KEY_AREA: Area = { width: 144, top: GRAPH.top, bottom: GRAPH.bottom };
const DIAL_AREA: Area = { width: 200, top: 34, bottom: 100 };

/** Builds the SVG line + area path of the background graph, or "" if there is too little data. */
function graphPaths(series: number[] | undefined, minSpan: number, area: Area): { line: string; area: string } | undefined {
  if (!series || series.length < 2) return undefined;

  // average into buckets so long windows still draw as a smooth line
  let pts = series;
  if (pts.length > GRAPH.maxPoints) {
    const size = pts.length / GRAPH.maxPoints;
    pts = Array.from({ length: GRAPH.maxPoints }, (_, i) => {
      const chunk = series.slice(Math.floor(i * size), Math.max(Math.floor((i + 1) * size), Math.floor(i * size) + 1));
      return chunk.reduce((a, b) => a + b, 0) / chunk.length;
    });
  }

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(max - min, minSpan);
  const lo = min - (span - (max - min)) / 2;
  const h = area.bottom - area.top;
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * area.width;
    const y = area.bottom - ((v - lo) / span) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${coords.join(" L")}`;
  return { line, area: `${line} L${area.width},${area.bottom} L0,${area.bottom} Z` };
}

export function renderKey(v: KeyView): string {
  const color = v.color ?? COLORS.ok;
  const graph = graphPaths(v.series, v.minSpan ?? 1, KEY_AREA);
  const size = v.value.length > 5 ? 34 : v.value.length > 3 ? 44 : 54;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
  <rect width="144" height="144" fill="url(#g)"/>
  ${graph ? `<path d="${graph.area}" fill="${color}" fill-opacity="0.22"/><path d="${graph.line}" fill="none" stroke="${color}" stroke-opacity="0.55" stroke-width="2" stroke-linejoin="round"/>` : ""}
  <rect x="0" y="136" width="144" height="8" fill="${color}" opacity="0.8"/>
  <text x="72" y="30" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#cbd5e1">${esc(v.label)}</text>
  <text x="72" y="88" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="700" fill="${color}">${esc(v.value)}</text>
  <text x="72" y="${v.sub ? 108 : 116}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#e2e8f0">${esc(v.unit ?? "")}</text>
  ${v.sub ? `<text x="72" y="128" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" fill="#94a3b8">${esc(v.sub)}</text>` : ""}
</svg>`;
  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}

const FONT = "Segoe UI, Arial, sans-serif";

/** 200x100 image for one dial segment of the touch strip. */
export function renderDial(v: KeyView): string {
  const color = v.color ?? COLORS.ok;
  const graph = graphPaths(v.series, v.minSpan ?? 1, DIAL_AREA);
  const size = v.value.length > 5 ? 34 : v.value.length > 3 ? 42 : 50;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
  <rect width="200" height="100" fill="url(#g)"/>
  ${graph ? `<path d="${graph.area}" fill="${color}" fill-opacity="0.22"/><path d="${graph.line}" fill="none" stroke="${color}" stroke-opacity="0.55" stroke-width="2" stroke-linejoin="round"/>` : ""}
  <rect x="0" y="96" width="200" height="4" fill="${color}" opacity="0.8"/>
  <text x="100" y="24" text-anchor="middle" font-family="${FONT}" font-size="20" fill="#cbd5e1">${esc(v.label)}</text>
  <text x="100" y="70" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="700" fill="${color}">${esc(v.value)}<tspan font-size="20" font-weight="400" fill="#e2e8f0" dx="4">${esc(v.unit ?? "")}</tspan></text>
  ${v.sub ? `<text x="100" y="90" text-anchor="middle" font-family="${FONT}" font-size="15" fill="#94a3b8">${esc(v.sub)}</text>` : ""}
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export function offlineView(label: string, error: string): KeyView {
  return { label, value: "n/a", sub: error.slice(0, 18), color: COLORS.idle };
}

/** Settings from the property inspector arrive as strings; empty/invalid -> fallback. */
export function num(v: unknown, fallback?: number): number | undefined {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
