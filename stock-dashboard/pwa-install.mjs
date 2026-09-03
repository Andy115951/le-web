export function getPwaInstallPresentation({ isStandalone = false, promptAvailable = false, serviceWorkerSupported = true } = {}) {
  if (isStandalone) {
    return { visible: false, enabled: false, label: "已安装", title: "当前已作为独立应用运行" };
  }
  if (!serviceWorkerSupported) {
    return { visible: false, enabled: false, label: "浏览器不支持安装", title: "当前浏览器不支持应用安装" };
  }
  if (!promptAvailable) {
    return { visible: false, enabled: false, label: "等待安装条件", title: "浏览器尚未提供安装提示" };
  }
  return { visible: true, enabled: true, label: "安装应用", title: "将看板安装为独立应用" };
}

export async function requestPwaInstall(deferredPrompt) {
  if (!deferredPrompt || typeof deferredPrompt.prompt !== "function") {
    return { status: "unavailable" };
  }
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  return { status: choice?.outcome === "accepted" ? "accepted" : "dismissed" };
}
