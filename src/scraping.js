"use strict";

const puppeteer = require("puppeteer");

// puppeteerを常時起動しておくと、以下のエラーが発生してしまうので、open/closeでインスタンスをリセットする必要がある
// また、常時起動だとPCでスリープが行えない
// UnhandledPromiseRejectionWarning: Error: Protocol error (Page.navigate): Session closed. Most likely the page has been closed.

let cookies;

// https://github.com/puppeteer/puppeteer/issues/2134
function getChromiumExecPath() {
  return puppeteer.executablePath().replace("app.asar", "app.asar.unpacked");
}

async function setup() {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    executablePath: getChromiumExecPath(),
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  page.on("request", (request) => {
    if (request.resourceType() === "image") {
      request.abort();
    } else {
      request.continue();
    }
  });

  return { browser, page };
}

async function dispose(browser) {
  await browser.close();
}

async function login(page, name, password, cb) {
  cb("ページの応答待ち");

  if (cookies) {
    for (const cookie of cookies) {
      await page.setCookie(cookie);
    }
  }

  const response = await page.goto("https://p.secure.freee.co.jp/#", {
    waitUntil: "networkidle2",
  });
  const redirectCount = response.request().redirectChain().length;

  if (/* go to login page */ redirectCount === 2) {
    cb("ログイン画面へ遷移中");
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', name);
    await page.type('input[type="password"]', password);

    try {
      await page.click("input[type=submit]");
      await page.waitForNavigation({ timeout: 10000 });

      // アカウントロックかかるのでデバッグは後ほど。。。
      // await page.waitForSelector(".error", {
      //   hidden: true,
      //   timeout: 0,
      // });

      cookies = await page.cookies();
    } catch (e) {
      console.log(e);
      // perhaps the email or password are incorrect
      throw new Error(
        "メールアドレスかパスワードが間違えている可能性があります"
      );
    }
  }

  const [company, userName] = await page.$$eval(
    ".fr-dropdown > .user-navigation-link",
    (list) => {
      return list.map((data) => data.textContent);
    }
  );

  return { company, userName };
}

async function goToWorkRecordsPage(browser) {
  const page = await browser.newPage(browser);
  const response = await page.goto("https://p.secure.freee.co.jp/#", {
    waitUntil: "networkidle2",
  });
  const button = await page.$('a[data-guide="勤怠"]');

  await button.click();
  await page.waitForSelector("#worker_name");

  return page;
}

async function addBreak(browser) {
  const page = await goToWorkRecordsPage(browser);
  const dataDate = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(Date.now())
    .replace(/\//g, "-");
  const date = await page.$(`[data-date="${dataDate}"] .day-container`);

  // TODO: loadingの謎の鳥をwatchする必要ありそう。。
  await new Promise((r) => setTimeout(r, 500));
  await date.click();

  const addButton = await getButton(page, "休憩を追加");
  await addButton.click();

  const saveButton = await getButton(page, "保存");
  await saveButton.click();
}

async function getWorkingTimeInfo(browser) {
  const page = await goToWorkRecordsPage(browser);
  const [
    totalWorkingDates,
    totalWorkingHours,
    ,
    ,
    ,
    ,
    ,
    ,
    ,
    ,
    lackOfWorkingTime,
  ] = await page.$$eval(".main-items > .item > .body", (list) => {
    return list.map((data) => data.textContent);
  });
  const totalDates = `${
    Array.from(
      await page.$$("td.day:not(.prescribed-holiday):not(.out-of-range)")
    ).length
  }日`;
  const averageTime = (() => {
    if (totalWorkingDates === "0日") {
      return 0;
    }
    const [, h, m] = totalWorkingHours.match(/^(.+?)時間(.+?)分$/);

    // TODO: need to investigate some cases
    if (h === undefined || m === undefined) {
      return 0;
    }

    return `${(
      (Number(h) * 60 + Number(m)) /
      Number(totalWorkingDates.replace("日", "")) /
      60
    ).toFixed(2)}時間`;
  })();

  return {
    totalDates,
    totalWorkingDates,
    totalWorkingHours,
    lackOfWorkingTime,
    averageTime,
  };
}

async function getButton(page, text) {
  const [button] = await page.$x(`//button[contains(., '${text}')]`);

  return button;
}

async function clickButton(button) {
  await button.click();
}

async function getAllStatus(page) {
  const [checkIn, checkOut, breakStart, breakFinish] = await Promise.all([
    getButton(page, "出勤する"),
    getButton(page, "退勤する"),
    getButton(page, "休憩開始"),
    getButton(page, "休憩終了"),
  ]);

  const status =
    /* 一日が終了 */ !checkIn && !checkOut
      ? "afterWorking"
      : /* 一日が開始 */ checkIn && !checkOut
      ? "beforeWorking"
      : /* 仕事中 */ !checkIn && checkOut && breakStart
      ? "duringWorking"
      : /* 休憩中 */ breakFinish
      ? "duringBreak"
      : "n/a";

  return {
    checkIn,
    checkOut,
    breakStart,
    breakFinish,
    status,
  };
}

module.exports = {
  setup,
  dispose,
  login,
  getAllStatus,
  getWorkingTimeInfo,
  clickButton,
  addBreak,
};
