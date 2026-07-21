import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const requiredEnvVars = [
  "S3_BUCKET_NAME",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_ENDPOINT"
]

export function getS3Client(): { client: S3Client; bucketName: string } {
  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key} — storage cannot operate without R2/S3 credentials. Ensure they are configured in your .env file.`)
    }
  }

  const client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true, // Crucial for Cloudflare R2
  })

  return { client, bucketName: process.env.S3_BUCKET_NAME! }
}

/**
 * Generates a short-lived pre-signed PUT URL for uploading a document.
 */
export async function getUploadUrl(fileKey: string, fileType: string): Promise<string> {
  const { client, bucketName } = getS3Client()
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    ContentType: fileType,
  })
  // Short-lived upload URL: 5 minutes (300 seconds)
  return await getSignedUrl(client, command, { expiresIn: 300 })
}

/**
 * Generates a short-lived pre-signed GET URL for downloading a document.
 */
export async function getDownloadUrl(fileKey: string): Promise<string> {
  const { client, bucketName } = getS3Client()

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
  })
  // Download URL: 15 minutes (900 seconds)
  return await getSignedUrl(client, command, { expiresIn: 900 })
}
