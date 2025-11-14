// full-schedule.js
// Полное расписание по новой структуре:
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

/* ==== 1. Инициализация ==== */

let db = null;

try {
    const app = getApp();
    db = getFirestore(app);
} catch (e) {
    console.error("full-schedule.js: Firebase app не найден. Убедись, что auth.js подключён раньше.", e);
}

const SESSION_UID_KEY = "campusMaxUserUid";

const DAY_NAMES_RU = {
    1: "Понедельник",
    2: "Вторник",
    3: "Среда",
    4: "Четверг",
    5: "Пятница",
    6: "Суббота",
    7: "Воскресенье"
};

function getSessionUid() {
    return localStorage.getItem(SESSION_UID_KEY);
}

/**
 * Тип недели ("even"/"odd") для текущей даты
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

    const baseType = baseWeekType === "odd" ? "odd" : "even";
    const isSameParity = weeksDiff % 2 === 0;

    if (baseType === "even") {
        return isSameParity ? "even" : "odd";
    } else {
        return isSameParity ? "odd" : "even";
    }
}

/* ==== 2. Старт ==== */

document.addEventListener("DOMContentLoaded", () => {
    if (!db) return;

    const container = document.getElementById("fullScheduleContainer");
    if (!container) return; // не на этой странице

    initFullSchedule(container).catch((e) => {
        console.error("Ошибка инициализации полного расписания:", e);
    });
});

/* ==== 3. Инициализация для текущего пользователя ==== */

async function initFullSchedule(container) {
    const uid = getSessionUid();
    if (!uid) {
        console.warn("full-schedule.js: нет uid в сессии, расписание не загружается.");
        return;
    }

    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) {
        throw new Error("Профиль пользователя не найден");
    }
    const profile = userSnap.data();
    const universityId = profile.universityId;
    const groupId = profile.group;

    if (!universityId || !groupId) {
        console.warn("В профиле нет universityId или group.");
        return;
    }

    const uniSnap = await getDoc(doc(db, "universities", universityId));
    const uniData = uniSnap.exists() ? uniSnap.data() : {};

    const scheduleStartDate = uniData.scheduleStartDate;
    const scheduleFirstWeekType = uniData.scheduleFirstWeekType;

    const nowWeekType = getWeekTypeForDate(new Date(), scheduleStartDate, scheduleFirstWeekType || "even");

    const weekButtons = document.querySelectorAll(".week-toggle-btn");
    weekButtons.forEach((btn) => {
        const week = btn.dataset.week;
        if (!week) return;

        if (week === nowWeekType) {
            btn.classList.add("week-toggle-btn--active");
        } else {
            btn.classList.remove("week-toggle-btn--active");
        }

        btn.addEventListener("click", () => {
            weekButtons.forEach((b) => b.classList.remove("week-toggle-btn--active"));
            btn.classList.add("week-toggle-btn--active");
            loadAndRenderWeek(container, universityId, groupId, week);
        });
    });

    // сразу грузим текущую неделю
    await loadAndRenderWeek(container, universityId, groupId, nowWeekType);
}

/* ==== 4. Загрузка недели и подготовка уроков ==== */

/** грузим всю неделю: объект { "1": [lessons], ..., "7": [lessons] } */
async function loadWeekSchedule(universityId, groupId, weekKey) {
    const byDay = {};

    try {
        const daysRef = collection(
            db,
            "universities",
            universityId,
            "schedule",
            groupId,
            weekKey            // "even" / "odd" subcollection
        );

        const snapshot = await getDocs(daysRef);

        snapshot.forEach((docSnap) => {
            const dayKey = docSnap.id; // "1".."7"
            const data = docSnap.data() || {};
            const lessons = Array.isArray(data.lessons) ? data.lessons : [];
            byDay[dayKey] = lessons;
        });
    } catch (e) {
        console.error("full-schedule.js: ошибка загрузки недели:", e);
    }

    return byDay;
}

/** сортировка (groupId уже в пути, фильтр по нему опционален) */
function prepareLessonsForDay(lessons, groupId) {
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

/* ==== 5. Рендер недели ==== */

async function loadAndRenderWeek(container, universityId, groupId, weekKey) {
    container.innerHTML =
        "<p style='font-size:13px;color:#6b7280;'>Загрузка расписания...</p>";

    const rawByDay = await loadWeekSchedule(universityId, groupId, weekKey);
    const prepared = {};

    for (let i = 1; i <= 7; i++) {
        const key = String(i);
        const lessons = rawByDay[key] || [];
        prepared[key] = prepareLessonsForDay(lessons, groupId);
    }

    renderFullSchedule(container, prepared);
}

function renderFullSchedule(container, scheduleByDay) {
    container.innerHTML = "";

    for (let i = 1; i <= 7; i++) {
        const dayLessons = scheduleByDay[String(i)] || [];
        const dayName = DAY_NAMES_RU[i];

        if (!dayLessons.length) continue; // пустые дни можно скрывать

        const dayBlock = document.createElement("section");
        dayBlock.className = "full-schedule-day";

        const title = document.createElement("h2");
        title.className = "full-schedule-day-title";
        title.textContent = dayName;
        dayBlock.appendChild(title);

        const list = document.createElement("div");
        list.className = "schedule-list";

        dayLessons.forEach((lesson) => {
            list.appendChild(createLessonCard(lesson));
        });

        dayBlock.appendChild(list);
        container.appendChild(dayBlock);
    }

    if (!container.children.length) {
        const empty = document.createElement("p");
        empty.textContent = "Для выбранной недели занятий нет.";
        empty.style.fontSize = "13px";
        empty.style.color = "#6b7280";
        container.appendChild(empty);
    }
}

function createLessonCard(lesson) {
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

    return card;
}
