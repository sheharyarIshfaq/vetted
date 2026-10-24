import type { Verdict } from "./check";

export const PALETTE: Record<Verdict, { color: string; soft: string; text: string }> = {
  recalled: { color: "#C2362B", soft: "#FBE9E7", text: "#8F2219" },
  check_label: { color: "#B86A00", soft: "#FBF1E3", text: "#7A4700" },
  clear: { color: "#1E7F55", soft: "#E7F1EC", text: "#145C3E" },
};

const MARKS: Record<Verdict, { d: string; dot?: boolean }> = {
  clear: { d: "M31 53 L45 67 L73 37" },
  check_label: { d: "M52 28 L52 58", dot: true },
  recalled: { d: "M35 35 L69 69 M69 35 L35 69" },
};

// The tilted verdict sticker from the design: a coloured disc with a white tick, exclamation mark or cross.
export function sticker(verdict: Verdict, size: number) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 104 104");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  const group = document.createElementNS(ns, "g");
  group.setAttribute("transform", "rotate(-8 52 52)");
  const disc = document.createElementNS(ns, "circle");
  disc.setAttribute("cx", "52");
  disc.setAttribute("cy", "52");
  disc.setAttribute("r", "46");
  disc.setAttribute("fill", PALETTE[verdict].color);
  const mark = document.createElementNS(ns, "path");
  mark.setAttribute("d", MARKS[verdict].d);
  mark.setAttribute("fill", "none");
  mark.setAttribute("stroke", "#fff");
  mark.setAttribute("stroke-width", "11");
  mark.setAttribute("stroke-linecap", "round");
  mark.setAttribute("stroke-linejoin", "round");
  group.append(disc, mark);
  if (MARKS[verdict].dot) {
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", "52");
    dot.setAttribute("cy", "75");
    dot.setAttribute("r", "7");
    dot.setAttribute("fill", "#fff");
    group.append(dot);
  }
  svg.append(group);
  return svg;
}
