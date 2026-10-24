import type { Verdict } from "./check";

export const INK = "#13291F";

export const PALETTE: Record<Verdict, { color: string; soft: string; text: string }> = {
  recalled: { color: "#E5484D", soft: "#FDECEC", text: "#B4232A" },
  check_label: { color: "#F59E0B", soft: "#FEF3DC", text: "#8A5300" },
  clear: { color: "#12B76A", soft: "#E3F7EC", text: "#05603A" },
};

export const BRAND_GREEN = "#12B76A";

// The swing tag in a 120 by 80 box, tilted 10 degrees; the hole is cut out of the outline.
export const TAG_OUTLINE = "M32 8 H104 a10 10 0 0 1 10 10 V62 a10 10 0 0 1 -10 10 H32 L10 46 a9 9 0 0 1 0 -12 Z";
export const TAG_HOLE = "M31 40 a6 6 0 1 0 -12 0 a6 6 0 1 0 12 0 Z";

export const MARKS: Record<Verdict, { d: string; width: number; dot?: boolean }> = {
  clear: { d: "M52 41 L66 55 L94 27", width: 10 },
  check_label: { d: "M73 20 L73 46", width: 9, dot: true },
  recalled: { d: "M58 24 L88 54 M88 24 L58 54", width: 9 },
};

const NS = "http://www.w3.org/2000/svg";

function node(name: string, attributes: Record<string, string>) {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

// A verdict's tag, or the plain green logo tag without a mark.
export function tagSvg(verdict: Verdict | "brand", width: number) {
  const svg = node("svg", { viewBox: "0 0 120 80", width: String(width), height: String(Math.round((width * 2) / 3)), "aria-hidden": "true" });
  const group = node("g", { transform: "rotate(-10 60 40)" });
  const fill = verdict === "brand" ? BRAND_GREEN : PALETTE[verdict].color;
  group.append(node("path", { d: verdict === "brand" ? TAG_OUTLINE : `${TAG_OUTLINE} ${TAG_HOLE}`, fill, "fill-rule": "evenodd" }));
  if (verdict !== "brand") {
    const mark = MARKS[verdict];
    group.append(node("path", { d: mark.d, fill: "none", stroke: INK, "stroke-width": String(mark.width), "stroke-linecap": "round", "stroke-linejoin": "round" }));
    if (mark.dot) group.append(node("circle", { cx: "73", cy: "60", r: "5.5", fill: INK }));
  }
  svg.append(group);
  return svg;
}
