// profile.js
import { getApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

let db = null;

try {
    const app = getApp();
    db = getFirestore(app);
} catch (e) {
    console.error("profile.js: Firebase app не найден. Убедись, что auth.js подключён раньше.", e);
}

const SESSION_UID_KEY = "campusMaxUserUid";

function getSessionUid() {
    return localStorage.getItem(SESSION_UID_KEY);
}

/**
 * Загружаем данные пользователя из Firestore и отображаем на странице
 */
document.addEventListener("DOMContentLoaded", async () => {
    const uid = getSessionUid();
    if (!uid || !db) {
        console.warn("profile.js: нет uid в сессии, данные профиля не загружаются.");
        return;
    }

    try {
        // 1. Загружаем данные пользователя
        const userSnap = await getDoc(doc(db, "users", uid));
        if (!userSnap.exists()) {
            throw new Error("Профиль пользователя не найден");
        }

        const profile = userSnap.data();
        const phone = profile.phone || "Не указан";
        const email = profile.email || "Не указан";
        const universityId = profile.universityId;
        const fullName = profile.fullName || "Не указано"; // Используем правильное имя из базы данных

        // 2. Получаем данные о университете по universityId
        let university = "Не указано";
        if (universityId) {
            const universitySnap = await getDoc(doc(db, "universities", universityId));
            if (universitySnap.exists()) {
                university = universitySnap.data().name || "Не указано";
            }
        }

        // 3. Заполняем данные профиля на странице
        document.getElementById("fullName").textContent = fullName;
        document.getElementById("phone").value = phone;
        document.getElementById("email").value = email;
        document.getElementById("university").value = university;

        // Если есть изображение профиля, загружаем его
        if (profile.profileImageUrl) {
            document.getElementById("profileImage").src = profile.profileImageUrl;
        }

        // Добавим информацию по синхронизации, если нужно
        document.getElementById("syncStatus").textContent = "СКС РФ синхронизирован";

        // Кнопка для подтверждения электронной почты
        document.getElementById("confirmEmailBtn").addEventListener("click", () => {
            alert("Подтверждение почты не реализовано в этом примере");
        });

        // Кнопка для добавления места обучения
        document.getElementById("addUniversityBtn").addEventListener("click", () => {
            alert("Добавление места обучения не реализовано в этом примере");
        });

        // Кнопка выхода из аккаунта
        document.getElementById("logoutBtn").addEventListener("click", () => {
            localStorage.removeItem(SESSION_UID_KEY);
            window.location.href = "auth.html"; // Или на страницу входа
        });

    } catch (error) {
        console.error("Ошибка загрузки данных профиля:", error);
    }
});
