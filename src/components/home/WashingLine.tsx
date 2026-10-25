const KRAFT = { bg: "var(--kraft)", fg: "var(--kraft-text)" };
const GREEN = { bg: "var(--safe)", fg: "var(--ink)" };
const AMBER = { bg: "var(--check)", fg: "var(--ink)" };
const RED = { bg: "var(--recalled)", fg: "var(--ink)" };

// Where each tag hangs along the line (0 to 1), how long its string is, and its tilt.
const TAGS = [
  { t: 0.05, len: 34, rot: -8, colors: KRAFT, text: "€12" },
  { t: 0.12, len: 58, rot: 6, colors: KRAFT, text: "€40" },
  { t: 0.19, len: 26, rot: -4, colors: GREEN, text: "✓" },
  { t: 0.27, len: 48, rot: 10, colors: KRAFT, text: "€5" },
  { t: 0.34, len: 30, rot: -11, colors: KRAFT, text: "€85" },
  { t: 0.41, len: 62, rot: 3, colors: AMBER, text: "!" },
  { t: 0.49, len: 36, rot: -6, colors: KRAFT, text: "€20" },
  { t: 0.57, len: 54, rot: 8, colors: KRAFT, text: "€150" },
  { t: 0.64, len: 28, rot: -3, colors: RED, text: "×" },
  { t: 0.72, len: 46, rot: 12, colors: KRAFT, text: "€280" },
  { t: 0.8, len: 32, rot: -9, colors: GREEN, text: "✓" },
  { t: 0.88, len: 56, rot: 5, colors: KRAFT, text: "€30" },
  { t: 0.95, len: 30, rot: -7, colors: KRAFT, text: "€8" },
];

// The line is a curve from y=64 at both edges down through y=184; each tag hangs from its point on it.
function lineY(t: number) {
  return (1 - t) * (1 - t) * 64 + 2 * (1 - t) * t * 184 + t * t * 64;
}

export function WashingLine() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-(--line-drop) bottom-0 hidden md:block [@media(max-height:620px)]:hidden">
      <svg width="100%" viewBox="0 0 1440 240" preserveAspectRatio="none" className="absolute top-0 left-0 h-[calc(240px*var(--fit))]">
        <path d="M-20 64 Q 720 184 1460 64" fill="none" stroke="var(--kraft-text)" strokeWidth="2" />
      </svg>
      {TAGS.map((tag) => {
        const mark = tag.text.length === 1;
        return (
          <div
            key={tag.t}
            className="absolute flex w-0 flex-col items-center"
            style={{ left: `${tag.t * 100}%`, top: `calc(${Math.round(lineY(tag.t) - 1)}px * var(--fit))` }}
          >
            <div className="w-[1.5px] bg-kraft-text" style={{ height: `calc(${tag.len}px * var(--fit))` }} />
            <div
              className="relative -mt-0.5 origin-top drop-shadow-[0_6px_8px_rgba(70,52,30,0.18)]"
              style={{ transform: `rotate(${tag.rot}deg) scale(var(--type))` }}
            >
              <div
                className={`flex items-end justify-center pb-2.5 font-mono font-semibold [clip-path:polygon(50%_0,100%_20%,100%_100%,0_100%,0_20%)] ${
                  mark ? "h-[72px] w-[52px] text-[22px]" : "h-[66px] w-12 text-[13px]"
                }`}
                style={{ background: tag.colors.bg, color: tag.colors.fg }}
              >
                {tag.text}
              </div>
              <span className="absolute top-[9px] left-1/2 -ml-[3.5px] size-[7px] rounded-full bg-paper shadow-[inset_0_0_0_1.5px_rgba(94,82,66,0.45)]" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
