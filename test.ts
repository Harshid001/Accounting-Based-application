import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.findFirst({
    where: { name: { contains: 'vini', mode: 'insensitive' } },
    include: {
      clientUsers: true,
      services: true,
      complianceItems: true,
      documents: true,
      tasks: true
    }
  });
  console.log(JSON.stringify(client, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
