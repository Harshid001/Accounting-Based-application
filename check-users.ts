import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, isActive: true, authProvider: true, clientId: true }
  });
  console.log('Total users:', users.length);
  users.forEach(u => {
    console.log('- ' + u.email + ' (' + u.role + ') - Active: ' + u.isActive + ' - Provider: ' + u.authProvider + ' - ClientId: ' + u.clientId);
  });
  await prisma.$disconnect();
}
main();