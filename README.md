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
3. Скопіюй web-конфіг і встав у:
- `src/environments/environment.ts`
- `src/environments/environment.development.ts`
4. У файлі `.firebaserc` заміни `YOUR_PROJECT_ID` на свій Firebase Project ID.

## 3. Firestore правила та індекси

Цей проєкт уже містить:
- `firestore.rules`
- `firestore.indexes.json`

Поточні правила дозволяють доступ тільки авторизованим користувачам (`request.auth != null`).
Якщо потрібно працювати без авторизації на етапі MVP, тимчасово пом'якши правила.

## 4. Локальний запуск

```bash
npm start
```

Відкрий: `http://localhost:4200`

## 5. Продакшн збірка

```bash
npm run build
```

## 6. Деплой у Firebase Hosting

Встанови Firebase CLI (один раз):

```bash
npm install -g firebase-tools
```

Логін і деплой:

```bash
firebase login
firebase deploy
```

## Важливо

- Для коректної локалізації в інтерфейсі використовується `uk-UA`.
- У Firestore зберігається колекція `visits`.
- Для запиту за місяць використовується індекс `visitDate + createdAt` (DESC).
