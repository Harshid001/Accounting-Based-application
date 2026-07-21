const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.user.updateMany({ data: { isActive: true } });
  console.log('All users activated!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
