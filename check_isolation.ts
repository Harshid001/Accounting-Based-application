import { PrismaClient } from "@prisma/client";

async function verify() {
  const prisma = new PrismaClient(); // connects to default dev DB since we aren't using dotenv-cli -e .env.test
  
  const dummy = await prisma.client.findFirst({
    where: { name: "Isolation Test Client" }
  });
  
  if (dummy) {
    console.log(`Isolation confirmed! Dummy client still exists in dev DB: ${dummy.id}`);
  } else {
    console.error("DANGER! Dummy client was wiped from the dev DB!");
  }
}

verify().catch(console.error);
