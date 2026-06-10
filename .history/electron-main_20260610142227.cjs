const path = require("path");
const { app, BrowserWindow, shell } = require("electron");

const APP_URL = "https://3dmanual.netlify.app/login.html";
const APP_ORIGIN = new URL(APP_URL).origin;

function createWindow(startUrl = APP_URL) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "3D Manual",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "build/icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadURL(startUrl);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_ORIGIN)) {
      createWindow(url);
      return { action: "deny" };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  return win;
}

app.whenReady().then(() => {
  createWindow(APP_URL);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(APP_URL);
  }
});