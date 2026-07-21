import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

dotenv.config();

const regions = [
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-northeast-3",
  "ap-east-1",
  "auto" // just in case
];

async function testS3() {
  for (const region of regions) {
    console.log(`\nTesting region: ${region}`);
    const client = new S3Client({
      region: region,
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: "test-file.txt",
      ContentType: "text/plain",
    });

    try {
      const url = await getSignedUrl(client, command, { expiresIn: 300 });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: "Hello from script!",
      });

      if (!res.ok) {
        console.error(`Upload failed for ${region}! 403`);
      } else {
        console.log(`\nSUCCESS! Region ${region} works!`);
        return; // found the right one!
      }
    } catch (error) {
      console.error("Error:", error.message);
    }
  }
}

testS3();
