import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { EXTENSION_ZIP } from "@/components/AddToChrome";
import { CopyMessageButton } from "@/components/check/CopyMessageButton";
import { buttonStyles } from "@/components/ui";
import extension from "../../../extension/package.json";

type Shot = { src: string; width: number; height: number; alt: string };

// Real screenshots from Chrome, taken while installing the published zip; the red ring marks what to click.
const SHOTS = {
  download: {
    src: "/install/download.webp",
    width: 1480,
    height: 312,
    alt: "Chrome's download list showing vetted-extension.zip from vetted.sheharyarishfaq.com, with the Show in folder icon circled",
  },
  developerMode: {
    src: "/install/developer-mode.webp",
    width: 820,
    height: 116,
    alt: "The Developer mode switch at the top right of chrome://extensions, circled",
  },
  loadUnpacked: {
    src: "/install/load-unpacked.webp",
    width: 660,
    height: 128,
    alt: "The Load unpacked button that appears once Developer mode is on, circled",
  },
  installed: {
    src: "/install/installed.webp",
    width: 864,
    height: 532,
    alt: `Vetted · recall check ${extension.version} listed in chrome://extensions after loading the folder`,
  },
} satisfies Record<string, Shot>;

function Screenshot({ shot, className = "" }: { shot: Shot; className?: string }) {
  return (
    <Image
      src={shot.src}
      width={shot.width}
      height={shot.height}
      alt={shot.alt}
      sizes="(min-width: 768px) 560px, 100vw"
      className={`h-auto w-full rounded-xl border border-line bg-surface ${className}`}
    />
  );
}

function Step({ number, title, children, shots }: { number: number; title: string; children: ReactNode; shots: ReactNode }) {
  return (
    <li className="grid gap-5 rounded-[20px] border border-line bg-surface p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-center md:gap-8">
      <div className="flex flex-col gap-2.5">
        <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-ink font-mono text-[15px] text-paper">
          {number}
        </span>
        <h3 className="m-0 text-xl font-semibold tracking-[-0.02em]">{title}</h3>
        <div className="flex flex-col gap-2.5 text-base leading-[1.6] text-ink-2">{children}</div>
      </div>
      <div className="flex flex-col gap-3">{shots}</div>
    </li>
  );
}

export function InstallSteps() {
  return (
    <section id="extension" aria-labelledby="extension-title" className="flex scroll-mt-6 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-[13px] tracking-[0.06em] text-brand uppercase">Chrome extension · version {extension.version}</span>
        <h2 id="extension-title" className="m-0 text-[30px] leading-[1.1] font-semibold tracking-[-0.04em] text-balance sm:text-[36px]">
          Add Vetted to Chrome in about a minute
        </h2>
        <p className="m-0 max-w-[720px] text-[17px] leading-[1.6] text-ink-2">
          The extension shows the same check next to the Leboncoin or Vinted listing you&apos;re viewing. It isn&apos;t in the Chrome
          Web Store yet, so you add it yourself: three steps, once. It works in Chrome on a computer.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href={EXTENSION_ZIP} download className={buttonStyles.primary}>
            Download vetted-extension.zip
          </a>
          <span className="text-sm text-muted">
            Version {extension.version} · <Link href="/privacy">what it reads</Link>
          </span>
        </div>
      </div>

      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        <Step number={1} title="Unzip the download" shots={<Screenshot shot={SHOTS.download} />}>
          <p className="m-0">
            Chrome saves <strong className="font-semibold text-ink">vetted-extension.zip</strong> in your Downloads folder. Open the
            folder (the circled icon in Chrome&apos;s downloads does it), then double-click the zip. On Windows, right-click it and
            choose <strong className="font-semibold text-ink">Extract All</strong>.
          </p>
          <p className="m-0">
            You get a folder called <strong className="font-semibold text-ink">vetted-extension</strong>. Keep it: Chrome runs Vetted
            from this folder.
          </p>
        </Step>

        <Step number={2} title="Turn on Developer mode" shots={<Screenshot shot={SHOTS.developerMode} />}>
          <p className="m-0">
            Open a new tab, paste <span className="font-mono text-[15px] text-ink">chrome://extensions</span> into the address bar and
            press Enter. Then switch on <strong className="font-semibold text-ink">Developer mode</strong>, top right.
          </p>
          <div className="self-start">
            <CopyMessageButton message="chrome://extensions" label="Copy chrome://extensions" />
          </div>
          <p className="m-0 text-sm text-muted">Developer mode only lets Chrome load an extension from a folder. Nothing else changes.</p>
        </Step>

        <Step
          number={3}
          title="Click Load unpacked and pick the folder"
          shots={
            <>
              <Screenshot shot={SHOTS.loadUnpacked} className="max-w-[330px]" />
              <Screenshot shot={SHOTS.installed} className="max-w-[432px]" />
            </>
          }
        >
          <p className="m-0">
            Click <strong className="font-semibold text-ink">Load unpacked</strong>, top left, and select the{" "}
            <strong className="font-semibold text-ink">vetted-extension</strong> folder (the folder, not the zip).
          </p>
          <p className="m-0">
            <strong className="font-semibold text-ink">Vetted · recall check {extension.version}</strong> appears in your extensions.
            That&apos;s it.
          </p>
        </Step>
      </ol>

      <div className="flex flex-col gap-2 rounded-[20px] bg-sage p-5 text-[15px] leading-[1.6] text-sage-text sm:p-6">
        <p className="m-0">
          <strong className="font-semibold text-ink">Now open any listing on Leboncoin or Vinted.</strong> The Vetted panel appears on
          its own. To keep Vetted in reach, click the puzzle-piece icon in Chrome&apos;s toolbar and pin it.
        </p>
        <p className="m-0">
          To update later, download the new zip, replace the vetted-extension folder, and click the reload arrow on the Vetted card in
          chrome://extensions.
        </p>
        <p className="m-0">
          Not sure which listing to open? <Link href="/try">Try it on real recalled listings</Link>.
        </p>
      </div>
    </section>
  );
}
