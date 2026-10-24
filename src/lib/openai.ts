import OpenAI from "openai";
import { openaiEnv } from "./env";

let client: OpenAI | undefined;

export function openai() {
  client ??= new OpenAI({ apiKey: openaiEnv().OPENAI_API_KEY });
  return client;
}

export function openaiModel() {
  return openaiEnv().OPENAI_MODEL;
}

export function embeddingModel() {
  return openaiEnv().OPENAI_EMBEDDING_MODEL;
}
