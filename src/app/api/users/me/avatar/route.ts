import { NextResponse } from "next/server";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getS3Client } from "@/lib/storage";

const PUBLIC_URL_BASE = process.env.S3_PUBLIC_URL!;
const MAX_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, or WebP images are allowed" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image must be under 3MB" }, { status: 400 });
  }

  const key = `avatars/${session.user.id}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { client: s3, bucketName: BUCKET } = getS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  );

  const imageUrl = `${PUBLIC_URL_BASE}/${key}`;

  // Remove the previous avatar so old images don't pile up in the bucket
  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true },
  });
  
  const oldKey = existing?.image?.startsWith(`${PUBLIC_URL_BASE}/avatars/`)
    ? existing.image.slice(`${PUBLIC_URL_BASE}/`.length)
    : null;
    
  if (oldKey) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: oldKey })).catch(() => {
      // non-fatal — an orphaned old avatar isn't worth failing the request over
    });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: imageUrl },
  });

  return NextResponse.json({ image: imageUrl });
}
