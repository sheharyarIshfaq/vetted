import type { Verdict } from "@/lib/verdict";

export type TagVariant = "brand" | "recalled" | "check" | "clear" | "plain";

const OUTLINE = "M32 8 H104 a10 10 0 0 1 10 10 V62 a10 10 0 0 1 -10 10 H32 L10 46 a9 9 0 0 1 0 -12 Z";
// The hole is cut out of the tag, so whatever is behind it shows through.
const HOLE = "M31 40 a6 6 0 1 0 -12 0 a6 6 0 1 0 12 0 Z";
const TICK = "M52 41 L66 55 L94 27";

const TAGS: Record<TagVariant, { fill: string; label: string }> = {
  brand: { fill: "var(--safe)", label: "Vetted" },
  recalled: { fill: "var(--recalled)", label: "Recalled" },
  check: { fill: "var(--check)", label: "Check the label" },
  clear: { fill: "var(--safe)", label: "No recall found" },
  plain: { fill: "var(--safe)", label: "Vetted" },
};

export const VERDICT_TAGS: Record<Verdict, TagVariant> = { recalled: "recalled", check_label: "check", clear: "clear" };

type Props = {
  variant: TagVariant;
  width?: number;
  // Decorative when the verdict is already written next to it.
  decorative?: boolean;
  className?: string;
};

// The swing tag: the logo, and the shape of every verdict.
export function VettedTag({ variant, width = 30, decorative = false, className }: Props) {
  const { fill, label } = TAGS[variant];
  return (
    <svg
      width={width}
      height={(width * 2) / 3}
      viewBox="0 0 120 80"
      className={`shrink-0 ${className ?? ""}`}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      <g transform="rotate(-10 60 40)">
        <path d={variant === "plain" ? OUTLINE : `${OUTLINE} ${HOLE}`} fill={fill} fillRule="evenodd" />
        <Mark variant={variant} />
      </g>
    </svg>
  );
}

function Mark({ variant }: { variant: TagVariant }) {
  const stroke = "var(--ink)";
  if (variant === "plain") return null;
  if (variant === "recalled") {
    return <path d="M58 24 L88 54 M88 24 L58 54" fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" />;
  }
  if (variant === "check") {
    return (
      <>
        <path d="M73 20 L73 46" fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" />
        <circle cx="73" cy="60" r="5.5" fill={stroke} />
      </>
    );
  }
  return <path d={TICK} fill="none" stroke={stroke} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />;
}
