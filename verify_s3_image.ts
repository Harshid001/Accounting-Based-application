import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Buffer } from 'buffer';

const s3 = new S3Client({
  region: 'ap-northeast-1',
  endpoint: 'https://btlznrxpitsqclzwgqfj.supabase.co/storage/v1/s3',
  credentials: {
    accessKeyId: '456e8327179fd850e4bf07ca1c17a12a',
    secretAccessKey: '925f84ceb61607bf82617b9516deb771fbb3140d77e25a1935d4b04aeff84670'
  },
  forcePathStyle: true,
});

const TRANSPARENT_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==', 'base64');

async function main() {
  try {
    const key = 'avatars/test-real-image.png';
    await s3.send(new PutObjectCommand({
      Bucket: 'afms-documents',
      Key: key,
      Body: TRANSPARENT_PNG,
      ContentType: 'image/png'
    }));
    
    console.log(`Successfully uploaded ${key} to Supabase S3 bucket!`);
    
    // Now trigger Next.js image optimizer locally
    const targetUrl = 'https://btlznrxpitsqclzwgqfj.supabase.co/storage/v1/object/public/afms-documents/avatars/test-real-image.png';
    const nextImageUrl = `http://localhost:3000/_next/image?url=${encodeURIComponent(targetUrl)}&w=256&q=75`;
    
    console.log(`Fetching from Next.js optimizer: ${nextImageUrl}`);
    const res = await fetch(nextImageUrl);
    console.log(`Status: ${res.status}`);
    
    if (res.status === 200) {
      console.log('SUCCESS! next/image returned a 200 OK for a real bucket image.');
    } else {
      console.error(`FAILED: ${res.status} - ${await res.text()}`);
    }
    
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
