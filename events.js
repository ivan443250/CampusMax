// events.js
// Загружает список событий из:
// universities/{universityId}/events (collection)

import { getApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

let db = null;

try {
    const app = getApp();
    db = getFirestore(app);
} catch (e) {
    console.error("events.js: Firebase app не найден. Убедись, что auth.js подключён раньше.", e);
}

const SESSION_UID_KEY = "campusMaxUserUid";

function getSessionUid() {
    return localStorage.getItem(SESSION_UID_KEY);
}

document.addEventListener("DOMContentLoaded", () => {
    if (!db) return;

    const listEl = document.getElementById("eventsList");
    if (!listEl) return;

    setupFilterBar();
    initEvents(listEl).catch((e) => {
        console.error("Ошибка загрузки событий:", e);
    });
});

/**
 * Фильтр пока формальный (одна кнопка), но сразу делаем хук,
 * чтобы потом можно было добавить фильтрацию по type.
 */
function setupFilterBar() {
    const buttons = document.querySelectorAll(".events-filter-pill");
    if (!buttons.length) return;

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            buttons.forEach((b) => b.classList.remove("events-filter-pill--active"));
            btn.classList.add("events-filter-pill--active");
            // если позже введём разные виды событий, сюда добавим фильтрацию
        });
    });
}

async function initEvents(listEl) {
    const uid = getSessionUid();
    if (!uid) {
        console.warn("events.js: нет uid в сессии, события не загружаются.");
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
        console.warn("В профиле нет universityId — события не загружаются.");
        return;
    }

    // 2. загрузка событий конкретного вуза
    const events = await loadEvents(universityId);

    // 3. рендер карточек
    renderEvents(listEl, events);
}

/**
 * universities/{universityId}/events
 */
async function loadEvents(universityId) {
    const result = [];

    try {
        const eventsRef = collection(db, "universities", universityId, "events");
        const snapshot = await getDocs(eventsRef);

        snapshot.forEach((docSnap) => {
            const data = docSnap.data() || {};
            data.id = docSnap.id;
            result.push(data);
        });

        // сортируем: сначала по order, потом по регистрации (если нужно)
        result.sort((a, b) => {
            const ao = a.order ?? 0;
            const bo = b.order ?? 0;
            if (ao !== bo) return ao - bo;
            return (a.title || "").localeCompare(b.title || "");
        });
    } catch (e) {
        console.error("Ошибка загрузки коллекции events:", e);
    }

    return result;
}

/**
 * Рендер списка событий
 */
function renderEvents(listEl, events) {
    listEl.innerHTML = "";

    if (!events.length) {
        const p = document.createElement("p");
        p.textContent = "Событий пока нет.";
        p.style.fontSize = "14px";
        p.style.color = "#6b7280";
        listEl.appendChild(p);
        return;
    }

    events.forEach((ev) => {
        listEl.appendChild(createEventCard(ev));
    });
}

function createEventCard(ev) {
    const card = document.createElement("article");
    card.className = "event-card";

    // верхняя картинка
    const imgWrapper = document.createElement("div");
    imgWrapper.className = "event-card-image-wrapper";

    const img = document.createElement("img");
    img.className = "event-card-image";
    if (ev.imageUrl) {
        img.src = ev.imageUrl;
    } else {
        img.src = "img/event-placeholder.png"; // можешь добавить свой плейсхолдер
    }
    img.alt = ev.title || "Событие";
    imgWrapper.appendChild(img);
    card.appendChild(imgWrapper);

    // нижняя часть
    const body = document.createElement("div");
    body.className = "event-card-body";

    // строка с дедлайном и типом
    const metaTop = document.createElement("div");
    metaTop.className = "event-card-meta-top";

    const registration = document.createElement("span");
    registration.className = "event-card-registration";
    if (ev.registrationDeadline) {
        registration.textContent = ev.registrationDeadline;
    }

    const type = document.createElement("span");
    type.className = "event-card-type";
    if (ev.type) {
        type.textContent = ev.type;
    }

    if (registration.textContent) metaTop.appendChild(registration);
    if (type.textContent) metaTop.appendChild(type);

    // заголовок
    const title = document.createElement("h2");
    title.className = "event-card-title";
    title.textContent = ev.title || "";

    // подзаголовок / формат
    const subtitle = document.createElement("div");
    subtitle.className = "event-card-subtitle";
    subtitle.textContent = ev.subtitle || "";

    body.appendChild(metaTop);
    body.appendChild(title);
    if (subtitle.textContent) body.appendChild(subtitle);

    // кнопка "Подробнее"
    const btnRow = document.createElement("div");
    btnRow.className = "event-card-button-row";

    const button = document.createElement("button");
    button.className = "btn btn-primary event-card-button";
    button.type = "button";
    button.textContent = ev.buttonText || "Подробнее";

    if (ev.buttonUrl) {
        button.addEventListener("click", () => {
            window.open(ev.buttonUrl, "_blank");
        });
    }

    btnRow.appendChild(button);
    body.appendChild(btnRow);

    card.appendChild(body);

    return card;
}
