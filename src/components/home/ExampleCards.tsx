import { RemoteImage } from "@/components/check/RemoteImage";
import { VerdictSticker, type StickerKind } from "@/components/VerdictSticker";
import { monthNumber } from "@/lib/check/copy";
import { getRecalls } from "@/lib/db/recalls";
import { recallLimits } from "@/lib/verdict";

type Card = { title: string; meta: string; verdict: StickerKind; image: string | null; tilt: string };

function period(from: string | null, to: string | null) {
  if (from && to) return `made ${monthNumber(from)} to ${monthNumber(to)}`;
  if (from) return `from ${monthNumber(from)}`;
  return to ? `up to ${monthNumber(to)}` : null;
}

// What the three examples look like as results, with dates and photos from the official notices.
export async function ExampleCards() {
  const recalls = await getRecalls(["rc:22625", "rc:23843"]);
  const britax = recalls.find((recall) => recall.id === "rc:22625");
  const hamax = recalls.find((recall) => recall.id === "rc:23843");
  const noItem = { references: [], modelVariant: null };

  const cards: Card[] = [];
  if (britax) {
    const limits = recallLimits({ ...noItem, model: "Smile III" }, britax);
    cards.push({
      title: "Poussette Britax Smile III",
      meta: ["Recalled", period(limits.from, limits.to)].filter(Boolean).join(" · "),
      verdict: "recalled",
      image: britax.images[0] ?? null,
      tilt: "-rotate-[1.5deg]",
    });
  }
  if (hamax) {
    const limits = recallLimits({ ...noItem, model: "Buddy" }, hamax);
    cards.push({
      title: "Siège vélo Hamax Buddy",
      meta: ["Check the label", period(limits.from, limits.to)].filter(Boolean).join(" · "),
      verdict: "check_label",
      image: hamax.images[0] ?? null,
      tilt: "sm:ml-7",
    });
  }
  cards.push({ title: "Chaise haute en bois", meta: "No recall found", verdict: "clear", image: null, tilt: "rotate-1" });

  return (
    <div aria-label="Example results" role="group" className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
      {cards.map((card) => (
        <div key={card.title} className={`flex items-center gap-3.5 rounded-[18px] border border-line bg-surface p-[18px] ${card.tilt}`}>
          {card.image ? (
            <RemoteImage src={card.image} alt="" className="size-[72px] shrink-0 rounded-xl bg-placeholder object-cover" />
          ) : (
            <div aria-hidden="true" className="size-[72px] shrink-0 rounded-xl bg-placeholder" />
          )}
          <div className="min-w-0 grow">
            <div className="font-bold">{card.title}</div>
            <div className="text-[13px] text-muted">{card.meta}</div>
          </div>
          <VerdictSticker verdict={card.verdict} size={44} decorative />
        </div>
      ))}
    </div>
  );
}
