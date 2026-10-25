import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Packs the built extension as public/vetted-extension.zip, which unzips to a "vetted-extension" folder.
const root = fileURLToPath(new URL("..", import.meta.url));
const build = join(root, "extension/.output/chrome-mv3");
const target = join(root, "public/vetted-extension.zip");

// The download is for everyone, so it must talk to the live site, never a local server.
const manifest = JSON.parse(readFileSync(join(build, "manifest.json"), "utf8"));
if (manifest.host_permissions.some((pattern) => !pattern.startsWith("https://"))) {
  throw new Error(`Not zipping a build for ${manifest.host_permissions.join(", ")}: build it for the live site`);
}

const staging = mkdtempSync(join(tmpdir(), "vetted-extension-"));
cpSync(build, join(staging, "vetted-extension"), { recursive: true });
rmSync(target, { force: true });
execFileSync("zip", ["-rqX", target, "vetted-extension"], { cwd: staging });
rmSync(staging, { recursive: true, force: true });
process.stdout.write(`Zipped version ${manifest.version} to public/vetted-extension.zip\n`);
