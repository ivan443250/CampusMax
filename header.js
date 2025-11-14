// header.js
// Подставляет логотип вуза в .home-top-logo из Firestore:
// universities/{universityId}.logoUrl

import { getApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/* === 1. Инициализация Firestore === */

let db = null;

try {
    const app = getApp();          // приложение уже инициализировал auth.js
    db = getFirestore(app);
} catch (e) {
    console.error("header.js: Firebase app не найден. Убедись, что auth.js подключён раньше.", e);
}

/* === 2. Константы и кэш === */

const SESSION_UID_KEY = "campusMaxUserUid";          // тот же ключ, что в auth.js
const UNI_LOGO_CACHE_KEY = "campusMaxUniLogoCache";  // ключ кэша логотипа

function getSessionUid() {
    return localStorage.getItem(SESSION_UID_KEY);
}

function readLogoCache() {
    try {
        const raw = localStorage.getItem(UNI_LOGO_CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function writeLogoCache(cache) {
    try {
        localStorage.setItem(UNI_LOGO_CACHE_KEY, JSON.stringify(cache));
    } catch {
        /* ignore */
    }
}

/* === 3. Инициализация при загрузке страницы === */

document.addEventListener("DOMContentLoaded", () => {
    if (!db) return;

    const logoImg =
        document.getElementById("universityLogo") ||
        document.querySelector(".home-top-logo");

    if (!logoImg) {
        // на этой странице нет шапки – ничего не делаем
        return;
    }

    initUniversityLogo(logoImg).catch((e) => {
        console.error("Ошибка загрузки логотипа вуза:", e);
    });
});

/**
 * Логика:
 * 1) Берём uid из localStorage.
 * 2) Читаем users/{uid} -> universityId.
 * 3) Проверяем кэш: если для этого universityId уже есть logoUrl — подставляем и выходим.
 * 4) Если нет — читаем universities/{universityId}.logoUrl, подставляем и сохраняем в кэш.
 */
async function initUniversityLogo(logoImg) {
    const uid = getSessionUid();
    if (!uid) {
        console.warn("header.js: нет uid в сессии, логотип не загружается.");
        return;
    }

    // 1. профиль пользователя
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) {
        throw new Error("Профиль пользователя не найден");
    }

    const profile = userSnap.data();
    const universityId = profile.universityId;
    if (!universityId) {
        console.warn("В профиле нет universityId – логотип не подставлен.");
        return;
    }

    // 2. пытаемся использовать кэш
    const cache = readLogoCache();
    if (cache && cache.universityId === universityId && cache.logoUrl) {
        logoImg.src = cache.logoUrl;
        return;
    }

    // 3. читаем университет и сохраняем новый кэш
    const uniSnap = await getDoc(doc(db, "universities", universityId));
    if (!uniSnap.exists()) {
        console.warn(`Документ universities/${universityId} не найден.`);
        return;
    }

    const uniData = uniSnap.data();
    const logoUrl = uniData.logoUrl;

    if (!logoUrl) {
        console.warn(`В universities/${universityId} нет поля logoUrl.`);
        return;
    }

    logoImg.src = logoUrl;

    writeLogoCache({
        universityId,
        logoUrl
    });
}
