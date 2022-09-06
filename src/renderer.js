const buttons = {
  checkIn: document.querySelector("#checkIn"),
  checkOut: document.querySelector("#checkOut"),
  breakStart: document.querySelector("#breakStart"),
  breakFinish: document.querySelector("#breakFinish"),
};
const info = {
  status: document.querySelector("#status"),
  totalWorkingDates: document.querySelector("#totalWorkingDates"),
  totalWorkingHours: document.querySelector("#totalWorkingHours"),
  lackOfWorkingTime: document.querySelector("#lackOfWorkingTime"),
  averageTime: document.querySelector("#averageTime"),
};
const login = document.querySelector("#login");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const toast = document.querySelector("#toast");

function reset() {
  document.querySelector("#userName").textContent = "";
  document.querySelector("#loading").style.display = "flex";
  login.style.display = "none";
  loginMessage.textContent = "";
  Object.values(buttons).forEach((value) => {
    value.style.display = "none";
  });
  Object.values(info).forEach((value) => {
    value.textContent = "loading...";
  });
  toast.style.display = "none";
}

function getCurrentStatusLabel(status) {
  switch (status) {
    case "beforeWorking":
      return "出勤前";
    case "afterWorking":
      return "退勤済み";
    case "duringWorking":
      return "仕事中";
    case "duringBreak":
      return "休憩中";
    default:
      return "不明";
  }
}

let isLoadingButton = false;

function disableAllButtons(isDisabled) {
  isLoadingButton = !!isDisabled;

  Object.values(buttons).forEach((value) => {
    if (isDisabled) {
      value.setAttribute("disabled", isDisabled);
    } else {
      value.removeAttribute("disabled");
    }
  });
}

reset();

window.ipcRenderer.on("login", (_, message) => {
  loginMessage.textContent = message;
});

window.ipcRenderer.on("load", (_, res) => {
  info.status.textContent = getCurrentStatusLabel(res.status);
  document.querySelector("#userName").textContent = res.userName;
  document.querySelector("#loading").style.display = "none";

  if (res.checkIn) {
    buttons.checkIn.style.display = "block";
  }
  if (res.checkOut) {
    buttons.checkOut.style.display = "block";
  }
  if (res.breakStart) {
    buttons.breakStart.style.display = "block";
  }
  if (res.breakFinish) {
    buttons.breakFinish.style.display = "block";
  }
});

window.ipcRenderer.on("info", (_, res) => {
  info.totalWorkingDates.textContent = `${res.totalWorkingDates.replace(
    "日",
    ""
  )} / ${res.totalDates}`;
  info.totalWorkingHours.textContent = res.totalWorkingHours;
  info.lackOfWorkingTime.textContent = res.lackOfWorkingTime;
  info.averageTime.textContent = res.averageTime;
});

window.ipcRenderer.on("system", (_, message) => {
  console.info(message);
  // 一旦、アカウントロックの影響で検証がめんどくさいので、systemで上がってきたエラーは全部ログイン画面に飛ばす
  login.style.display = "flex";
});

window.ipcRenderer.on("dispose", () => {
  reset();
});

async function runAction(action, actionName, ...args) {
  try {
    await window.ipcRenderer.action(action, ...args);
    showToast(true, `${actionName}に成功しました`);
  } catch (e) {
    showToast(false, `${actionName}が失敗しました`);
  }
}

buttons.checkIn.addEventListener("click", async () => {
  if (!isLoadingButton) {
    disableAllButtons(true);
    await runAction("checkIn", "出勤");
    disableAllButtons(false);
  }
});
buttons.checkOut.addEventListener("click", async () => {
  if (!isLoadingButton) {
    disableAllButtons(true);
    await runAction(
      "checkOut",
      "退勤",
      document.querySelector("#add-break").checked
    );
    disableAllButtons(false);
  }
});
buttons.breakStart.addEventListener("click", async () => {
  if (!isLoadingButton) {
    disableAllButtons(true);
    await runAction("breakStart", "休憩の開始");
    disableAllButtons(false);
  }
});
buttons.breakFinish.addEventListener("click", async () => {
  if (!isLoadingButton) {
    disableAllButtons(true);
    await runAction("breakFinish", "休憩の終了");
    disableAllButtons(false);
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userName = loginForm["login-user-name"].value;
  const password = loginForm["login-password"].value;

  if (!userName || !password) {
    showToast(false, "すべて埋めてください");
    return;
  }

  await window.ipcRenderer.saveLoginData(userName, password);
  showToast(true, "保存されたので、再度開いてください");
});

document.querySelector("#openFreeeOnBrowser").addEventListener("click", () => {
  window.ipcRenderer.openUrl("https://p.secure.freee.co.jp");
});

function showToast(isGreen, text) {
  if (isGreen) {
    toast.style.background = "#3182ce";
  } else {
    toast.style.background = "#f56565";
  }

  toast.style.display = "block";
  toast.textContent = text;

  setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}
