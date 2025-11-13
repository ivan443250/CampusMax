// auth.js
// Подключаем ТОЛЬКО Firestore, без Firebase Auth

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
    getFirestore,
    collection,
    query,
    where,
    limit,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVYf1_aFb57GN5y_stmeo6MdSBVPPN1yQ",
  authDomain: "campusmax-21caf.firebaseapp.com",
  projectId: "campusmax-21caf",
  storageBucket: "campusmax-21caf.firebasestorage.app",
  messagingSenderId: "538462229438",
  appId: "1:538462229438:web:bafac684355a3b25bedfef",
  measurementId: "G-2B9RQX0QCR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------- 2. Простая “сессия” через localStorage ---------- */

const SESSION_UID_KEY = "campusMaxUserUid";

function saveSession(uid) {
    localStorage.setItem(SESSION_UID_KEY, uid);
}

function getSessionUid() {
    return localStorage.getItem(SESSION_UID_KEY);
}

function clearSession() {
    localStorage.removeItem(SESSION_UID_KEY);
}

/* ---------- 3. Инициализация по типу страницы ---------- */

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const appContent = document.querySelector(".app-content");

    if (loginForm) {
        setupLoginForm(loginForm);
    }

    if (appContent) {
        protectAppPage();   // проверяем “сессию” и грузим профиль
        setupTabs();
    }

    // чтобы работал onclick="logout()" в app.html
    window.logout = logout;
});

/* ---------- 4. Вход: поиск пользователя в Firestore ---------- */

function setupLoginForm(form) {
    const errorBox = document.getElementById("loginError");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const login = (form.login.value || "").trim();
        const password = form.password.value || "";

        if (!login || !password) {
            showError(errorBox, "Введите логин и пароль.");
            return;
        }

        try {
            // ищем пользователя с таким логином
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("login", "==", login), limit(1));
            const snap = await getDocs(q);

            if (snap.empty) {
                showError(errorBox, "Неверный логин или пароль.");
                return;
            }

            const docSnap = snap.docs[0];
            const data = docSnap.data();

            // ПРОТОТИП: сравнение пароля в лоб
            if (data.password !== password) {
                showError(errorBox, "Неверный логин или пароль.");
                return;
            }

            // успех — сохраняем “сессию” и идём в приложение
            saveSession(docSnap.id);
            window.location.href = "app.html";
        } catch (error) {
            console.error("Ошибка при попытке входа:", error);
            showError(errorBox, "Ошибка соединения с базой. Попробуйте позже.");
        }
    });
}

/* ---------- 5. Защита app.html + загрузка профиля ---------- */

function protectAppPage() {
    const uid = getSessionUid();
    if (!uid) {
        // нет “сессии” — кидаем на логин
        window.location.href = "index.html";
        return;
    }

    // если uid есть — загружаем профиль
    initAppWithProfile(uid).catch((e) => {
        console.error("Ошибка загрузки профиля:", e);
        clearSession();
        window.location.href = "index.html";
    });
}

async function initAppWithProfile(uid) {
    const welcomeText = document.getElementById("welcomeText");

    const snap = await getDoc(doc(db, "users", uid));

    if (!snap.exists()) {
        throw new Error("Профиль пользователя не найден");
    }

    const profile = snap.data();

    const displayName =
        profile.fullName ||
        profile.firstName ||
        profile.login ||
        "студент";

    if (welcomeText) {
        welcomeText.textContent = `Добро пожаловать, ${displayName}!`;
    }

    // здесь же можно по profile.universityId грузить расписание и т.п.
    // const universityId = profile.universityId;
}

/* ---------- 6. Нижнее меню и вкладки на app.html ---------- */

function setupTabs() {
    const navItems = document.querySelectorAll(".nav-item");
    const tabs = document.querySelectorAll(".tab");
    const heading = document.querySelector(".app-heading");

    if (!navItems.length) return;

    navItems.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tabName = btn.dataset.tab;
            if (!tabName) return;

            navItems.forEach((b) => b.classList.remove("is-active"));
            btn.classList.add("is-active");

            tabs.forEach((tab) => {
                tab.classList.toggle("active", tab.id === `tab-${tabName}`);
            });

            if (!heading) return;

            switch (tabName) {
                case "home":
                    heading.textContent = "Главная";
                    break;
                case "events":
                    heading.textContent = "События";
                    break;
                case "bot":
                    heading.textContent = "Бот";
                    break;
                case "docs":
                    heading.textContent = "Документы";
                    break;
                case "payments":
                    heading.textContent = "Выплаты";
                    break;
            }
        });
    });
}

/* ---------- 7. Выход ---------- */

function logout() {
    clearSession();
    window.location.href = "index.html";
}

/* ---------- 8. Вспомогательные ---------- */

function showError(box, message) {
    if (!box) return;
    box.textContent = message;
    box.style.display = "block";
}
