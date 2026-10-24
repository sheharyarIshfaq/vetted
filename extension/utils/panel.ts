import { panelFor, resultUrl, STRINGS, type CheckResult, type Lang, type Verdict } from "./check";
import { INK, PALETTE, tagSvg } from "./tag";

const SANS = `"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
const MONO = `"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace`;

export const PANEL_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel { position: fixed; left: 20px; bottom: 20px; width: min(360px, calc(100vw - 32px)); max-height: calc(100vh - 40px); overflow-y: auto; background: #fff; color: ${INK}; border: 1px solid #E4DCCB; border-radius: 20px; box-shadow: 0 30px 60px -24px rgba(70, 52, 30, 0.45); font: 14px/1.5 ${SANS}; z-index: 2147483647; }
  .head { display: flex; align-items: center; justify-content: space-between; padding: 10px 8px 10px 16px; }
  .logo { display: flex; align-items: center; gap: 7px; font-weight: 700; letter-spacing: -0.05em; font-size: 17px; }
  .controls { display: flex; align-items: center; gap: 2px; }
  button, a { font: inherit; cursor: pointer; text-decoration: none; }
  .lang { min-height: 32px; padding: 0 10px; border: 1px solid #E4DCCB; border-radius: 999px; background: #fff; color: #8A7F6C; font-size: 12px; font-weight: 500; }
  .lang .on { color: ${INK}; font-weight: 700; }
  .close { width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; display: flex; align-items: center; justify-content: center; }
  .close:hover { background: #FAF6EE; }
  button:focus-visible, a:focus-visible { outline: 2px solid #1F6B4A; outline-offset: 2px; }
  .loading { padding: 6px 18px 22px; display: flex; flex-direction: column; gap: 14px; }
  .loading-title { font-size: 22px; font-weight: 600; letter-spacing: -0.03em; }
  .steps { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .steps li { display: flex; gap: 10px; align-items: center; color: #8A7F6C; }
  .steps li.done, .steps li.current { color: ${INK}; }
  .mark { flex: 0 0 18px; width: 18px; height: 18px; border-radius: 9px; border: 2px solid #DCD3C1; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
  .done .mark { border: 0; background: #12B76A; color: ${INK}; }
  .current .mark { border: 2.5px solid #1F6B4A; border-right-color: transparent; animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .current .mark { animation: none; } }
  .answer { margin: 0 10px; border-radius: 14px; padding: 14px 14px 16px; display: flex; flex-direction: column; gap: 6px; }
  .tag { font: 11px/1.4 ${MONO}; letter-spacing: 0.1em; }
  h2 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.15; }
  .reason { margin: 0; font-size: 14px; line-height: 1.5; color: #4B4438; }
  .body { padding: 14px 18px 4px; display: flex; flex-direction: column; gap: 12px; }
  .box { background: #FAF6EE; border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
  .box-title { font-size: 13px; font-weight: 600; }
  .box ul { margin: 0; padding: 0; list-style: none; font: 13px/1.6 ${MONO}; }
  .box.steps-to-do ul { font-family: ${SANS}; }
  a.source { align-self: flex-start; color: #1F6B4A; font: 12px/1.5 ${MONO}; text-decoration: none; }
  a.source:hover { color: ${INK}; text-decoration: underline; }
  .actions { padding: 12px 16px 16px; display: flex; gap: 8px; }
  .primary { flex-grow: 1; min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: ${INK}; color: #FAF6EE; font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; text-align: center; }
  .primary:hover { background: #1F6B4A; color: #FAF6EE; }
  .secondary { min-height: 44px; padding: 0 16px; border: 1px solid #DCD3C1; border-radius: 999px; background: #fff; color: ${INK}; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; }
  .secondary:hover { border-color: ${INK}; }
  .error { padding: 6px 18px 18px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
  .error p { margin: 0; color: #4B4438; }
  .photo-tag { position: fixed; z-index: 2147483646; display: flex; flex-direction: column; align-items: center; padding: 0; border: 0; background: none; cursor: pointer; }
  .photo-tag .string { width: 2px; height: 26px; background: ${INK}; }
  .photo-tag .label { position: relative; transform: rotate(-7deg); transform-origin: top center; padding: 9px 14px 9px 28px; font: 600 12px/1.2 ${MONO}; letter-spacing: 0.1em; color: ${INK}; white-space: nowrap; clip-path: polygon(13px 0, 100% 0, 100% 100%, 13px 100%, 0 50%); filter: drop-shadow(0 6px 8px rgba(70, 52, 30, 0.25)); }
  .photo-tag .hole { position: absolute; left: 9px; top: 50%; width: 8px; height: 8px; margin-top: -4px; border-radius: 4px; background: #fff; }
  @media (max-width: 560px) { .panel { left: 12px; bottom: 12px; width: calc(100vw - 24px); } }
`;

export type PanelState =
  | { kind: "loading"; withPhotos: boolean }
  | { kind: "result"; result: CheckResult }
  | { kind: "error"; message: string };

export type PanelActions = { onLang: () => void; onClose: () => void; onRetry: () => void };

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function link(className: string, text: string, href: string) {
  const anchor = element("a", className, text);
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

function closeIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M6 6l12 12M18 6L6 18");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#6B6253");
  path.setAttribute("stroke-width", "2.2");
  path.setAttribute("stroke-linecap", "round");
  svg.append(path);
  return svg;
}

function header(lang: Lang, actions: PanelActions) {
  const head = element("div", "head");
  const logo = element("span", "logo");
  logo.append(tagSvg("brand", 24), "vetted");

  const switcher = element("button", "lang");
  switcher.type = "button";
  switcher.lang = lang === "fr" ? "en" : "fr";
  switcher.setAttribute("aria-label", STRINGS[lang].language);
  switcher.append(element("span", lang === "fr" ? "on" : "", "FR"), " · ", element("span", lang === "en" ? "on" : "", "EN"));
  switcher.addEventListener("click", actions.onLang);

  const close = element("button", "close");
  close.type = "button";
  close.setAttribute("aria-label", STRINGS[lang].minimise);
  close.append(closeIcon());
  close.addEventListener("click", actions.onClose);

  const controls = element("div", "controls");
  controls.append(switcher, close);
  head.append(logo, controls);
  return head;
}

// The check is one request, so the steps advance on typical timings rather than live progress.
const STEP_AFTER = [0, 1500, 4500];

function loading(lang: Lang, withPhotos: boolean) {
  const box = element("div", "loading");
  box.setAttribute("role", "status");
  const steps = element("ul", "steps");
  const items = STRINGS[lang].steps.slice(0, withPhotos ? 3 : 2).map((text) => {
    const item = element("li");
    item.append(element("span", "mark"), text);
    steps.append(item);
    return item;
  });
  const started = Date.now();
  const advance = () => {
    const elapsed = Date.now() - started;
    const current = STEP_AFTER.findLastIndex((after, i) => i < items.length && elapsed >= after);
    items.forEach((item, i) => {
      item.className = i < current ? "done" : i === current ? "current" : "";
      (item.firstChild as HTMLElement).textContent = i < current ? "✓" : "";
    });
  };
  advance();
  // Stops by itself once the loading view is replaced.
  const timer = setInterval(() => (box.isConnected || Date.now() - started < 1000 ? advance() : clearInterval(timer)), 250);
  box.append(element("span", "loading-title", STRINGS[lang].checking), steps);
  return box;
}

function copyButton(message: string, lang: Lang) {
  const strings = STRINGS[lang];
  const button = element("button", "primary", strings.copy);
  button.type = "button";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(message);
      button.textContent = strings.copied;
    } catch {
      button.textContent = strings.copyFailed;
    }
    setTimeout(() => (button.textContent = strings.copy), 2500);
  });
  return button;
}

function box(title: string, lines: string[], className = "box") {
  const container = element("div", className);
  const list = element("ul");
  for (const line of lines) list.append(element("li", "", line));
  container.append(element("span", "box-title", title), list);
  return container;
}

function answer(result: CheckResult, lang: Lang) {
  const strings = STRINGS[lang];
  const colors = PALETTE[result.verdict];
  const summary = panelFor(result, lang);
  const fragment = document.createDocumentFragment();

  const block = element("div", "answer");
  block.style.background = colors.soft;
  const tag = element("span", "tag", strings.tag[result.verdict]);
  tag.style.color = colors.text;
  block.append(tag, element("h2", "", strings.headline[result.verdict]));
  if (summary?.line) block.append(element("p", "reason", summary.line));
  if (summary?.risk) block.append(element("p", "reason", summary.risk));

  const body = element("div", "body");
  if (summary?.lookFor.length) body.append(box(strings.lookFor, summary.lookFor));
  if (summary?.whatToDo.length) body.append(box(strings.whatToDo, summary.whatToDo, "box steps-to-do"));
  if (summary?.source) {
    const label = result.verdict === "clear" ? strings.closestNotice : strings.officialNotice;
    body.append(link("source", `${label} · ${summary.source.label} →`, summary.source.url));
  }

  const actions = element("div", "actions");
  const details = resultUrl(result);
  if (result.verdict === "clear") actions.append(link("primary", strings.searched, details));
  else {
    if (result.verdict === "check_label" && summary?.sellerMessage) actions.append(copyButton(summary.sellerMessage, lang));
    else actions.append(link("primary", strings.readNotice, summary?.source?.url ?? result.recall?.url ?? details));
    actions.append(link("secondary", strings.details, details));
  }

  fragment.append(block);
  if (body.childElementCount) fragment.append(body);
  fragment.append(actions);
  return fragment;
}

function failure(message: string, lang: Lang, onRetry: () => void) {
  const container = element("div", "error");
  container.setAttribute("role", "alert");
  const retry = element("button", "secondary", STRINGS[lang].retry);
  retry.type = "button";
  retry.addEventListener("click", onRetry);
  container.append(element("p", "", message), retry);
  return container;
}

export function renderPanel(state: PanelState, lang: Lang, actions: PanelActions) {
  const panel = element("section", "panel");
  panel.setAttribute("aria-label", "Vetted recall check");
  panel.lang = lang;
  panel.append(header(lang, actions));
  if (state.kind === "loading") panel.append(loading(lang, state.withPhotos));
  else if (state.kind === "result") panel.append(answer(state.result, lang));
  else panel.append(failure(state.message, lang, actions.onRetry));
  return panel;
}

// The tag that hangs on the listing photo; clicking it opens the panel again.
export function photoTag(verdict: Verdict, lang: Lang, onClick: () => void) {
  const button = element("button", "photo-tag");
  button.type = "button";
  button.setAttribute("aria-label", `Vetted: ${STRINGS[lang].tag[verdict].toLowerCase()}`);
  const label = element("span", "label", STRINGS[lang].tag[verdict]);
  label.style.background = PALETTE[verdict].color;
  label.append(element("span", "hole"));
  button.append(element("span", "string"), label);
  button.addEventListener("click", onClick);
  return button;
}
