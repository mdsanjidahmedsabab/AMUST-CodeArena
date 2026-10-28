import 'dotenv/config';
import prisma from '../src/config/db.js';
import { hashPassword } from '../src/services/auth.service.js';

export async function seedDevAccounts() {
  console.log('Seeding / verifying standard dev & demo accounts...');

  const passwordHash = await hashPassword('password123');

  // 1. Teacher account
  const teacherEmail = 'teacher@amust.ac.bd';
  const existingTeacher = await prisma.user.findUnique({ where: { email: teacherEmail } });

  if (!existingTeacher) {
    await prisma.user.create({
      data: {
        email: teacherEmail,
        name: 'Prof. AMUST Faculty',
        passwordHash,
        role: 'TEACHER',
        universityId: 'TCH-001',
      },
    });
    console.log(`Created teacher account: ${teacherEmail} / password123`);
  } else {
    await prisma.user.update({
      where: { email: teacherEmail },
      data: {
        role: 'TEACHER',
        passwordHash,
      },
    });
    console.log(`Updated teacher account: ${teacherEmail} / password123`);
  }

  // 2. Also ensure testteacher@amust.edu.bd has password123
  const legacyTeacher = await prisma.user.findUnique({ where: { email: 'testteacher@amust.edu.bd' } });
  if (legacyTeacher) {
    await prisma.user.update({
      where: { email: 'testteacher@amust.edu.bd' },
      data: { passwordHash, role: 'TEACHER' },
    });
    console.log('Updated legacy testteacher@amust.edu.bd with password123');
  }

  // 3. Student account
  const studentEmail = 'student@amust.ac.bd';
  const existingStudent = await prisma.user.findUnique({ where: { email: studentEmail } });

  if (!existingStudent) {
    await prisma.user.create({
      data: {
        email: studentEmail,
        name: 'AMUST Student',
        passwordHash,
        role: 'STUDENT',
        universityId: 'STU-2026-001',
      },
    });
    console.log(`Created student account: ${studentEmail} / password123`);
  } else {
    await prisma.user.update({
      where: { email: studentEmail },
      data: {
        role: 'STUDENT',
        passwordHash,
      },
    });
    console.log(`Updated student account: ${studentEmail} / password123`);
  }

  console.log('Dev accounts ready:');
  console.log('  Teacher: teacher@amust.ac.bd / password123');
  console.log('  Student: student@amust.ac.bd / password123');
}

// Direct execution
if (process.argv[1]?.includes('seed_dev_accounts.js')) {
  seedDevAccounts()
    .catch((err) => {
      console.error('Seed dev accounts error:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
