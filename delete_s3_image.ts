import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'ap-northeast-1',
  endpoint: 'https://btlznrxpitsqclzwgqfj.supabase.co/storage/v1/s3',
  credentials: {
    accessKeyId: '456e8327179fd850e4bf07ca1c17a12a',
    secretAccessKey: '925f84ceb61607bf82617b9516deb771fbb3140d77e25a1935d4b04aeff84670'
  },
  forcePathStyle: true,
});

async function main() {
  try {
    const key = 'avatars/test-real-image.png';
    await s3.send(new DeleteObjectCommand({
      Bucket: 'afms-documents',
      Key: key,
    }));
    console.log(`Successfully deleted ${key} from Supabase S3 bucket!`);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
