import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@afms.com' },
    update: {},
    create: {
      email: 'admin@afms.com',
      password: adminPassword,
      name: 'System Admin',
      role: 'ADMIN',
    },
  })

  console.log({ admin })

  const serviceNames = [
    'Accounting',
    'Bookkeeping',
    'GST Returns',
    'ITR',
    'Sales Tax / VAT',
    'TDS',
    'Payroll',
    'Audit Services'
  ]

  console.log('Seeding services...')
  for (const name of serviceNames) {
    const service = await prisma.service.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    console.log(`Upserted service: ${service.name}`)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
