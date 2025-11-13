// auth.js — версия с подробными логами

console.log("[AUTH] script file loaded");

// Подключаем Firebase (CDN-модули)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/* ---------- Глобальные обработчики ошибок ---------- */

window.onerror = function (message, source, lineno, colno, error) {
    console.error("[AUTH][window.onerror]", { message, source, lineno, colno, error });
};

window.onunhandledrejection = function (event) {
    console.error("[AUTH][unhandledrejection]", event.reason);
};

/* ---------- 1. Firebase config ---------- */

/*
    ЗАМЕНИ значения в firebaseConfig на свои
    из Firebase Console → Project settings → General → Your apps → Web app
*/
const firebaseConfig = {
  apiKey: "AIzaSyDVYf1_aFb57GN5y_stmeo6MdSBVPPN1yQ",
  authDomain: "campusmax-21caf.firebaseapp.com",
  projectId: "campusmax-21caf",
  storageBucket: "campusmax-21caf.firebasestorage.app",
  messagingSenderId: "538462229438",
  appId: "1:538462229438:web:bafac684355a3b25bedfef",
  measurementId: "G-2B9RQX0QCR"
};

let app;
let auth;
let db;

try {
    console.log("[AUTH] Initializing Firebase with config:", firebaseConfig);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("[AUTH] Firebase initialized successfully");
} catch (e) {
    console.error("[AUTH] Firebase init ERROR", e);
}

/* ---------- 2. Инициализация UI ---------- */

document.addEventListener("DOMContentLoaded", () => {
    console.log("[AUTH] DOMContentLoaded fired");

    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const appContent = document.querySelector(".app-content");

    if (loginForm) {
        console.log("[AUTH] loginForm found, setting up");
        setupLoginForm(loginForm);
    } else {
        console.log("[AUTH] loginForm not found on this page");
    }

    if (registerForm) {
        console.log("[AUTH] registerForm found, setting up");
        setupRegisterForm(registerForm);
    } else {
        console.log("[AUTH] registerForm not found on this page");
    }

    if (appContent) {
        console.log("[AUTH] appContent found (app.html), setting up tabs & auth guard");
        setupTabs();
        setupAuthGuardForApp();
    } else {
        console.log("[AUTH] appContent not found (значит это не app.html)");
    }

    // делаем logout доступным из HTML (onclick="logout()")
    window.logout = logout;
});

/* ---------- 3. Регистрация ---------- */

function setupRegisterForm(form) {
    console.log("[AUTH] setupRegisterForm called");
    const errorBox = document.getElementById("registerError");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("[AUTH] registerForm submitted");

        try {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            console.log("[AUTH] register form data:", data);

            const email = (data.email || "").trim();
            const password = data.password || "";

            if (!email || !password) {
                console.warn("[AUTH] register: email or password missing");
                showError(errorBox, "Укажите почту и пароль.");
                return;
            }

            console.log("[AUTH] Calling createUserWithEmailAndPassword");
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            console.log("[AUTH] createUserWithEmailAndPassword success, uid:", cred.user.uid);

            const uid = cred.user.uid;

            const profile = {
                firstName: data.firstName || "",
                lastName: data.lastName || "",
                middleName: data.middleName || "",
                university: data.university || "",
                group: data.group || "",
                phone: data.phone || "",
                email: email
            };

            console.log("[AUTH] Writing profile to Firestore for uid:", uid, profile);
            await setDoc(doc(db, "users", uid), profile);
            console.log("[AUTH] Profile saved to Firestore, redirecting to app.html");

            window.location.href = "app.html";
        } catch (error) {
            console.error("[AUTH] Error in register submit handler:", error);
            showError(errorBox, mapAuthError(error));
        }
    });
}

/* ---------- 4. Вход ---------- */

