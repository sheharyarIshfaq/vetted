import { VettedTag, type TagVariant } from "@/components/VettedTag";
import { Accent, Eyebrow } from "../ui";

const STEPS = [
  {
    title: "Show Vetted the listing",
    text: "Paste the title and description, add photos if you have them, or just open the listing with the Chrome extension.",
  },
  {
    title: "It searches the official lists",
    text: "AI reads the brand, model and codes, even with typos. Then Vetted looks for that exact product in every French and EU recall.",
  },
  {
    title: "You get a clear answer",
    text: "Fixed rules, not the AI, decide the answer. It always links to the government notice, so you can check it yourself.",
  },
];

const ANSWERS: { variant: TagVariant; title: string; text: string }[] = [
  {
    variant: "recalled",
    title: "Recalled",
    text: "This exact product is on an official danger list. Don't buy it as it is. The notice says what the owner should do.",
  },
  {
    variant: "check",
    title: "Check the label",
    text: "Only some units of this model are affected, for example ones made in certain months. Ask the seller for a photo of the label. Vetted writes the message for you, in French.",
  },
  {
    variant: "clear",
    title: "No recall found",
    text: "Nothing in the official lists matches. Vetted shows what it searched and anything that came close. Still check the item's condition, as you normally would.",
  },
];

const HEADING = "m-0 text-[2.2rem] leading-[1.02] font-semibold tracking-[-0.05em] sm:text-5xl";
const CARD = "flex flex-col rounded-[20px] border border-line bg-surface p-[26px]";

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto flex max-w-[1200px] scroll-mt-4 flex-col gap-9 px-4 pt-16 pb-12 sm:px-7 sm:pt-24 sm:pb-16">
      <div className="flex max-w-[40rem] flex-col gap-3">
        <Eyebrow>How it works</Eyebrow>
        <h2 className={HEADING}>
          Three steps. <Accent>About five seconds.</Accent>
        </h2>
      </div>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(17rem,100%),1fr))] gap-4 p-0">
        {STEPS.map((step, i) => (
          <li key={step.title} className={`${CARD} gap-3`}>
            <span className="flex size-9 items-center justify-center rounded-full bg-ink font-semibold text-paper">{i + 1}</span>
            <span className="text-[21px] font-semibold tracking-[-0.02em]">{step.title}</span>
            <span className="text-base leading-[1.55] text-ink-2">{step.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ThreeAnswers() {
  return (
    <section id="answers" className="mx-auto flex max-w-[1200px] scroll-mt-4 flex-col gap-8 px-4 pt-8 pb-16 sm:px-7 sm:pb-24">
      <div className="flex max-w-[40rem] flex-col gap-3">
        <Eyebrow>The three answers</Eyebrow>
        <h2 className={HEADING}>
          Every answer tells you <Accent>what to do next.</Accent>
        </h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(17rem,100%),1fr))] gap-4">
        {ANSWERS.map((answer) => (
          <div key={answer.title} className={`${CARD} gap-3.5`}>
            <VettedTag variant={answer.variant} width={64} decorative />
            <h3 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{answer.title}</h3>
            <p className="m-0 text-base leading-[1.55] text-ink-2">{answer.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
