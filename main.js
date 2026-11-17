/*
  main.js
  =======
  This is the ONLY new file that makes your web app into a desktop app.
  It doesn't touch anything about how your database or UI work — it just
  opens index.html in its own window instead of a browser tab.
*/

const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const window = new BrowserWindow({
    width: 1100,
    height: 800,
    icon: path.join(__dirname, "public", "icon.png"), // optional, safe if missing
    webPreferences: {
      contextIsolation: true,
    },
  });

  window.loadFile("index.html");

  // Uncomment the next line if you ever need to debug and see console errors:
  // window.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
