// The four products on the home page: real recalls whose products were for sale on Leboncoin on 24 Oct 2026.
export const PRODUCTS = [
  {
    recallId: "rc:21110",
    name: "Acer ES Series 5 scooter",
    alt: "Acer ES Series 5 electric scooter",
    line: "A screw can come loose while riding.",
    tag: "RECALLED · EVERY UNIT",
    verdict: "recalled",
    fallback: "/home/acer.jpg",
  },
  {
    recallId: "rc:16243",
    name: "Fisher-Price baby toy set",
    alt: "Fisher-Price baby gym toy set in its box",
    line: "A choking risk for babies from 3 months.",
    tag: "RECALLED · CHOKING",
    verdict: "recalled",
    fallback: "/home/fisherprice.jpg",
  },
  {
    recallId: "rc:23843",
    name: "Hamax Buddy child bike seat",
    alt: "Hamax child bike seat, grey with red padding",
    line: "A loose label a child could choke on.",
    tag: "SOME UNITS · CHECK THE LABEL",
    verdict: "check_label",
    fallback: "/home/hamax.jpg",
  },
  {
    recallId: "rc:18131",
    name: "Tilgreen hoverboard",
    alt: "Tilgreen Tilboard hoverboard",
    line: "An electric shock risk.",
    tag: "ONE MODEL · CHECK THE LABEL",
    verdict: "check_label",
    fallback: "/home/tilgreen.jpg",
    // The notice's own image is a strip of several photos; this is one of them, cropped.
    cropped: true,
  },
] as const;

export const VERDICT_PILL = {
  recalled: "bg-recalled-soft text-recalled-text",
  check_label: "bg-check-soft text-check-text",
  clear: "bg-safe-soft text-safe-text",
} as const;
