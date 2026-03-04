# 8Space

**8Space** — open source инструмент командного планирования с Backlog, Kanban, Timeline (Gantt) и Dashboard.

## Что в репозитории

- `packages/landing` — маркетинговый сайт + API routes (Next.js)
- `packages/app` — основное приложение (React + Vite + Supabase)
- `docs/api/openapi.yaml` — единая OpenAPI-спецификация проекта
- `scripts/dev-all.mjs` — оркестратор локального dev-стенда

## Локальный запуск

### 1. Установка зависимостей

Из корня репозитория:

```bash
npm install
```

### 2. Supabase (для `packages/app`)

```bash
cd packages/app
supabase start
supabase db reset
cd ../..
```

Схема и данные:

- `packages/app/supabase/migrations/`
- `packages/app/supabase/seed.sql`

#### Google OAuth (опционально, для кнопки Continue with Google)

Создайте `packages/app/supabase/.env` на основе `packages/app/supabase/.env.example`:

```bash
cp packages/app/supabase/.env.example packages/app/supabase/.env
```

Заполните `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`, затем перезапустите Supabase:

```bash
cd packages/app
supabase stop
supabase start
cd ../..
```

### 3. Переменные окружения

Минимум для app:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key>
# Optional: OAuth callback origin for Google sign-in from app auth screen
VITE_AUTH_CALLBACK_ORIGIN=http://localhost:3000
```

Для landing добавьте `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` (и, при необходимости, Stripe/Resend переменные).

### 4. Единый dev-стенд

Из корня репозитория:

```bash
npm run dev
```

Поднимаются вместе:

- Landing: `http://localhost:3000`
- App (Vite): `http://localhost:5173/app/` (или следующий свободный порт)
- Swagger UI: `http://127.0.0.1:<port>/` (порт выбирается автоматически)

Фактический Swagger URL печатается в консоль:

`[dev:all] Swagger UI: http://127.0.0.1:<port>/`

Остановка: `Ctrl+C` в том же терминале (все сервисы завершаются вместе).

## Swagger / OpenAPI

- Спека: `docs/api/openapi.yaml`
- Только Swagger UI:

```bash
npm run dev:swagger
```

Адрес по умолчанию:

- `http://127.0.0.1:55027/`

## Полезные команды

```bash
npm run dev:landing
npm run dev:app
npm run build:landing
npm run build:app
```

## Тестовые аккаунты (seed)

Пароль для всех: `password123`

- `owner@gantt.local`
- `editor@gantt.local`
- `viewer@gantt.local`


## Security

If you find a vulnerability, please report it privately.
See `/Users/andreymisurin/Documents/NeuroChat/8Space/SECURITY.md` for the disclosure process.
