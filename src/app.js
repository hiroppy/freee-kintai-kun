"use strict";

const path = require("node:path");
const {
  app,
  contextBridge,
  BrowserWindow,
  ipcMain,
  shell,
} = require("electron");
const { menubar } = require("menubar");
const {
  setup,
  dispose,
  login,
  getAllStatus,
  getWorkingTimeInfo,
  clickButton,
  addBreak,
} = require("./scraping");
const { getLoginData, setLoginData } = require("./store");

(async () => {
  await app.whenReady();

  let browser, page, allStatus;

  // trayはdynamicに値を変更できないっぽい。。 windowsが無理だからかな・・・？
  const mb = menubar({
    dir: __dirname,
    showDockIcon: false,
    browserWindow: {
      preloadWindow: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        preload: path.join(__dirname, "preload.js"),
      },
    },
  });

  mb.on("show", async () => {
    const loginData = getLoginData();

    if (!loginData) {
      sendMessage("system", "");
      return;
    }

    try {
      sendMessage("login", "✅ ブラウザを起動中");
      const instance = await setup();

      browser = instance.browser;
      page = instance.page;

      const { company, userName } = await login(
        page,
        loginData.userName,
        loginData.password,
        (message) => {
          sendMessage("login", `✅ ${message}`);
        }
      );

      allStatus = await getAllStatus(page);

      sendMessage("load", {
        company,
        userName,
        ...allStatus,
      });
      sendMessage("info", await getWorkingTimeInfo(browser));
    } catch (e) {
      if (
        e.message.includes("disconnected") ||
        e.message.includes("Target closed")
      ) {
        return;
      }

      sendMessage("system", e.message);
    }
  });

  mb.on("hide", async () => {
    sendMessage("dispose", "");
    if (browser) {
      await dispose(browser);
    }
    browser = undefined;
    page = undefined;
    allStatus = {};
  });

  ipcMain.handle("checkIn", () => {
    if (allStatus.checkIn) {
      return clickButton(allStatus.checkIn);
    }
  });
  ipcMain.handle("checkOut", async (_, isAddBreak) => {
    if (allStatus.checkOut) {
      if (isAddBreak) {
        await addBreak(browser);
      }
      return clickButton(allStatus.checkOut);
    }
  });
  ipcMain.handle("breakStart", () => {
    if (allStatus.breakStart) {
      return clickButton(allStatus.breakStart);
    }
  });
  ipcMain.handle("breakFinish", () => {
    if (allStatus.breakFinish) {
      return clickButton(allStatus.breakFinish);
    }
  });

  ipcMain.handle("openUrl", (_, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle("saveLoginData", (_, userName, password) => {
    setLoginData(userName, password);
  });

  function sendMessage(eventName, args) {
    mb.window.webContents.send(eventName, args);
  }
})();
