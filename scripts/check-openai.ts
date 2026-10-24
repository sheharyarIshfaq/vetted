import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { openai, openaiModel } from "../src/lib/openai";

const Answer = z.object({ brand: z.string(), model: z.string() });

try {
  const response = await openai().responses.parse({
    model: openaiModel(),
    input: "Extract the brand and model: Poussette Britax Römer Smile III",
    text: { format: zodTextFormat(Answer, "answer") },
  });
  const parsed = Answer.parse(response.output_parsed);
  process.stdout.write(`OK ${openaiModel()}: ${parsed.brand} / ${parsed.model}\n`);
} catch (error) {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
