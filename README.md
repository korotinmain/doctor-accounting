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

4. Перевір `doctor-accounting/.firebaserc` (поле `projects.default`) — там має бути твій Firebase Project ID.

## 3. Firestore правила та індекси

Цей проєкт уже містить:

- `firestore.rules`
- `firestore.indexes.json`

Поточні правила в цьому репозиторії: `allow read, write: if request.auth != null;`.
Застосунок використовує анонімну авторизацію Firebase (`signInAnonymously`) при старті.
У Firebase Console потрібно увімкнути `Authentication -> Sign-in method -> Anonymous`.

## 4. Локальний запуск

```bash
npm start
```

Відкрий: `http://localhost:4200`

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

## Важливо

- Для коректної локалізації в інтерфейсі використовується `uk-UA`.
- У Firestore зберігається колекція `visits`.
- Для стабільного сортування в межах однієї дати використовується `createdAt`.
