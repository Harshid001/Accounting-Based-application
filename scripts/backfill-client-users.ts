import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
  console.log("Starting backfill for CLIENT users...");

  // Find all users with role 'CLIENT' who are in assignedClients arrays
  const clientUsers = await prisma.user.findMany({
    where: { role: 'CLIENT' },
    include: { assignedClients: true }
  });

  console.log(`Found ${clientUsers.length} users with role CLIENT.`);

  let updatedCount = 0;

  for (const user of clientUsers) {
    if (user.assignedClients.length > 0) {
      // Assuming a client user is assigned to exactly 1 client record 
      // (which matches the old logic's intention).
      const clientRecordId = user.assignedClients[0].id;
      
      console.log(`Migrating user ${user.email} -> clientId: ${clientRecordId}`);

      // Update the user: set clientId and disconnect from assignedClients
      await prisma.user.update({
        where: { id: user.id },
        data: {
          clientId: clientRecordId,
          assignedClients: {
            disconnect: user.assignedClients.map(c => ({ id: c.id }))
          }
        }
      });
      updatedCount++;
    } else {
      console.log(`User ${user.email} has no assigned clients, skipping...`);
    }
  }

  console.log(`Successfully migrated ${updatedCount} CLIENT users.`);
}

backfill()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
