const Store = require("electron-store");

const store = new Store();

function getLoginData() {
  const userName = store.get("userName");
  // 自分用のものなのでパスワードは平文で今の所保存しておく
  const password = store.get("password");

  if (!userName || !password) {
    return;
  }

  return {
    userName,
    password,
  };
}

function setLoginData(userName, password) {
  store.set("userName", userName);
  store.set("password", password);
}

module.exports = {
  getLoginData,
  setLoginData,
};
