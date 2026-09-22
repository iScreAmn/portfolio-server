import { PrismaClient } from '@prisma/client';

/**
 * Один клиент на процесс. Пул соединений живёт внутри него, поэтому
 * создавать клиент на запрос нельзя — кончатся коннекты к Postgres.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['query', 'warn', 'error'],
});

/** Проверка живости БД для /api/health. */
export const pingDB = async () => {
  await prisma.$queryRaw`SELECT 1`;
};

export const disconnectDB = () => prisma.$disconnect();
