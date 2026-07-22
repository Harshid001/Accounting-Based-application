import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  if (process.env.ALLOW_SEED !== 'true') {
    console.error('ERROR: Seed script aborted.');
    console.error('To run this script, you must explicitly set ALLOW_SEED=true.');
    console.error('Do NOT run this against a production database.');
    process.exit(1);
  }

  // ─── Dev-only staff users ────────────────────────────────────────────────
  // Cost factor 12 to match production routes.
  const seedUsers = [
    // Note: The three dev test users (manager, accountant, dataentry) were deleted 
    // due to weak credentials and should only be generated dynamically out-of-band.
    { email: 'admin@afms.com', password: 'admin123', name: 'System Admin', role: 'ADMIN' },
  ] as const

  for (const u of seedUsers) {
    const hashed = await bcrypt.hash(u.password, 12)
    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: { role: u.role },
      create: {
        email:    u.email,
        password: hashed,
        name:     u.name,
        role:     u.role,
        isActive: true,
      },
    })
    console.log(`Upserted user: ${user.email} (${user.role})`)
  }

  // ─── Services ─────────────────────────────────────────────────────────────
  const serviceNames = [
    'Accounting',
    'Bookkeeping',
    'GST Returns',
    'ITR',
    'Sales Tax / VAT',
    'TDS',
    'Payroll',
    'Audit Services',
  ]

  console.log('Seeding services...')
  for (const name of serviceNames) {
    const service = await prisma.service.upsert({
      where:  { name },
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

