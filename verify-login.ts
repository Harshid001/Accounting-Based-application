import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'harshidsoni01@gmail.com' },
    select: { id: true, email: true, password: true, role: true, isActive: true }
  });
  
  console.log('User found:', user ? 'YES' : 'NO');
  if (user) {
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Active:', user.isActive);
    console.log('Has password:', !!user.password);
    
    // Test password
    const isValid = await bcrypt.compare('changeme123', user.password!);
    console.log('Password valid:', isValid);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);