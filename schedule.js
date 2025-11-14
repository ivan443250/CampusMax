// schedule.js
// Структура расписания:
//
// universities/{universityId}/schedule/{groupId}/{even|odd}/{dayKey}
//   lessons: [ { group, startTime, endTime, subject, ... }, ... ]

import { getApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/* === 1. Инициализация Firestore из уже созданного приложения (auth.js) === */

let db = null;

try {
    const app = getApp(); // приложение уже инициализировал auth.js
    db = getFirestore(app);
} catch (e) {
    console.error("schedule.js: Firebase app не найден. Убедись, что auth.js подключён раньше.", e);
}

/* === 2. Константы и утилиты === */

const SESSION_UID_KEY = "campusMaxUserUid"; // тот же ключ, что и в auth.js

// JS getDay(): 0 - воскресенье, 1 - понедельник, ... 6 - суббота
const WEEKDAY_NAMES_RU = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота"
];

function getSessionUid() {
    return localStorage.getItem(SESSION_UID_KEY);
}

/** Индекс дня для расписания: 1..7 (1 - понедельник, 7 - воскресенье) */
function getDayIndex1to7(date) {
    const jsDay = date.getDay(); // 0..6 (0 - воскресенье)
    if (jsDay === 0) return 7;   // воскресенье -> 7
    return jsDay;                // понедельник(1)..суббота(6)
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

/* === 3. Старт расписания при загрузке home.html === */

document.addEventListener("DOMContentLoaded", () => {
    const todayContainer = document.getElementById("scheduleToday");
    if (!todayContainer || !db) {
        // не на странице с расписанием или нет Firebase
        return;
    }

    setupScheduleTabs();
    initScheduleForCurrentUser().catch((e) => {
        console.error("Ошибка инициализации расписания:", e);
    });
});

/**
 * Берём текущего пользователя, узнаём его universityId и group,
 * читаем конфиг вуза и подгружаем расписание "Сегодня / Завтра".
 */
async function initScheduleForCurrentUser() {
    const uid = getSessionUid();
    if (!uid) {
        console.warn("schedule.js: нет uid в сессии, расписание не загружается.");
        return;
    }

    // профиль пользователя: users/{uid}
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) {
        throw new Error("Профиль пользователя не найден");
    }

    const profile = userSnap.data(); // ожидаем universityId и group
    const universityId = profile.universityId;
    const groupId = profile.group;   // обязательно совпадает с {groupId} в новом пути

    if (!universityId || !groupId) {
        console.warn("В профиле нет universityId или group — расписание не загружается.");
        return;
    }

    // настройки вуза: universities/{universityId}
    const uniSnap = await getDoc(doc(db, "universities", universityId));
    const uniData = uniSnap.exists() ? uniSnap.data() : {};

    const scheduleStartDate = uniData.scheduleStartDate;         // "2024-09-02"
    const scheduleFirstWeekType = uniData.scheduleFirstWeekType; // "even" / "odd"

    await loadScheduleForTodayTomorrow({
        universityId,
        groupId,
        scheduleStartDate,
        scheduleFirstWeekType
    });
}

/* === 4. Загрузка расписания недели + выбор сегодня/завтра === */

/**
 * Загружает всю неделю для заданного вуза, группы и типа недели ("even"/"odd"):
 *
 * universities/{universityId}/schedule/{groupId}/{weekKey}/{dayKey}
 *   lessons: [ ... ]
 *
 * Возвращает объект: { "1": [lessons], "2": [...], ... }.
 */
async function loadWeekSchedule(universityId, groupId, weekKey) {
    const byDay = {};

    try {
        const daysRef = collection(
            db,
            "universities",
            universityId,
            "schedule",
            groupId,
            weekKey          // "even" или "odd" — это subcollection
        );

        const snapshot = await getDocs(daysRef);

        snapshot.forEach((docSnap) => {
            const dayKey = docSnap.id; // "1".."7"
            const data = docSnap.data() || {};
            let lessons = Array.isArray(data.lessons) ? data.lessons : [];
            byDay[dayKey] = lessons;
        });
    } catch (e) {
        console.error("Ошибка загрузки недели расписания:", e);
    }

    return byDay;
}

/** сортировка по номеру пары/времени (фильтр по groupId уже не обязателен, т.к. путь содержит группу) */
function prepareLessonsForDay(lessons, groupId) {
    // если вдруг в массиве всё ещё лежат пары нескольких групп — можно оставить фильтр
    const filtered = lessons.filter((lesson) => {
        if (!groupId) return true;
        if (lesson.group == null) return true;

        if (Array.isArray(lesson.group)) {
            return lesson.group.includes(groupId);
        }
        return lesson.group === groupId;
    });

    filtered.sort((a, b) => {
        const ao = a.order ?? a.pairNumber ?? 0;
        const bo = b.order ?? b.pairNumber ?? 0;
        if (ao !== bo) return ao - bo;

        const at = a.startTime || a.start_time || "";
        const bt = b.startTime || b.start_time || "";
        return at.localeCompare(bt);
    });

    return filtered;
}

