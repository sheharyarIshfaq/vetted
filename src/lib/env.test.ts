import { describe, expect, it } from "vitest";
import { openaiEnvSchema, storageEnvSchema } from "./env";

const storage = {
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "tiko-uploads",
  S3_ACCESS_KEY_ID: "tiko",
  S3_SECRET_ACCESS_KEY: "tiko-secret",
};

describe("storageEnvSchema", () => {
  it("defaults to path-style URLs", () => {
    expect(storageEnvSchema.parse(storage).S3_FORCE_PATH_STYLE).toBe(true);
  });

  it("reads the path-style flag as a boolean", () => {
    expect(storageEnvSchema.parse({ ...storage, S3_FORCE_PATH_STYLE: "false" }).S3_FORCE_PATH_STYLE).toBe(false);
  });

  it("rejects an endpoint that is not a URL", () => {
    expect(storageEnvSchema.safeParse({ ...storage, S3_ENDPOINT: "localhost" }).success).toBe(false);
  });
});

describe("openaiEnvSchema", () => {
  it("defaults the model", () => {
    expect(openaiEnvSchema.parse({ OPENAI_API_KEY: "sk-test" }).OPENAI_MODEL).toBe("gpt-6.1-sol");
  });

  it("rejects a missing key", () => {
    expect(openaiEnvSchema.safeParse({ OPENAI_API_KEY: "" }).success).toBe(false);
  });
});
