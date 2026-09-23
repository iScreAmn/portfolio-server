-- AlterEnum
-- BEFORE 'done', чтобы порядок значений в типе совпадал с порядком в
-- schema.prisma: иначе Prisma увидит дрейф схемы на следующей миграции.
ALTER TYPE "LeadStatus" ADD VALUE 'promotion' BEFORE 'done';
