export type StickerKind = "recalled" | "check_label" | "clear" | "brand";

const STICKERS: Record<StickerKind, { fill: string; label: string }> = {
  recalled: { fill: "var(--recalled)", label: "Recalled" },
  check_label: { fill: "var(--check)", label: "Check the label" },
  clear: { fill: "var(--safe)", label: "No recall found" },
  brand: { fill: "var(--brand)", label: "Vetted" },
};

type Props = {
  verdict: StickerKind;
  size?: number;
  // Decorative when the verdict is already written next to it.
  decorative?: boolean;
};

export function VerdictSticker({ verdict, size = 40, decorative = false }: Props) {
  const { fill, label } = STICKERS[verdict];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 104 104"
      className="shrink-0"
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      <g transform="rotate(-8 52 52)">
        <circle cx="52" cy="52" r="46" fill={fill} />
        <Symbol verdict={verdict} />
      </g>
    </svg>
  );
}

function Symbol({ verdict }: { verdict: StickerKind }) {
  if (verdict === "recalled") {
    return <path d="M36 36 L68 68 M68 36 L36 68" stroke="#FFFFFF" strokeWidth="11" strokeLinecap="round" />;
  }
  if (verdict === "check_label") {
    return (
      <>
        <path d="M52 28 L52 58" stroke="#FFFFFF" strokeWidth="11" strokeLinecap="round" />
        <circle cx="52" cy="75" r="7" fill="#FFFFFF" />
      </>
    );
  }
  return (
    <path
      d="M32 53 L46 67 L73 38"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
