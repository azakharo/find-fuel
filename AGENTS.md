# AGENTS.md

Инструкции для AI-агентов, работающих с этим репозиторием.

## Проект

**FindFuel** — backend-скрипт на Node.js + TypeScript для мониторинга наличия бензина на АЗС через API СберАЗС (sberazs.ru) с отправкой email-уведомлений о появлении/пропаже топлива.

- PRD: `doc/spec/PRD.md`
- План реализации: `doc/plans/implementation-plan.md`

## Технологический стек

- Node.js 18+ (используется built-in `fetch`)
- TypeScript (строгий режим, без `any`)
- `better-sqlite3` — хранение состояния
- `nodemailer` — отправка email через Gmail SMTP
- `node-cron` — расписание опроса
- `date-fns` — операции с датой/временем
- `vitest` — тестирование

## Команды

| Команда             | Описание                        |
| ------------------- | ------------------------------- |
| `npm run dev`       | Запуск в dev-режиме через `tsx` |
| `npm run build`     | Компиляция TS → JS              |
| `npm start`         | Запуск скомпилированного кода   |
| `npm test`          | Запуск тестов (vitest)          |
| `npm run lint`      | Линтинг (если настроен)         |
| `npm run typecheck` | Проверка типов без emit         |

Перед завершением задачи **всегда** запускай `npm run typecheck` и `npm test`.

## Структура проекта

```
src/
├── index.ts              # Entry point, запуск cron
├── config.ts             # Загрузка и валидация env vars
├── types.ts              # Общие типы
├── api/
│   └── sberazs-client.ts # HTTP-клиент для SberAZS API
├── db/
│   └── database.ts      # SQLite: init, get/set state
├── notifications/
│   └── email-notifier.ts # Отправка email через nodemailer
└── monitor/
    └── fuel-monitor.ts  # Core: опрос, сравнение, события

tests/
├── fuel-monitor.test.ts
└── email-notifier.test.ts
```

## Правила разработки

- Не использовать тип `any`.
- Для операций с датой/временем использовать `date-fns` (не `Date`-методы напрямую).
- В тестовых fixture использовать только валидные RFC 4122 UUID.
- Комментарии — только для нетривиальной/неочевидной логики.
- Не добавлять комментарии к одиночным строкам, если смысл очевиден.
- Установка npm-пакетов с фиксированными версиями: `npm i -S -E <pkg>` / `npm i -D -E <pkg>`.
- Для вызова API в терминале использовать `httpie` (команда `http`), не `curl`.
- При работе с TypeScript-файлами использовать typescript-expert skill.

## Окружение

- Платформа: Windows, PowerShell v7+
- Shell: `pwsh` (использовать PowerShell-совместимый синтаксис)
- Git: conventional commits, не коммитить без явного запроса
- Не коммитить секреты, ключи, пароли

## Docker

- Проект контейнеризирован: `Dockerfile`, `docker-compose.yml`
- `.env.example` — пример переменных окружения
- Деплой пока не требуется, только подготовка файлов
- БД SQLite хранится в volume: `data/findfuel.db`

## API СберАЗС

- Endpoint: `GET https://sberazs.ru/api/stations/tile?z=<z>&x=<x>&y=<y>`
- Заголовок `x-sberfuel-session` **не требуется** (проверено: API отвечает 200 OK без него)
- Rate limit: ~700 запросов/час (с перезагрузкой раз в час)
- Логика определения наличия: `fuels[type].availabilityStatus == "available"` **И** `operationsCount >= 4`
