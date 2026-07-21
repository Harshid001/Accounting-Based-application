import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const googleUsers = await prisma.user.findMany({
    where: { authProvider: 'GOOGLE' },
    select: { id: true, email: true, name: true, role: true, clientId: true }
  })
  console.log('Google users:', JSON.stringify(googleUsers, null, 2))

  // Make the first Google user an ADMIN
  if (googleUsers.length > 0) {
    const updated = await prisma.user.update({
      where: { id: googleUsers[0].id },
      data: { role: 'ADMIN' }
    })
    console.log(`Set ${updated.email} role to ADMIN`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
