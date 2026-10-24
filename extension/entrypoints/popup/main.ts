import { browser } from "wxt/browser";
import { isListingUrl, isSavedCheck, resultUrl, toCheckResponse, VERDICT_LABELS, type SavedCheck } from "../../utils/check";
import { INK, PALETTE, tagSvg } from "../../utils/tag";

const SANS = `"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
const MONO = `"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace`;

const style = document.createElement("style");
style.textContent = `
  * { box-sizing: border-box; }
  body { margin: 0; width: 340px; background: #fff; color: ${INK}; font: 14px/1.5 ${SANS}; }
  [hidden] { display: none !important; }
  button:focus-visible, a:focus-visible, textarea:focus-visible { outline: 2px solid #1F6B4A; outline-offset: 2px; }
  .head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; }
  .logo { display: flex; align-items: center; gap: 7px; font-weight: 700; letter-spacing: -0.05em; font-size: 17px; }
  .where { font: 11px ${MONO}; color: #8A7F6C; }
  .card { margin: 0 12px; border-radius: 14px; padding: 16px; display: flex; gap: 14px; align-items: center; }
  .card img, .thumb { width: 56px; height: 72px; object-fit: contain; background: #fff; border-radius: 10px; flex-shrink: 0; }
  .card .text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .tag { font: 11px ${MONO}; letter-spacing: 0.08em; }
  .headline { font-size: 17px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.25; }
  .name { font-size: 13px; color: #4B4438; overflow-wrap: anywhere; }
  .stack { padding: 14px 12px 16px; display: flex; flex-direction: column; gap: 8px; }
  .primary, .secondary { font: inherit; font-size: 14px; min-height: 44px; border-radius: 999px; cursor: pointer; display: flex; align-items: center; justify-content: center; text-decoration: none; }
  .primary { border: 0; background: ${INK}; color: #FAF6EE; font-weight: 600; }
  .primary:hover { background: #1F6B4A; }
  .primary:disabled { opacity: .6; cursor: wait; }
  .secondary { border: 1px solid #DCD3C1; background: #fff; color: ${INK}; font-weight: 500; }
  .secondary:hover { border-color: ${INK}; }
  .paste { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 12px; }
  .paste h1 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.2; }
  .paste p { margin: 0; color: #4B4438; }
  label { font-size: 13px; font-weight: 500; }
  textarea { font: inherit; font-size: 14px; padding: 10px 12px; border: 1px solid #DCD3C1; border-radius: 12px; resize: none; background: #FAF6EE; color: ${INK}; }
  .error { margin: 0; color: #B4232A; font-size: 13px; }
  ul { margin: 0; padding: 0 8px 8px; list-style: none; display: flex; flex-direction: column; }
  li a { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 12px; text-decoration: none; color: ${INK}; min-height: 44px; }
  li a:hover { background: #FAF6EE; }
  li .thumb { width: 36px; height: 44px; background: #FAF6EE; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
  li .lines { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  li .title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li .verdict { font-size: 12px; }
  .empty { margin: 0; padding: 4px 16px 16px; color: #4B4438; }
  .foot { border-top: 1px solid #F0EADF; padding: 4px 8px 4px 16px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #8A7F6C; }
  .link { font: inherit; font-size: 12px; min-height: 40px; padding: 0 8px; border: 0; background: none; color: #1F6B4A; cursor: pointer; }
`;
document.head.append(style);

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(className: string, text: string, onClick: () => void) {
  const node = element("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function openTab(url: string) {
  void browser.tabs.create({ url });
  window.close();
}

function header(right: string) {
  const head = element("div", "head");
  const logo = element("span", "logo");
  logo.append(tagSvg("brand", 24), "vetted");
  head.append(logo, element("span", "where", right));
  return head;
}

function photo(check: SavedCheck, className: string) {
  if (!check.image) {
    const box = element("span", className);
    box.append(tagSvg(check.verdict, 28));
    return box;
  }
  const image = element("img", className);
  image.src = check.image;
  image.alt = "";
  image.referrerPolicy = "no-referrer";
  return image;
}

const app = document.querySelector<HTMLDivElement>("#app")!;
const [tab] = await browser.tabs.query({ active: true, currentWindow: true }).catch(() => []);
const onListing = tab?.id !== undefined && isListingUrl(tab.url);

async function history() {
  const { history } = await browser.storage.local.get("history");
  return Array.isArray(history) ? history.filter(isSavedCheck) : [];
}

function footer(text: string, action: string, onClick: () => void) {
  const foot = element("div", "foot");
  foot.append(element("span", "", text), button("link", action, onClick));
  return foot;
}

// On a listing: the verdict the page's own check gave, and a way to run it again.
async function listingView() {
  const saved: unknown = await browser.runtime.sendMessage({ type: "TIKO_GET_RESULT", tabId: tab!.id }).catch(() => null);
  const check = isSavedCheck(saved) && saved.pageUrl === tab!.url ? saved : null;
  const host = new URL(tab!.url!).hostname.replace(/^www\./, "");
  const nodes: Node[] = [header(host)];

  const again = button("secondary", "Check again", async () => {
    again.disabled = true;
    again.textContent = "Checking…";
    error.hidden = true;
    try {
      const outcome = toCheckResponse(await browser.tabs.sendMessage(tab!.id!, { type: "TIKO_CHECK_PAGE" }), "Vetted couldn't check this page. Try again.");
      if (outcome.ok) return void render(listingView);
      error.textContent = outcome.error;
    } catch {
      // The page was open before the extension loaded, so nothing is listening yet.
      error.textContent = "Reload the listing page, then try again.";
    }
    error.hidden = false;
    again.disabled = false;
    again.textContent = "Check again";
  });
  const error = element("p", "error");
  error.setAttribute("role", "alert");
  error.hidden = true;

  const stack = element("div", "stack");
  if (check) {
    const colors = PALETTE[check.verdict];
    const card = element("div", "card");
    card.style.background = colors.soft;
    const text = element("div", "text");
    const tag = element("span", "tag", VERDICT_LABELS[check.verdict].toUpperCase());
    tag.style.color = colors.text;
    text.append(tag, element("span", "headline", check.headline), element("span", "name", check.title));
    card.append(photo(check, "thumb"), text);
    nodes.push(card);
    stack.append(button("primary", "See the full answer", () => openTab(resultUrl(check))));
  }
  stack.append(again, error);
  nodes.push(stack, footer("", "Your checks", () => render(historyView)));
  return nodes;
}

// Anywhere else: pasted text goes through the same check as the website.
function pasteView() {
  const form = element("form", "paste");
  const textarea = element("textarea");
  textarea.id = "pop-text";
  textarea.rows = 3;
  textarea.maxLength = 5000;
  textarea.placeholder = "Title and description…";
  const label = element("label", "", "Listing text");
  label.htmlFor = "pop-text";
  const submit = element("button", "primary", "Check it");
  submit.type = "submit";
  const error = element("p", "error");
  error.setAttribute("role", "alert");
  error.hidden = true;
  form.append(
    element("h1", "", "Open a listing on Leboncoin or Vinted"),
    element("p", "", "We'll check it automatically. Anywhere else, paste the text here."),
    label,
    textarea,
    submit,
    error,
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!textarea.value.trim()) {
      error.textContent = "Paste the listing's title and description first.";
      error.hidden = false;
      return;
    }
    submit.disabled = true;
    submit.textContent = "Checking…";
    error.hidden = true;
    const body = new FormData();
    body.append("text", textarea.value.trim());
    const response = await fetch(`${__TIKO_API_BASE_URL__}/api/check`, { method: "POST", body }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (response?.ok && result?.id) return openTab(resultUrl({ id: result.id }));
    error.textContent = result?.error ?? "Vetted can't be reached right now. Check your connection and try again.";
    error.hidden = false;
    submit.disabled = false;
    submit.textContent = "Check it";
  });
  return [header(""), form, footer("", "Your checks", () => render(historyView))];
}

// The last checks, kept in this browser only.
async function historyView() {
  const checks = await history();
  const nodes: Node[] = [header("Your checks")];
  if (checks.length === 0) nodes.push(element("p", "empty", "No checks yet. Open a listing on Leboncoin or Vinted."));
  else {
    const list = element("ul");
    for (const check of checks) {
      const link = element("a");
      link.href = resultUrl(check);
      link.addEventListener("click", (event) => {
        event.preventDefault();
        openTab(link.href);
      });
      const lines = element("span", "lines");
      const verdict = element("span", "verdict", VERDICT_LABELS[check.verdict]);
      verdict.style.color = PALETTE[check.verdict].text;
      lines.append(element("span", "title", check.title), verdict);
      link.append(photo(check, "thumb"), lines);
      const item = element("li");
      item.append(link);
      list.append(item);
    }
    nodes.push(list);
  }
  nodes.push(footer("Saved on this computer only", "Back", () => render(onListing ? listingView : pasteView)));
  return nodes;
}

async function render(view: () => Node[] | Promise<Node[]>) {
  app.replaceChildren(...(await view()));
}

await render(onListing ? listingView : pasteView);

export {};
