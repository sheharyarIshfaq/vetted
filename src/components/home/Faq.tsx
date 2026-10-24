const QUESTIONS = [
  {
    q: "What exactly is a recall?",
    a: "An official warning that a product can be dangerous. The brand and the government publish it, say which units are affected, and tell owners what to do, usually stop using it and get a free repair, replacement or refund.",
  },
  {
    q: "Where does the data come from?",
    a: "From the two official sources: RappelConso, run by the French government, and Safety Gate, the European Commission's list of dangerous products. Vetted downloads both every day. It never makes up a recall.",
  },
  { q: "Is it free?", a: "Yes. Checking a listing on the website or with the Chrome extension is free, with no account." },
  {
    q: "Can the AI get it wrong?",
    a: 'The AI only reads the listing. The answer comes from fixed rules that compare it with the official notice, and Vetted shows you that notice so you can check it. When it can\'t be sure, it says "check the label" instead of guessing.',
  },
  {
    q: "What kinds of products does it cover?",
    a: "Anything in the French and EU recall lists: car seats, prams, toys, bikes and scooters, chargers and power banks, appliances, clothing and more.",
  },
  { q: "Does the extension read my data?", a: "No. It only reads the listing page you open, and only on Leboncoin and Vinted. No account, no tracking." },
  {
    q: "What if something I already own is recalled?",
    a: "Follow the steps in the official notice. Usually you stop using it and contact the brand for a free repair, replacement or refund.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto flex max-w-[900px] scroll-mt-4 flex-col gap-7 px-4 py-24 sm:px-7">
      <h2 className="m-0 text-center text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.045em] sm:text-[2.6rem]">Questions people ask</h2>
      <div className="flex flex-col border-t border-line">
        {QUESTIONS.map((item) => (
          <details key={item.q} className="group border-b border-line px-1 py-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden="true" className="text-xl font-normal text-muted transition-transform group-open:rotate-45 motion-reduce:transition-none">
                +
              </span>
            </summary>
            <p className="mt-1 mb-3 text-base leading-[1.6] text-ink-2">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
