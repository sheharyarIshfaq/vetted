"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { startLabelCheck } from "@/lib/check/start-label";
import { getRecall } from "@/lib/db/recalls";

const formSchema = z.object({
  recallId: z.string().regex(/^(rc|sg):\S{1,40}$/),
  model: z.string().max(120).nullable(),
});

export async function checkLabelForRecall(formData: FormData) {
  const parsed = formSchema.safeParse({ recallId: formData.get("recallId"), model: formData.get("model") });
  if (!parsed.success) redirect("/recalls");
  const recall = await getRecall(parsed.data.recallId);
  if (!recall) redirect("/recalls");
  const id = await startLabelCheck(recall, parsed.data.model);
  redirect(`/check/${id}`);
}
