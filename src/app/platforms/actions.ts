import { VERDICT_PILL } from "@/components/home/products";

// The three actions, in the home page's verdict colours.
export const ACTION_STYLES = {
  hold_listing: { label: "Hold the listing", verdict: "Recalled", pill: VERDICT_PILL.recalled, tag: "recalled" },
  ask_seller_for_label: { label: "Ask the seller for a label photo", verdict: "Check the label", pill: VERDICT_PILL.check_label, tag: "check" },
  publish: { label: "Publish", verdict: "No recall found", pill: VERDICT_PILL.clear, tag: "clear" },
} as const;
