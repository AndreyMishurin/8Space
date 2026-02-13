# Око Саурона

**Oko** — Open Source инструмент командного планирования с Backlog, Kanban, Timeline (Gantt) и Dashboard.

> Название «Око Саурона» — шутка в документации. Официальное название проекта: **Oko**.

---

[![Open Source](https://img.shields.io/badge/Open%20Source-✓-green?style=flat-square)](LICENSE)

## Функциональность

- **Backlog** — быстрый ввод задач, inline-редактирование, фильтры, группировка, drag-and-drop сортировка
- **Board** — Kanban-доска с перетаскиванием карточек между колонками, индикатор просроченных задач
- **Timeline** — диаграмма Ганта с масштабом неделя/месяц, милестоуны, FS-зависимости, drag/resize
- **Dashboard** — метрики по статусам, просрочке, загрузке исполнителей и тренду завершения

## Стек

- React 19 + Vite
- TypeScript
- Tailwind CSS + Radix UI
- Supabase (Auth, Postgres, RLS)
- React Query
- React Router
- @dnd-kit (сортировка в Backlog)
- date-fns

## Зависимости

### Production

| Пакет | Назначение |
|-------|------------|
| `react`, `react-dom` | UI |
| `@supabase/supabase-js` | Supabase-клиент |
| `@tanstack/react-query` | Кеш и мутации |
| `react-router-dom` | Маршрутизация |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Drag & drop |
| `@radix-ui/react-*` | UI-примитивы |
| `date-fns` | Работа с датами |
| `lucide-react` | Иконки |
| `next-themes` | Тёмная/светлая тема |

### Dev

- `vite`, `typescript`, `tailwindcss`, `eslint`

## Локальный запуск

### 1. Установка зависимостей

```bash
npm install
```

### 2. Supabase (локально)

Нужен Supabase CLI:

```bash
supabase start
supabase db reset
```

Схема и данные — в `supabase/migrations/` и `supabase/seed.sql`.

### 3. Конфигурация

Скопируйте `.env.example` в `.env`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<ключ из вывода supabase start>
```

### 4. Запуск приложения

```bash
npm run dev
```

## Тестовые аккаунты (seed)

Пароль для всех: `password123`

- `owner@gantt.local`
- `editor@gantt.local`
- `viewer@gantt.local`

## Архитектура

- `src/domain/` — типы, репозитории, Supabase-реализации
- `src/hooks/` — React Query хуки, auth
- `src/views/` — Backlog, Board, Timeline, Dashboard, ProjectSettings
- `src/components/` — AppShell, UI-компоненты, AuthView

## Публикация на GitHub

Проект готов к коммиту. Если Oko — подпапка репозитория:

```bash
cd /path/to/NeuroChat
git add Gantt/
git status   # проверьте, что .env и node_modules не в списке
git commit -m "feat(oko): add Oko team planner — Backlog, Kanban, Gantt, Dashboard"
git push
```

Для отдельного репозитория:

```bash
cd Gantt
git init
git add .
git commit -m "Initial commit: Oko team planner"
git remote add origin https://github.com/<user>/oko.git
git push -u origin main
```

## Лицензия

Open Source — см. [LICENSE](LICENSE).
