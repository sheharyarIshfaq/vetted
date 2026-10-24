import type { Verdict } from "@/lib/verdict";

// Example listings for the "Try" chips. Each one runs a real check against the live data.
export const EXAMPLES = [
  { label: "Britax Smile III", text: "Poussette Britax Römer Smile III châssis et siège, étiquette : fabriqué en 03/2020" },
  { label: "Hamax Buddy", text: "Siège vélo enfant Hamax Buddy" },
  { label: "Wooden high chair", text: "Chaise haute en bois" },
] as const;

type Fact = { mark: "ok" | "warn" | "no"; text: string };

export type Showcase = {
  label: string;
  recallId: string;
  fallback: string | null;
  alt: string;
  caption: string;
  title: string;
  verdict: Verdict;
  tag: string;
  headline: string;
  reason: string;
  facts: Fact[];
  todo: string;
  source: string;
};

// "See it work": three real listings and what the live check says about each. The Belkin listing reads as
// check-the-label against the BoostCharge Pro 10K recall, so its copy follows that, not a no-recall answer.
export const SHOWCASES: Showcase[] = [
  {
    label: "Electric scooter",
    recallId: "rc:21110",
    fallback: "/home/acer.jpg",
    alt: "Acer ES Series 5 electric scooter",
    caption: "Leboncoin listing · photo from the official notice",
    title: "Trottinette électrique Acer ES Series 5, 470W, état neuf",
    verdict: "recalled",
    tag: "RECALLED",
    headline: "Don't buy it as it is.",
    reason: "A screw may not have been tightened at the factory, and it can come loose while you ride.",
    facts: [
      { mark: "ok", text: "Brand and model are named in the notice" },
      { mark: "ok", text: "Every unit is recalled, whatever the date" },
    ],
    todo: "Skip this one, or ask the seller to show it was repaired under the recall.",
    source: "Official notice · RappelConso · 31 Jan 2026",
  },
  {
    label: "Child bike seat",
    recallId: "rc:23843",
    fallback: "/home/hamax.jpg",
    alt: "Hamax child bike seat",
    caption: "Leboncoin listing · photo from the official notice",
    title: "Siège enfant Hamax Buddy, très bon état",
    verdict: "check_label",
    tag: "CHECK THE LABEL",
    headline: "Ask the seller for the label.",
    reason: "Only seats made from January 2022 to August 2026 are recalled, for a choking risk. The listing does not say when this one was made.",
    facts: [
      { mark: "ok", text: "Brand and model are named in the notice" },
      { mark: "warn", text: "Date of manufacture not in the listing" },
    ],
    todo: "Copy the French message Vetted writes and ask for a photo of the label.",
    source: "Official notice · RappelConso · 19 Oct 2026",
  },
  {
    label: "Power bank",
    recallId: "rc:16233",
    fallback: null,
    alt: "Belkin BoostCharge Pro 10K power bank, the recalled version",
    caption: "Shown: the recalled BoostCharge Pro 10K, from the official notice",
    title: "Batterie externe Belkin BoostCharge Power Bank 10K+",
    verdict: "check_label",
    tag: "CHECK THE LABEL",
    headline: "Ask the seller for the label.",
    reason: "Belkin recalled the BoostCharge Pro 10K power bank for a fire risk. The listing doesn't say whether this one is the Pro.",
    facts: [
      { mark: "ok", text: "Brand is named in the notice" },
      { mark: "warn", text: "The notice names the BoostCharge Pro; the listing doesn't say which version this is" },
    ],
    todo: "Ask the seller for a photo of the label showing the exact model.",
    source: "Official notice · RappelConso · 15 Nov 2024",
  },
];
