import { BatchInputError, parseBatchCsv, runBatch } from "@/lib/check/batch";
import { limitReached } from "../rate-limits";

const MAX_FILE_BYTES = 1024 * 1024;

const log = (message: string) => process.stdout.write(`${message}\n`);

// Streams one JSON line per listing as it's decided, then a "done" line, so the queue fills in as it goes.
export async function POST(request: Request) {
  const limited = limitReached(request, "batch");
  if (limited) return limited;

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "Send the CSV as multipart form data in a field named file" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose a CSV file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "The CSV must be 1 MB or less" }, { status: 400 });
  }

  let rows;
  try {
    rows = parseBatchCsv(await file.text());
  } catch (error) {
    if (error instanceof BatchInputError) return Response.json({ error: error.message }, { status: 422 });
    throw error;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: object) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      send({ type: "start", total: rows.length });
      await runBatch(rows, (result) => send({ type: "row", ...result }), log);
      send({ type: "done" });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
