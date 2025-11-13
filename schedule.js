// schedule.js
// Отвечает только за расписание на главной ("Сегодня / Завтра")

import { getApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/* === 1. Получаем db из уже инициализированного приложения === */

let db = null;

try {
    const app = getApp();          // берём приложение, которое уже создал auth.js
    db = getFirestore(app);
} catch (e) {
    console.error("schedule.js: Firebase app не найден. Убедись, что auth.js подключён раньше.", e);
}

/* === 2. Константы и утилиты === */

const SESSION_UID_KEY = "campusMaxUserUid"; // тот же ключ, что и в auth.js

const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_NAMES_RU = {
    sunday: "Воскресенье",
    monday: "Понедельник",
    tuesday: "Вторник",
    wednesday: "Среда",
    thursday: "Четверг",
    friday: "Пятница",
    saturday: "Суббота"
};

function getSessionUid() {
    return localStorage.getItem(SESSION_UID_KEY);
}

function getWeekdayKey(date) {
    const idx = date.getDay();
    return WEEKDAY_KEYS[idx];
}

/**
 * Определяем "четная"/"нечетная" неделя для конкретной даты.
 * baseDateStr — "YYYY-MM-DD" (дата начала семестра, понедельник),
 * baseWeekType — "even" или "odd" для этой даты.
 */
function getWeekTypeForDate(date, baseDateStr, baseWeekType) {
    const base = baseDateStr
        ? new Date(baseDateStr + "T00:00:00")
        : new Date(date.getFullYear(), 0, 1);

    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const baseClean = new Date(base.getFullYear(), base.getMonth(), base.getDate());

    const diffMs = current - baseClean;
    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    const weeksDiff = Math.floor(diffMs / MS_PER_WEEK);

    const baseType = baseWeekType === "even" ? "even" : "odd";
    const isSameParity = weeksDiff % 2 === 0;

    if (baseType === "even") {
        return isSameParity ? "even" : "odd";
    } else {
        return isSameParity ? "odd" : "even";
    }
}

/* === 3. Инициализация расписания при загрузке app.html === */

document.addEventListener("DOMContentLoaded", () => {
    // если на странице нет контейнера расписания — просто выходим
    const todayContainer = document.getElementById("scheduleToday");
    if (!todayContainer || !db) {
        return;
    }

    setupScheduleTabs();
    initScheduleForCurrentUser().catch((e) => {
        console.error("Ошибка инициализации расписания:", e);
    });
});

/**
 * Инициализация: берём пользователя из users/{uid},
 * узнаём его университет и группу, читаем конфиг вуза и грузим "сегодня/завтра".
 */
async function initScheduleForCurrentUser() {
    const uid = getSessionUid();
    if (!uid) {
        // защиту/редирект делает auth.js, здесь просто не продолжаем
        console.warn("schedule.js: нет uid в сессии, расписание не загружается.");
        return;
    }

    // профиль пользователя
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) {
        throw new Error("Профиль пользователя не найден");
    }

    const profile = userSnap.data();  // ожидаем universityId и group
    const universityId = profile.universityId;
    const groupId = profile.group;

    if (!universityId || !groupId) {
        console.warn("В профиле нет universityId или group — расписание не загружается.");
        return;
    }

    // читаем настройки вуза (дата начала семестра и тип первой недели)
    const uniSnap = await getDoc(doc(db, "universities", universityId));
    const uniData = uniSnap.exists() ? uniSnap.data() : {};

    const scheduleStartDate = uniData.scheduleStartDate;       // "2024-09-02"
    const scheduleFirstWeekType = uniData.scheduleFirstWeekType; // "even" / "odd"

    await loadScheduleForTodayTomorrow({
        universityId,
        groupId,
        scheduleStartDate,
        scheduleFirstWeekType
    });
}

/* === 4. Загрузка расписания: сегодня / завтра === */

