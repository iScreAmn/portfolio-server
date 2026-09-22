# Развёртывание на своём сервере

Пошагово: что сделать руками на сервере, в DNS и в настройках GitHub.
Дальше всё едет само — push в `main` обновляет соответствующий контейнер.

Итог: `djcode.ge` — сайт, `api.djcode.ge` — бэкенд, Postgres и оба
приложения в Docker, наружу торчит только nginx.

---

## 0. Что потребуется

- сервер на Ubuntu (Timeweb Cloud) с доступом по SSH под `deployment` с sudo;
- домен `djcode.ge` с доступом к DNS;
- доступ к обоим репозиториям на GitHub.

---

## 1. DNS

Три A-записи на IP сервера:

| Тип | Имя   | Значение    |
|-----|-------|-------------|
| A   | `@`   | IP сервера  |
| A   | `www` | IP сервера  |
| A   | `api` | IP сервера  |

Проверить, что записи разъехались (должен вернуться IP сервера):

```bash
dig +short djcode.ge api.djcode.ge www.djcode.ge
```

Пока DNS не отвечает, выпускать сертификаты бесполезно — шаг 5 упадёт.

---

## 2. Docker на сервере

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deployment
```

Перелогиниться, чтобы группа применилась, и проверить:

```bash
docker compose version
```

---

## 3. Фаервол

Наружу нужны только SSH и веб:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Порт Postgres (5432) не открывается никогда: база доступна только из
внутренней docker-сети.

---

## 4. Каталог приложения

```bash
sudo mkdir -p /opt/portfolio
sudo chown deployment:deployment /opt/portfolio
cd /opt/portfolio
mkdir -p nginx/conf.d certbot-www
```

Скопировать на сервер из репозитория бэкенда (папка `deploy/`):

- `deploy/docker-compose.yml` → `/opt/portfolio/docker-compose.yml`
- `deploy/nginx/conf.d/*.conf` → `/opt/portfolio/nginx/conf.d/`

Например, с локальной машины:

```bash
scp deploy/docker-compose.yml deployment@СЕРВЕР:/opt/portfolio/
scp deploy/nginx/conf.d/*.conf deployment@СЕРВЕР:/opt/portfolio/nginx/conf.d/
```

Создать `/opt/portfolio/.env` по образцу `deploy/.env.example` и заполнить.
Обязательно задать:

- `POSTGRES_PASSWORD` и тот же пароль внутри `DATABASE_URL`;
- `JWT_SECRET` — `openssl rand -base64 48`;
- `COOKIE_DOMAIN=.djcode.ge`;
- `CORS_ORIGIN=https://djcode.ge`;
- `ADMIN_EMAIL` и `ADMIN_PASSWORD` — для создания первой учётки (шаг 7);
- почту и Telegram, если они нужны.

Права: файл с паролями читать должен только владелец.

```bash
chmod 600 /opt/portfolio/.env
```

---

## 5. Сертификаты

nginx не поднимется без сертификатов, а certbot не выпустит их без
работающего 80-го порта. Поэтому первый выпуск делается в режиме
`standalone`, пока nginx ещё не запущен.

```bash
sudo apt update && sudo apt install -y certbot

sudo certbot certonly --standalone \
  -d djcode.ge -d www.djcode.ge \
  --agree-tos -m ПОЧТА --no-eff-email

sudo certbot certonly --standalone \
  -d api.djcode.ge \
  --agree-tos -m ПОЧТА --no-eff-email
```

Дальше продление идёт через `webroot` — порт 80 уже занят nginx'ом,
останавливать его не нужно. Прописать хук, чтобы nginx подхватывал
свежий сертификат:

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
echo '#!/bin/sh
cd /opt/portfolio && docker compose exec nginx nginx -s reload' \
  | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

И переключить оба сертификата на webroot, чтобы продление не требовало
остановки nginx (после шага 6, когда nginx уже работает):

```bash
sudo certbot certonly --webroot -w /opt/portfolio/certbot-www \
  -d djcode.ge -d www.djcode.ge --force-renewal
sudo certbot certonly --webroot -w /opt/portfolio/certbot-www \
  -d api.djcode.ge --force-renewal
```

Проверка, что автопродление настроено:

```bash
sudo certbot renew --dry-run
```

---

## 6. Первый запуск

Образы публикуются в GHCR **приватными**. Сделай оба пакета публичными,
иначе сервер не сможет их скачать:

GitHub → твой профиль → **Packages** → `react-portfolio` →
Package settings → Danger Zone → **Change visibility** → Public.
То же самое для `react-portfolio-server`.

Пакеты появятся только после первой успешной сборки — то есть после
первого push в `main` (шаг 8). Если хочется поднять всё раньше, запусти
оба workflow вручную: Actions → Deploy Web / Deploy API → Run workflow.

Когда образы доступны:

```bash
cd /opt/portfolio
docker compose pull
docker compose up -d db
docker compose run --rm api npx prisma migrate deploy
docker compose up -d
docker compose ps
```

Все сервисы должны быть `running`, а `db` и `api` — ещё и `healthy`.

---

## 7. Первый пользователь админки

Регистрации снаружи нет — учётка заводится сид-скриптом из `ADMIN_EMAIL`
и `ADMIN_PASSWORD`, которые лежат в `.env`:

```bash
cd /opt/portfolio
docker compose run --rm api npm run db:seed
```

Скрипт идемпотентный: повторный запуск ничего не перезапишет. Первый
созданный пользователь получает роль `owner`.

После создания учётки `ADMIN_PASSWORD` из `.env` лучше убрать.

Проверка: `https://djcode.ge/admin` должен увести на форму входа, а после
входа показать аналитику.

---

## 8. GitHub

### Секреты

В **каждом** из двух репозиториев: Settings → Secrets and variables →
Actions → New repository secret.

| Секрет            | Значение                                               |
|-------------------|--------------------------------------------------------|
| `SERVER_HOST`     | IP или хостнейм сервера                                 |
| `SERVER_USER`     | `deployment`                                            |
| `SERVER_SSH_KEY`  | приватный ключ целиком, вместе со строками `BEGIN/END`  |
| `SERVER_SSH_PORT` | только если SSH не на 22                                |

### Ключ для деплоя

Сгенерировать отдельный ключ (не свой рабочий) и положить публичную
часть на сервер:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/djcode-deploy -C "github-actions" -N ""
ssh-copy-id -i ~/.ssh/djcode-deploy.pub deployment@СЕРВЕР
```

В `SERVER_SSH_KEY` кладётся содержимое `~/.ssh/djcode-deploy` (без `.pub`).

Проверить, что ключ работает:

```bash
ssh -i ~/.ssh/djcode-deploy deployment@СЕРВЕР 'docker compose version'
```

---

## 9. Как это работает дальше

Push в `main`:

- **portfolio** → сборка образа web (адрес API вшивается в бандл
  build-аргументом) → push в GHCR → на сервере `docker compose pull web`
  и `up -d web`;
- **portfolio-server** → сборка образа api → push в GHCR → на сервере
  `pull api`, `prisma migrate deploy` отдельным одноразовым контейнером,
  затем `up -d api`.

Сервер ничего не собирает — только скачивает готовые образы.

Если миграция упадёт, деплой остановится на этом шаге, а работающий
контейнер `api` останется на старой версии.

---

## Шпаргалка

```bash
cd /opt/portfolio

docker compose ps                  # что запущено
docker compose logs -f api         # логи бэкенда
docker compose logs -f web         # логи фронтенда
docker compose restart nginx       # перечитать конфиг nginx

curl -s https://api.djcode.ge/api/health   # жив ли API и видит ли он базу

# psql к базе (снаружи она недоступна)
docker compose exec db psql -U portfolio -d portfolio

# заявки из форм
docker compose exec db psql -U portfolio -d portfolio \
  -c "select created_at, type, name, contact from leads order by created_at desc limit 20;"

# чистка старой статистики
docker compose exec db psql -U portfolio -d portfolio \
  -c "delete from analytics_events where occurred_at < now() - interval '90 days';"
```

### Бэкап базы

Данные живут в volume `portfolio_pgdata`. Дамп:

```bash
cd /opt/portfolio
docker compose exec -T db pg_dump -U portfolio portfolio | gzip > ~/portfolio-$(date +%F).sql.gz
```

Восстановление:

```bash
gunzip -c ~/portfolio-ДАТА.sql.gz | docker compose exec -T db psql -U portfolio -d portfolio
```

---

## Если что-то не поднимается

| Симптом | Куда смотреть |
|---|---|
| `nginx` перезапускается по кругу | нет сертификатов — выпустить (шаг 5) или временно убрать из `conf.d` конфиг того домена, для которого их нет |
| `api` в состоянии `unhealthy` | `docker compose logs api`; чаще всего неверный `DATABASE_URL` или не накатаны миграции |
| `docker compose pull` → `denied` | пакеты в GHCR ещё приватные (шаг 6) |
| Вход в админку не держится | `COOKIE_DOMAIN` должен быть `.djcode.ge`, а сайт открыт по https |
| В админке пусто | события принимаются только с хостов из `ANALYTICS_ALLOWED_HOSTS` |
| Форма отвечает ошибкой | `docker compose logs api`; проверить `EMAIL_*` и `CONTACT_CAPTCHA_ANSWER` |