function setupLoginForm(form) {
    console.log("[AUTH] setupLoginForm called");
    const errorBox = document.getElementById("loginError");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("[AUTH] loginForm submitted");

        try {
            const email = (form.email.value || "").trim();
            const password = form.password.value || "";

            console.log("[AUTH] login email:", email);

            if (!email || !password) {
                console.warn("[AUTH] login: email or password missing");
                showError(errorBox, "Введите e-mail и пароль.");
                return;
            }

            console.log("[AUTH] Calling signInWithEmailAndPassword");
            const cred = await signInWithEmailAndPassword(auth, email, password);
            console.log("[AUTH] signInWithEmailAndPassword success, uid:", cred.user.uid);

            window.location.href = "app.html";
        } catch (error) {
            console.error("[AUTH] Error in login submit handler:", error);
            showError(errorBox, mapAuthError(error));
        }
    });
}

/* ---------- 5. Страница app.html: защита и приветствие ---------- */

function setupAuthGuardForApp() {
    console.log("[AUTH] setupAuthGuardForApp called");

    if (!auth) {
        console.error("[AUTH] setupAuthGuardForApp: auth is undefined (Firebase not initialized)");
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        console.log("[AUTH] onAuthStateChanged fired, user:", user);
        if (!user) {
            console.warn("[AUTH] No user, redirecting to index.html");
            window.location.href = "index.html";
            return;
        }

        try {
            await initAppPage(user);
        } catch (e) {
            console.error("[AUTH] Error in initAppPage:", e);
        }
    });
}

async function initAppPage(user) {
    console.log("[AUTH] initAppPage called for uid:", user.uid);
    const welcomeText = document.getElementById("welcomeText");
    if (!welcomeText) {
        console.warn("[AUTH] welcomeText element not found");
        return;
    }

    let displayName = "";

    try {
        console.log("[AUTH] Loading user profile from Firestore");
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            const profile = snap.data();
            console.log("[AUTH] Firestore profile:", profile);
            displayName = profile.firstName || profile.lastName || "";
        } else {
            console.warn("[AUTH] No user profile document in Firestore");
        }
    } catch (e) {
        console.error("[AUTH] Error while loading profile from Firestore:", e);
    }

    if (!displayName) {
        displayName = user.email || "пользователь";
    }

    welcomeText.textContent = `Добро пожаловать, ${displayName}!`;
}

/* ---------- 6. Нижнее меню / вкладки ---------- */

function setupTabs() {
    console.log("[AUTH] setupTabs called");

    const navItems = document.querySelectorAll(".nav-item");
    const tabs = document.querySelectorAll(".tab");
    const heading = document.querySelector(".app-heading");

    console.log("[AUTH] navItems count:", navItems.length, "tabs count:", tabs.length);

    if (!navItems.length) {
        console.warn("[AUTH] No navItems found");
        return;
    }

    navItems.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tabName = btn.dataset.tab;
            console.log("[AUTH] nav-item clicked, tabName:", tabName);
            if (!tabName) return;

            navItems.forEach((b) => b.classList.remove("is-active"));
            btn.classList.add("is-active");

            tabs.forEach((tab) => {
                const isActive = tab.id === `tab-${tabName}`;
                tab.classList.toggle("active", isActive);
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

async function logout() {
    console.log("[AUTH] logout called");

    try {
        await signOut(auth);
        console.log("[AUTH] signOut success, redirecting to index.html");
        window.location.href = "index.html";
    } catch (error) {
        console.error("[AUTH] Error in logout:", error);
        alert("Не удалось выйти: " + (error.message || "ошибка"));
    }
}

/* ---------- 8. Вспомогательные функции ---------- */

function showError(box, message) {
    console.log("[AUTH] showError:", message);
    if (!box) return;
    box.textContent = message;
    box.style.display = "block";
}

function mapAuthError(error) {
    const code = error.code || "";
    console.log("[AUTH] mapAuthError, code:", code);

    if (code === "auth/email-already-in-use") {
        return "Такой e-mail уже зарегистрирован.";
    }
    if (code === "auth/invalid-email") {
        return "Некорректный адрес электронной почты.";
    }
    if (code === "auth/weak-password") {
        return "Слишком простой пароль (минимум 6 символов).";
    }
    if (code === "auth/user-not-found" || code === "auth/wrong-password") {
        return "Неверная пара e-mail / пароль.";
    }

    return "Ошибка: " + (error.message || "что-то пошло не так.");
}
