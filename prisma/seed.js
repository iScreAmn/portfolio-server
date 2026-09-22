import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';

/**
 * Заводит первого пользователя админки. Регистрации снаружи нет, поэтому это
 * единственный способ получить доступ на чистой базе.
 *
 *   ADMIN_EMAIL=me@djcode.ge ADMIN_PASSWORD='...' npm run db:seed
 *
 * Идемпотентно: если пользователь с таким email уже есть, ничего не меняет —
 * пароль перетирать нельзя, иначе повторный деплой откатывал бы его смену.
 */

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const seed = async () => {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (!email || !password) {
    console.warn('[seed] ADMIN_EMAIL и ADMIN_PASSWORD не заданы — пользователь не создан');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`[seed] ADMIN_EMAIL не похож на email: ${email}`);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`[seed] ADMIN_PASSWORD короче ${MIN_PASSWORD_LENGTH} символов`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] пользователь ${email} уже существует (role=${existing.role}), пропускаю`);
    return;
  }

  // Первый пользователь получает owner — он заводит остальных.
  const isFirstUser = (await prisma.user.count()) === 0;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: isFirstUser ? 'owner' : 'admin',
    },
  });

  console.log(`[seed] создан пользователь ${user.email} (role=${user.role})`);
};

seed()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