async function loadScheduleForTodayTomorrow(config) {
    const { universityId, groupId, scheduleStartDate, scheduleFirstWeekType } = config;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const todayIndex = getDayIndex1to7(now);       // 1..7
    const tomorrowIndex = getDayIndex1to7(tomorrow);

    const todayWeekKey = getWeekTypeForDate(now, scheduleStartDate, scheduleFirstWeekType); // "even"/"odd"
    const tomorrowWeekKey = getWeekTypeForDate(
        tomorrow,
        scheduleStartDate,
        scheduleFirstWeekType
    );

    const currentWeekLabel = document.getElementById("currentWeekLabel");
    const currentDayLabel = document.getElementById("currentDayLabel");

    if (currentWeekLabel) {
        currentWeekLabel.textContent =
            "Сейчас " + (todayWeekKey === "even" ? "четная" : "нечетная") + " неделя";
    }
    if (currentDayLabel) {
        const jsDay = now.getDay(); // 0..6
        currentDayLabel.textContent = WEEKDAY_NAMES_RU[jsDay] || "";
    }

    const todayContainer = document.getElementById("scheduleToday");
    const tomorrowContainer = document.getElementById("scheduleTomorrow");

    // загружаем недели. если сегодня и завтра в одной неделе — грузим один раз
    let scheduleTodayWeek = {};
    let scheduleTomorrowWeek = {};

    if (todayWeekKey === tomorrowWeekKey) {
        scheduleTodayWeek = await loadWeekSchedule(universityId, groupId, todayWeekKey);
        scheduleTomorrowWeek = scheduleTodayWeek;
    } else {
        const [weekToday, weekTomorrow] = await Promise.all([
            loadWeekSchedule(universityId, groupId, todayWeekKey),
            loadWeekSchedule(universityId, groupId, tomorrowWeekKey)
        ]);
        scheduleTodayWeek = weekToday;
        scheduleTomorrowWeek = weekTomorrow;
    }

    const todayLessonsAll = scheduleTodayWeek[String(todayIndex)] || [];
    const tomorrowLessonsAll = scheduleTomorrowWeek[String(tomorrowIndex)] || [];

    const todayLessons = prepareLessonsForDay(todayLessonsAll, groupId);
    const tomorrowLessons = prepareLessonsForDay(tomorrowLessonsAll, groupId);

    if (todayContainer) {
        renderLessonsList(todayContainer, todayLessons);
    }
    if (tomorrowContainer) {
        renderLessonsList(tomorrowContainer, tomorrowLessons);
    }
}

/* === 5. Рендер карточек пар === */

function renderLessonsList(container, lessons) {
    container.innerHTML = "";

    if (!lessons.length) {
        const empty = document.createElement("p");
        empty.textContent = "На этот день занятий нет.";
        empty.style.fontSize = "13px";
        empty.style.color = "#6b7280";
        empty.style.padding = "8px 12px";
        container.appendChild(empty);
        return;
    }

    lessons.forEach((lesson) => {
        const card = document.createElement("div");
        card.className = "lesson-card";

        const start = lesson.startTime || lesson.start_time || "";
        const end = lesson.endTime || lesson.end_time || "";
        const pairNumber = lesson.order ?? lesson.pairNumber ?? null;

        const header = document.createElement("div");
        header.className = "lesson-header";

        if (pairNumber != null && start && end) {
            header.textContent = pairNumber + " пара (" + start + " — " + end + ")";
        } else if (start || end) {
            header.textContent = start + " — " + end;
        }

        const subject = document.createElement("div");
        subject.className = "lesson-subject";
        subject.textContent = lesson.subject || lesson.title || "";

        const roomLine = document.createElement("div");
        roomLine.className = "lesson-meta";
        if (lesson.room) {
            roomLine.textContent = lesson.room;
        }

        const teacherLine = document.createElement("div");
        teacherLine.className = "lesson-meta";
        if (lesson.teacher) {
            teacherLine.textContent = lesson.teacher;
        }

        const noteLine = document.createElement("div");
        noteLine.className = "lesson-note";
        if (lesson.note) {
            noteLine.textContent = lesson.note;
        }

        const more = document.createElement("div");
        more.className = "lesson-more-link";
        more.textContent = "Подробнее";

        if (header.textContent) card.appendChild(header);
        card.appendChild(subject);
        if (lesson.room) card.appendChild(roomLine);
        if (lesson.teacher) card.appendChild(teacherLine);
        if (lesson.note) card.appendChild(noteLine);
        card.appendChild(more);

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
