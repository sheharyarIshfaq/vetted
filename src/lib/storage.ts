import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageEnv } from "./env";

const PRESIGNED_URL_TTL_SECONDS = 60 * 60;

let client: S3Client | undefined;

function s3() {
  if (!client) {
    const config = storageEnv();
    client = new S3Client({
      endpoint: config.S3_ENDPOINT,
      region: config.S3_REGION,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export async function uploadObject(key: string, body: Uint8Array, contentType: string) {
  await s3().send(
    new PutObjectCommand({
      Bucket: storageEnv().S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

export function presignedGetUrl(key: string) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: storageEnv().S3_BUCKET, Key: key }), {
    expiresIn: PRESIGNED_URL_TTL_SECONDS,
  });
}
