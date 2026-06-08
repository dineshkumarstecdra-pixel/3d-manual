import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";

export const ADMIN_EMAIL = "admin@gmail.com";

function setAuthMessage(message) {
  let box = document.getElementById("authCheckingOverlay");
  if (!box) {
    box = document.createElement("div");
    box.id = "authCheckingOverlay";
    box.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #eef1f6;
      color: #0f172a;
      font: 600 15px Arial, sans-serif;
    `;
    box.innerHTML = `<div style="padding:18px 22px;border-radius:14px;background:#fff;box-shadow:0 18px 50px rgba(15,23,42,.15)"></div>`;
    document.body?.appendChild(box);
  }
  const inner = box.firstElementChild || box;
  inner.textContent = message;
}

function unlockPage() {
  document.documentElement.classList.remove("auth-checking");
  const box = document.getElementById("authCheckingOverlay");
  if (box) box.remove();
}

function saveReturnPath() {
  const path = window.location.pathname + window.location.search + window.location.hash;
  if (!path.includes("login.html")) {
    sessionStorage.setItem("returnAfterLogin", path);
  }
}

function loginUrl(reason = "login-required") {
  return `/login.html?reason=${encodeURIComponent(reason)}`;
}

export function waitForAuthUser() {
  setAuthMessage("Checking login...");
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function requireLogin() {
  const user = await waitForAuthUser();
  if (!user) {
    saveReturnPath();
    window.location.replace(loginUrl());
    return new Promise(() => {});
  }
  unlockPage();
  return user;
}

export async function requireAdmin() {
  const user = await waitForAuthUser();
  if (!user) {
    saveReturnPath();
    window.location.replace(loginUrl("admin-login-required"));
    return new Promise(() => {});
  }

  const email = (user.email || "").toLowerCase();
  if (email !== ADMIN_EMAIL) {
    alert("Admin access only.");
    window.location.replace("/home.html");
    return new Promise(() => {});
  }

  unlockPage();
  return user;
}

export async function redirectIfLoggedIn() {
  const user = await waitForAuthUser();
  if (!user) {
    unlockPage();
    return null;
  }

  const email = (user.email || "").toLowerCase();
  const returnAfterLogin = sessionStorage.getItem("returnAfterLogin");
  sessionStorage.removeItem("returnAfterLogin");

  if (email === ADMIN_EMAIL) {
    window.location.replace(returnAfterLogin || "/admin.html");
  } else {
    window.location.replace(returnAfterLogin || "/home.html");
  }

  return new Promise(() => {});
}

export async function secureLogout() {
  try {
    sessionStorage.removeItem("returnAfterLogin");
    localStorage.removeItem("selectedVehicle");
    localStorage.removeItem("selectedVehicleRecord");
    localStorage.removeItem("highlightPart");
    await signOut(auth);
  } finally {
    window.location.replace("/login.html");
  }
}
