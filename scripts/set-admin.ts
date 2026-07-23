import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "harshidsoni01@gmail.com";
  const password = "changeme123"; // Change this immediately after first login
  const name = "Admin User";

  // Hash password with bcrypt cost 12 (matching auth.ts)
  const hashedPassword = await bcryptjs.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      name,
      role: "ADMIN",
      isActive: true,
      authProvider: "CREDENTIALS",
    },
    create: {
      email,
      password: hashedPassword,
      name,
      role: "ADMIN",
      isActive: true,
      authProvider: "CREDENTIALS",
    },
  });

  console.log("✅ Admin user created/updated:");
  console.log(`   Email: ${user.email}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Active: ${user.isActive}`);
  console.log(`\n🔑 Temporary password: ${password}`);
  console.log("⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });