# Doctor Accounting

Вебзастосунок для приватного обліку пацієнтів лікаря:

- внесення візитів (дата, ПІБ, послуга, сума, % лікаря, примітки);
- автоматичний розрахунок доходу лікаря;
- статистика за обраний місяць;
- зберігання даних у Firestore;
- деплой у Firebase Hosting.

## Технології

- Angular (standalone)
- Angular Material
- Firebase Firestore
- Firebase Hosting

## 1. Встановлення

```bash
cd doctor-accounting
npm install
```

## 2. Налаштування Firebase

1. Створи Firebase проєкт у консолі Firebase.
2. Увімкни Firestore Database.
3. Перевір/онови web-конфіг у:

- `src/environments/environment.ts`
- `src/environments/environment.development.ts`
- `src/environments/environment.production.ts`

Для Google Analytics обов'язково має бути заповнений `firebase.measurementId` (GA4 ID, формат `G-XXXXXXXXXX`).

4. Перевір `doctor-accounting/.firebaserc` (поле `projects.default`) — там має бути твій Firebase Project ID.

## 3. Firestore правила та індекси

Цей проєкт уже містить:

- `firestore.rules`
- `firestore.indexes.json`

Поточні правила в цьому репозиторії: доступ до `visits` тільки для власника документа
(`ownerUid == request.auth.uid`), із перевіркою структури полів.

Застосунок використовує **Google Authentication only**.
У Firebase Console потрібно увімкнути:

- `Authentication -> Sign-in method -> Google`
- (опційно) додати свій домен в authorized domains

## 4. Локальний запуск

```bash
npm start
```

Відкрий: `http://localhost:4200`

Після запуску відкриється сторінка входу `/login`, далі доступ до дашборду `/` тільки після Google-входу.

## 5. Форматування коду (Prettier)

Команди:

```bash
npm run format
npm run format:check
```

Pre-commit hook (Husky + lint-staged) запускається автоматично на `git commit` і форматує тільки staged-файли.

## 6. Продакшн збірка

```bash
npm run build
```

## 7. Деплой у Firebase Hosting

Встанови Firebase CLI (один раз):

```bash
npm install -g firebase-tools
```

Логін і деплой:

```bash
firebase login
firebase deploy
```

## 8. GitHub Actions (build -> test -> deploy)

У репозиторії додано workflow: `.github/workflows/ci-cd.yml`.

Пайплайн виконується послідовно:

- `build`
- `test` (після успішного build)
- `deploy` (після успішного test, тільки для `main`)

Для деплою в GitHub Repository Secrets потрібно додати:

- `FIREBASE_SERVICE_ACCOUNT` — JSON ключ service account з доступом до Firebase Hosting.
- `FIREBASE_PROJECT_ID` — Firebase project id (опційно, за замовчуванням використовується `doctor-accounting-840cb`).

Після цього push у `main` запускає повний CI/CD цикл автоматично.

## 9. Міграція старих visits (ownerUid)

Після переходу на user-scoped правила старі документи без `ownerUid` не будуть доступні.
Для цього додано скрипт:

```bash
npm run migrate:owner-uid -- --all-to-uid=YOUR_UID
```

За замовчуванням це `dry-run` (без запису в БД). Щоб застосувати зміни:

```bash
npm run migrate:owner-uid -- --apply --all-to-uid=YOUR_UID
```

Якщо потрібна мапа для різних документів, створи JSON (приклад: `scripts/owner-map.example.json`) і запусти:

```bash
npm run migrate:owner-uid -- --apply --map-file=./scripts/owner-map.json
```

Опційно можна явно передати service account:

```bash
npm run migrate:owner-uid -- --apply --all-to-uid=YOUR_UID --service-account=/path/to/service-account.json
```

## Важливо

- Для коректної локалізації в інтерфейсі використовується `uk-UA`.
- У Firestore зберігається колекція `visits`.
- Для стабільного сортування в межах однієї дати використовується `createdAt`.
