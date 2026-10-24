import { parseArgs } from "node:util";
import { db } from "../src/lib/db/client";
import { embedRecalls } from "../src/lib/ingest/embed-recalls";

const { values } = parseArgs({ options: { yes: { type: "boolean", default: false } } });
const log = (message: string) => process.stdout.write(`${message}\n`);

try {
  const result = await embedRecalls({
    confirm: async (plan) => {
      log(`Recalls to embed: ${plan.recalls}, about ${plan.tokens} tokens, $${plan.estimatedCost.toFixed(3)}`);
      if (!values.yes && plan.recalls > 0) log("Re-run with --yes to embed them.");
      return values.yes || plan.recalls === 0;
    },
    log,
  });
  if (result) log(`Embedded ${result.stored} recalls: ${result.tokens} tokens, $${result.cost.toFixed(3)}`);
} finally {
  await db().$client.end();
}