async function loadScheduleForTodayTomorrow(config) {
    const { universityId, groupId, scheduleStartDate, scheduleFirstWeekType } = config;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const todayWeekType = getWeekTypeForDate(now, scheduleStartDate, scheduleFirstWeekType);
    const tomorrowWeekType = getWeekTypeForDate(tomorrow, scheduleStartDate, scheduleFirstWeekType);

    const todayKey = getWeekdayKey(now);
    const tomorrowKey = getWeekdayKey(tomorrow);

    const currentWeekLabel = document.getElementById("currentWeekLabel");
    const currentDayLabel = document.getElementById("currentDayLabel");

    if (currentWeekLabel) {
        currentWeekLabel.textContent =
            "Сейчас " + (todayWeekType === "even" ? "четная" : "нечетная") + " неделя";
    }
    if (currentDayLabel) {
        currentDayLabel.textContent = WEEKDAY_NAMES_RU[todayKey] || "";
    }

    const todayContainer = document.getElementById("scheduleToday");
    const tomorrowContainer = document.getElementById("scheduleTomorrow");

    if (todayContainer) {
        const lessonsToday = await loadDayLessons(universityId, groupId, todayWeekType, todayKey);
        renderLessonsList(todayContainer, lessonsToday);
    }

    if (tomorrowContainer) {
        const lessonsTomorrow = await loadDayLessons(universityId, groupId, tomorrowWeekType, tomorrowKey);
        renderLessonsList(tomorrowContainer, lessonsTomorrow);
    }
}

/**
 * Загружает пары для конкретной недели и дня:
 * universities/{universityId}/groups/{groupId}/weeks/{weekType}/days/{weekdayKey}/lessons
 */
async function loadDayLessons(universityId, groupId, weekType, weekdayKey) {
    const lessons = [];

    try {
        const lessonsRef = collection(
            db,
            "universities",
            universityId,
            "groups",
            groupId,
            "weeks",
            weekType,        // "even" или "odd"
            "days",
            weekdayKey,      // "monday", "tuesday", ...
            "lessons"
        );

        const snap = await getDocs(lessonsRef);
        snap.forEach((docSnap) => {
            lessons.push(docSnap.data());
        });

        // сортируем по номеру пары/order и времени
        lessons.sort((a, b) => {
            const ao = a.order ?? 0;
            const bo = b.order ?? 0;
            if (ao !== bo) return ao - bo;
            const at = a.start_time || "";
            const bt = b.start_time || "";
            return at.localeCompare(bt);
        });
    } catch (e) {
        console.error("Ошибка загрузки расписания:", e);
    }

    return lessons;
}

/* === 5. Рендер карточек пар === */

function renderLessonsList(container, lessons) {
    container.innerHTML = "";

    if (!lessons.length) {
        const empty = document.createElement("p");
        empty.textContent = "На этот день занятий нет.";
        empty.style.fontSize = "13px";
        empty.style.color = "#6b7280";
        container.appendChild(empty);
        return;
    }

    lessons.forEach((lesson) => {
        const card = document.createElement("div");
        card.className = "lesson-card";

        const time = document.createElement("div");
        time.className = "lesson-time";
        time.textContent = `${lesson.start_time || ""} — ${lesson.end_time || ""}`;

        const subject = document.createElement("div");
        subject.className = "lesson-subject";
        subject.textContent = lesson.subject || "";

        const room = document.createElement("div");
        room.className = "lesson-room";
        if (lesson.room) {
            room.textContent = lesson.room;
        }

        const teacher = document.createElement("div");
        teacher.className = "lesson-teacher";
        if (lesson.teacher) {
            teacher.textContent = lesson.teacher;
        }

        const note = document.createElement("div");
        note.className = "lesson-note";
        if (lesson.note) {
            note.textContent = lesson.note;
        }

        card.appendChild(time);
        card.appendChild(subject);
        if (lesson.room) card.appendChild(room);
        if (lesson.teacher) card.appendChild(teacher);
        if (lesson.note) card.appendChild(note);

        container.appendChild(card);
    });
}

/* === 6. Переключатель вкладок "Сегодня / Завтра" === */

function setupScheduleTabs() {
    const buttons = document.querySelectorAll("[data-schedule-tab]");
    const todayList = document.getElementById("scheduleToday");
    const tomorrowList = document.getElementById("scheduleTomorrow");

    if (!buttons.length || !todayList || !tomorrowList) return;

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.scheduleTab;
            buttons.forEach((b) => b.classList.remove("schedule-tab-btn--active"));
            btn.classList.add("schedule-tab-btn--active");

            if (tab === "today") {
                todayList.style.display = "";
                tomorrowList.style.display = "none";
            } else {
                todayList.style.display = "none";
                tomorrowList.style.display = "";
            }
        });
    });
}
