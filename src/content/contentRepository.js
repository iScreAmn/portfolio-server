import { prisma } from '../config/prisma.js';

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/;

/**
 * Картинка хранится в data как data URL, но наружу её не отдаём: такой блок
 * весил бы сотни килобайт. Вместо неё — путь на отдельный эндпоинт, а
 * updatedAt в query сбрасывает кэш браузера после каждого сохранения.
 */
const toPublic = (row) => {
  const { image, ...rest } = row.data || {};
  const version = row.updatedAt.getTime();
  return {
    ...rest,
    image: image ? `/api/content/${encodeURIComponent(row.key)}/image?v=${version}` : null,
    updatedAt: row.updatedAt,
  };
};

export const findContent = async (key) => {
  const row = await prisma.siteContent.findUnique({ where: { key } });
  return row ? toPublic(row) : null;
};

/** @returns {{ type: string, buffer: Buffer } | null} */
export const findContentImage = async (key) => {
  const row = await prisma.siteContent.findUnique({ where: { key } });
  const match = typeof row?.data?.image === 'string' && row.data.image.match(DATA_URL_PATTERN);
  if (!match) return null;
  return { type: match[1], buffer: Buffer.from(match[2], 'base64') };
};

/**
 * Блок сохраняется целиком. Исключение — image: undefined значит «оставить
 * как есть» (чтобы не гонять картинку туда-обратно при правке текста),
 * null — «убрать и вернуть картинку по умолчанию».
 */
export const saveContent = async (key, { image, ...data }) => {
  const nextData = { ...data };

  if (image === undefined) {
    const current = await prisma.siteContent.findUnique({ where: { key } });
    if (current?.data?.image) nextData.image = current.data.image;
  } else if (image) {
    nextData.image = image;
  }

  const row = await prisma.siteContent.upsert({
    where: { key },
    create: { key, data: nextData },
    update: { data: nextData },
  });
  return toPublic(row);
};
