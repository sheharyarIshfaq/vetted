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
  // Set on a no-recall example: its reason is the check's own "searched" sentence, with the live count.
  searchedFor?: string;
  facts: Fact[];
  todo: string;
  source: string;
};

// "See it work": three real listings and what the live check says about each, copied from their check results.
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
    label: "Stroller",
    recallId: "rc:22017",
    fallback: null,
    alt: "Bébé Confort Sunlite car seat, from the official notice",
    caption: "Shown: the recalled Sunlite car seat, a different product",
    title: "Poussette Bébé Confort Sunlite, très bon état",
    verdict: "clear",
    tag: "NO RECALL FOUND",
    headline: "No recall matches this stroller.",
    reason: "Vetted searched the French and EU recall lists for Bébé Confort Sunlite and found no match. That doesn't prove an item is safe, so still check its condition before buying.",
    searchedFor: "Bébé Confort Sunlite",
    facts: [
      { mark: "no", text: "Not this recall: the recall is for a car seat, this is a stroller" },
      { mark: "ok", text: "Brand Bébé Confort matches the recall" },
      { mark: "ok", text: "Model Sunlite is named in the recall" },
      { mark: "warn", text: "The recall covers the car seat of the Sunlite; if this stroller comes with one, check that car seat's label" },
    ],
    todo: "Check its condition as you normally would.",
    source: "Closest notice · RappelConso · 14 Apr 2026",
  },
];
