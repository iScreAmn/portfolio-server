import { body, param } from 'express-validator';

// Языки сайта — те же, что в src/i18n/config.js фронтенда.
const LOCALES = ['en', 'ru'];

// Тело запроса упирается в client_max_body_size 1m у nginx перед API,
// поэтому картинка — с запасом меньше мегабайта.
const IMAGE_MAX_LENGTH = 900_000;
const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

// Абсолютная http(s)-ссылка, mailto:/tel: или путь от корня сайта.
const LINK_PATTERN = /^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[^\s]+|\/[^\s]*)$/;

const textRule = (path, max, { required = false } = {}) => {
  const chain = body(path).isString().withMessage('Ожидается строка').trim();
  return (required ? chain.notEmpty().withMessage('Поле не может быть пустым') : chain)
    .isLength({ max })
    .withMessage(`Не длиннее ${max} символов`);
};

const linkRule = (path) =>
  body(path)
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Укажите ссылку')
    .isLength({ max: 500 })
    .matches(LINK_PATTERN)
    .withMessage('Нужна ссылка http(s)://, mailto:, tel: или путь от корня сайта');

const imageRule = body('image')
  .optional({ nullable: true })
  .isString()
  .isLength({ max: IMAGE_MAX_LENGTH })
  .withMessage('Картинка слишком большая')
  .matches(IMAGE_PATTERN)
  .withMessage('Нужна картинка PNG, JPEG или WebP');

const aboutHeroRules = [
  imageRule,
  linkRule('links.cv'),
  linkRule('links.linkedin'),
  linkRule('links.github'),
  linkRule('links.instagram'),
  ...LOCALES.flatMap((locale) => [
    textRule(`${locale}.eyebrow`, 60),
    textRule(`${locale}.title`, 80, { required: true }),
    textRule(`${locale}.lead`, 200, { required: true }),
    textRule(`${locale}.subtitle`, 1000),
    textRule(`${locale}.subtitleSecondary`, 1000),
    textRule(`${locale}.posterAlt`, 160),
    textRule(`${locale}.cvText`, 40, { required: true }),
  ]),
];

/**
 * Какие блоки сайта редактируются и как проверяется каждый. Ключ из URL,
 * которого здесь нет, отсекается сразу — в таблицу не попадёт ничего лишнего.
 */
export const SECTIONS = {
  'about-hero': {
    rules: aboutHeroRules,
    // Из тела берутся только эти поля: всё прочее, что пришлёт клиент, мимо.
    pick: ({ image, links, ...texts }) => ({
      image,
      links: {
        cv: links.cv,
        linkedin: links.linkedin,
        github: links.github,
        instagram: links.instagram,
      },
      ...Object.fromEntries(
        LOCALES.map((locale) => {
          const value = texts[locale];
          return [
            locale,
            {
              eyebrow: value.eyebrow,
              title: value.title,
              lead: value.lead,
              subtitle: value.subtitle,
              subtitleSecondary: value.subtitleSecondary,
              posterAlt: value.posterAlt,
              cvText: value.cvText,
            },
          ];
        }),
      ),
    }),
  },
};

export const contentKeyRules = [
  param('key').isIn(Object.keys(SECTIONS)).withMessage('Неизвестный блок'),
];

/** Правила зависят от ключа, поэтому выбираются уже по ходу запроса. */
export const saveContentRules = async (req, res, next) => {
  const section = SECTIONS[req.params.key];
  if (section) {
    for (const rule of section.rules) await rule.run(req);
  }
  next();
};
