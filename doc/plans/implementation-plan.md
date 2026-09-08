# План реализации FindFuel

## Архитектурные решения

| Решение     | Выбор                         | Обоснование                                  |
| ----------- | ----------------------------- | -------------------------------------------- |
| Стек        | Node.js + TypeScript          | Простой backend-скрипт, минимум зависимостей |
| Расписание  | `node-cron`                   | Надёжный cron для Node.js                    |
| HTTP клиент | Built-in `fetch` (Node 18+)   | Без лишних зависимостей                      |
| Email       | `nodemailer` через Gmail SMTP | Стандарт, поддержка app passwords            |
| БД          | In-memory (`Map`)            | Минимум зависимостей, простая Docker-сборка; состояние сбрасывается при рестарте |
| Дата/время  | `date-fns`                    | По правилам проекта                          |
| Тесты       | `vitest`                      | Быстрый, совместим с TS                      |
| Запуск TS   | `tsx`                         | Быстрый, без компиляции для dev              |

## Логика работы

1. `node-cron` запускает опрос каждые 5 минут.
2. Проверяется день месяца: если `PLATE_TYPE=odd`, работаем только в нечётные дни; если `even` — в чётные. В "не свои" дни опрос пропускается.
3. Для каждого тайла из `STATIONS` делается GET-запрос к `https://sberazs.ru/api/stations/tile`.
4. Из ответа для каждой станции проверяются топлива из `FUEL_TYPES`.
5. Бензин марки `<target>` считается "доступным" если: `fuels[type=<target>].availabilityStatus == "available"` **И** `operationsCount >= 4` (отсутствие = 0).
6. Сравнение с состоянием in-memory:
   - был `false` → стал `true` → уведомление "появился"
   - был `true` → стал `false` → уведомление "закончился"
7. Уведомление отправляется через Gmail SMTP на `NOTIFICATION_EMAIL`.
8. Повторные уведомления при неизменном состоянии не отправляются.

## Структура проекта

```
FindFuel/
├── src/
│   ├── index.ts                  # Entry point, запуск cron
│   ├── config.ts                 # Загрузка и валидация env vars
│   ├── types.ts                  # Общие типы (Station, Fuel, StationState)
│   ├── api/
│   │   └── sberazs-client.ts     # HTTP-клиент для SberAZS API
│   ├── state/
│   │   └── memory-store.ts     # In-memory хранилище состояния
│   ├── notifications/
│   │   └── email-notifier.ts     # Отправка email через nodemailer
│   └── monitor/
│       └── fuel-monitor.ts       # Core: опрос, сравнение, события
├── tests/
│   ├── fuel-monitor.test.ts      # Тесты: появление/пропажа бензина
│   └── email-notifier.test.ts    # Тесты: форматирование уведомлений
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Env variables (`.env.example`)

```
# Тайлы АЗС для мониторинга (JSON-массив)
STATIONS=[{"z":13,"x":5081,"y":2593},{"z":13,"x":5080,"y":2593}]

# Марки бензина (JSON-массив)
FUEL_TYPES=["ai95"]

# Тип госномера: odd | even
PLATE_TYPE=odd

# Интервал опроса (cron), по умолчанию каждые 5 минут
POLL_CRON=*/5 * * * *

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NOTIFICATION_EMAIL=recipient@example.com

# Часовой пояс
TZ=Europe/Moscow
```

## Логика определения чётных/нечётных дней

- День определяется по числу месяца (1 = нечётный, 2 = чётный) в часовом поясе `TZ`.
- При `PLATE_TYPE=odd` — работаем только в нечётные дни, при `even` — в чётные.
- В "не свои" дни скрипт не опрашивает API и не отправляет уведомления.

## Тесты

- **`fuel-monitor.test.ts`**: тестирование переходов состояния (появился, закончился, без изменений), логика AND-условия, игнорирование не-своих дней, обработка отсутствия `operationsCount`.
- **`email-notifier.test.ts`**: проверка текста уведомления "На АЗС <название> появился бензин! Время: <дата время>" и "закончился", mock nodemailer.

## Что НЕ делается (по PRD)

- Деплой не делается, только подготовка (Dockerfile, docker-compose, .env.example).
- Без webhook'ов, без веб-интерфейса — CLI только.
