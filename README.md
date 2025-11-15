
# CampusMAX

**CampusMAX** — это приложение для студентов и администраторов вузов, позволяющее управлять расписанием, заказом справок и другими студентческими функциями. Приложение работает с Firebase для хранения данных и поддерживает множество вузов. Студенты могут заказывать справки, просматривать расписание, а администраторы могут управлять данными вуза через отдельный интерфейс.

## Функциональность

### Для студентов: https://ivan443250.github.io/CampusMax/
- Просмотр расписания на текущую и следующую недели.
- Заказ различных справок (например, справки о стипендии, месте работы родителей и другие).
- Подтверждение профиля и редактирование личных данных.

### Для администраторов: https://ivan443250.github.io/CampusMaxAdmin/
- Управление расписанием вуза (для разных групп студентов).
- Создание и управление событиями (например, хакатоны, конкурсы).
- Управление профилями студентов и базой данных.

## Функциональность на тестовых сайтах (доступ по ссылке к хосту прямо сейчас)
Сейчас в базе данных леижт 2 пользоватиеля для тестов. Вы можете зайти в панель админа https://ivan443250.github.io/CampusMaxAdmin/ через:
```bash
login: student1
password: qwexcacasfsdfg
```
Будет происходить проверка, является ли роль этого пользователя в базе ланных "admin" и если да, то будет открываться панель редактирования информации о вузе, к которому прикреплен этот пользователь:

<img width="889" height="493" alt="image" src="https://github.com/user-attachments/assets/a342ab91-e1b0-4bbb-977e-2d696c0c2bd7" />

Теперь вы можете зайти на https://ivan443250.github.io/CampusMax/ через 
```bash
login: student1
password: qwexcacasfsdfg
```
или с помощью 
```bash
login: student2
password: OP23stud
```
student2 обладает ролью студента и можно убедиться в проверке ролей, когда student2 не сможет войти в панель админа, но сможет зайти в основное приложение:

<img width="759" height="309" alt="image" src="https://github.com/user-attachments/assets/38596b74-79e9-4a01-9f7c-d56289a3e75c" />

на главной странице основного приложения можно увидеть расписание на сегодняшний и на завтрашний день:

<img width="328" height="338" alt="image" src="https://github.com/user-attachments/assets/11f9ea13-572b-47fa-b2e2-51216bf7479a" />

в данном случае student2 находится в группе ПИ-101. вы можете посмотреть все расписание этой группы, нажав на соответствующую кнопку:

<img width="316" height="937" alt="image" src="https://github.com/user-attachments/assets/f2da23ab-0462-489d-81c5-b63c53d852d2" />

в панели админа можно полностью редактировать расписание на все дни для любой группы. 

<img width="764" height="889" alt="image" src="https://github.com/user-attachments/assets/30122885-a60f-4bd9-83ab-854d250ce073" />

кроме того, был реализован функционал, [позволяющий загрузить расписание в любом виде на таблице excel](#распознавание-расписания-любого-формата-с-нейросетью)

## Структура проекта

### Важные директории и файлы:
- **auth.js** — логика аутентификации пользователей.
- **profile.js** — обработка данных профиля пользователя.
- **order-doc.js** — логика для страницы заказа справки.
- **schedule.js** — управление расписанием студентов и вузов.
- **events.js** — обработка событий для студентов и администраторов.
- **index.html** — основная страница с доступом ко всем функциям для студентов.
- **admin.html** — страница для администраторов.
- **styles.css** — глобальные стили для всех страниц.

### База данных (Firebase Firestore)

Данные пользователей и вузы хранятся в **Firebase Firestore**. Структура базы данных:
- **users/{uid}** — информация о студенте.
- **universities/{universityId}** — информация о вузе.
- **events/{eventId}** — информация о событиях (например, хакатоны, конкурсы).
- **orders/{orderId}** — информация о заказах справок студентов.
- **schedule/{universityId}/{groupId}/even/1,2,3.../lessons** — расписание для разных групп и вузов.

## Установка и запуск

### 1. Клонировать репозиторий

```bash
git clone https://github.com/your-repository-url/campusmax.git
cd campusmax
```

### 2. Установить зависимости

Поскольку проект не использует серверную часть (это фронтенд-приложение), необходимо только подключить Firebase SDK. Все зависимости будут указаны в HTML файлах.

1. Создайте проект в [Firebase Console](https://console.firebase.google.com/).
2. Включите Firebase Authentication и Firestore Database.
3. Получите данные для конфигурации Firebase (API Key, Auth Domain и т. д.) и добавьте их в код проекта в файл `auth.js` или другой, где это необходимо.

### 3. Открытие проекта

После того как все настроено, просто откройте файл `index.html` в браузере:

```bash
open index.html
```

### 4. Запуск локального сервера (опционально)

Если нужно запустить локальный сервер для разработки:

```bash
# Для создания сервера, если вы используете Node.js
npm install -g http-server
http-server
```

Проект будет доступен по адресу `http://localhost:8080`.

## Использование

### Студенты
1. Зайдите в приложение и авторизуйтесь с помощью учетных данных (логин и пароль).
2. Просматривайте расписание, выбирайте нужные справки и заказывайте их.
3. Редактируйте личные данные в профиле (например, номер телефона, email).

### Администраторы
1. Используйте отдельную панель администратора для управления расписанием, студентами и событиями.
2. Управляйте расписанием студентов по группам и неделям.
3. Просматривайте заказы справок и редактируйте их.

## Технологии

- **HTML/CSS** — для оформления страниц.
- **JavaScript** — для взаимодействия с интерфейсами и логикой приложения.
- **Firebase**: для хранения данных (пользователей, расписаний, событий и т. д.).

## Пример работы с Firebase

Вот пример, как можно подключиться к Firebase в файле `auth.js`:

```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// Настройка Firebase
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Пример логина
async function signInUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("User signed in: ", userCredential.user);
  } catch (error) {
    console.error("Error signing in: ", error);
  }
}
```

## Распознавание расписания любого формата с нейросетью

## Лицензия

Этот проект доступен под лицензией MIT. См. файл [LICENSE](LICENSE) для подробностей.
