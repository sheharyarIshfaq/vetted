import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const MAX_REDIRECTS = 3;
const USER_AGENT = "vetted-recall-check/0.1";

export class FetchBlockedError extends Error {}

// Loopback, private, link-local, carrier-grade NAT and other non-public ranges.
const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return isPublicAddress(mapped[1]);
  const family = isIP(address);
  if (family === 0) return false;
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchBlockedError("Only http and https links");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new FetchBlockedError("Private address");
  }
  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0 || !addresses.every(({ address }) => isPublicAddress(address))) {
    throw new FetchBlockedError("Private address");
  }
}

async function readLimited(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new FetchBlockedError(`Response larger than ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// Fetches a URL we did not choose ourselves: public hosts only, checked again on every redirect.
export async function safeFetch(
  rawUrl: string,
  { timeoutMs, maxBytes, headers }: { timeoutMs: number; maxBytes: number; headers?: Record<string, string> },
) {
  const signal = AbortSignal.timeout(timeoutMs);
  let url = new URL(rawUrl);
  for (let redirects = 0; ; redirects++) {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8", ...headers },
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      if (redirects >= MAX_REDIRECTS) throw new FetchBlockedError("Too many redirects");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.headers.get("content-type") ?? ""}`.trim());
    return {
      status: response.status,
      body: await readLimited(response, maxBytes),
      contentType: response.headers.get("content-type") ?? "",
      url: url.toString(),
    };
  }
}
