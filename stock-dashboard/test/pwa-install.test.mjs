import assert from "node:assert/strict";
import test from "node:test";
import { getPwaInstallPresentation, requestPwaInstall } from "../pwa-install.mjs";

test("PWA install presentation only exposes a usable browser prompt", function () {
  assert.deepEqual(getPwaInstallPresentation({ isStandalone: true, promptAvailable: true }), {
    visible: false,
    enabled: false,
    label: "已安装",
    title: "当前已作为独立应用运行"
  });
  assert.equal(getPwaInstallPresentation({ promptAvailable: false }).visible, false);
  assert.deepEqual(getPwaInstallPresentation({ promptAvailable: true }), {
    visible: true,
    enabled: true,
    label: "安装应用",
    title: "将看板安装为独立应用"
  });
});

test("PWA install request surfaces accepted, dismissed, and unavailable states", async function () {
  assert.deepEqual(await requestPwaInstall(null), { status: "unavailable" });
  let prompted = false;
  assert.deepEqual(await requestPwaInstall({
    prompt: async function () { prompted = true; },
    userChoice: Promise.resolve({ outcome: "accepted" })
  }), { status: "accepted" });
  assert.equal(prompted, true);
  assert.deepEqual(await requestPwaInstall({
    prompt: async function () {},
    userChoice: Promise.resolve({ outcome: "dismissed" })
  }), { status: "dismissed" });
});
