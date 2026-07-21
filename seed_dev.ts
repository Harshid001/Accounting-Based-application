import { PrismaClient } from "@prisma/client";

async function verify() {
  const prisma = new PrismaClient(); // connects to default dev DB since we aren't using dotenv-cli -e .env.test
  
  // Seed a dummy client
  const dummy = await prisma.client.create({
    data: {
      name: "Isolation Test Client",
      type: "INDIVIDUAL",
      status: "ACTIVE"
    }
  });
  console.log(`Created dummy client in dev DB: ${dummy.id}`);
}

verify().catch(console.error);
