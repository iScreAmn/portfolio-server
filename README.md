# react-portfolio-server

Express-бэкенд портфолио [djcode.ge](https://djcode.ge): приём аналитики,
формы обратной связи и авторизация админки. Данные — PostgreSQL через Prisma.

## Локальный запуск

Нужен Postgres. Скопировать `.env.example` в `.env` и заполнить.

```bash
npm install
npm run db:migrate          # накатить миграции
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed
npm run dev                 # http://localhost:5050
```

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | сервер с автоперезапуском |
| `npm start` | боевой запуск |
| `npm run db:migrate` | создать и накатить миграцию (локально) |
| `npm run db:deploy` | накатить существующие миграции (сервер) |
| `npm run db:seed` | создать первого пользователя админки |
| `npm run db:studio` | Prisma Studio |

## API

| Метод | Путь | Доступ |
|---|---|---|
| `POST` | `/api/analytics` | открыт, rate-limit |
| `GET` | `/api/analytics/summary` | админ |
| `GET` | `/api/analytics/devices` | админ |
| `GET` | `/api/analytics/sessions` | админ |
| `GET` | `/api/analytics/sessions/:id/events` | админ |
| `POST` | `/api/auth/login` `/refresh` `/logout` | открыт |
| `GET` | `/api/auth/me` | админ |
| `POST` | `/api/auth/change-password` | админ |
| `POST` | `/api/contact` `/api/calculator` | открыт, rate-limit |
| `GET` | `/api/health` | открыт |

Авторизация — JWT в httpOnly-куках, токенов в localStorage нет.

## Деплой

Разворачивание на сервере описано в [deploy/README-deploy.md](deploy/README-deploy.md).
