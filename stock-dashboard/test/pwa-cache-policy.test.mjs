import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isPwaCacheableNavigationResponse, isPwaStaticAsset, shouldBypassPwaCache } from "../pwa-cache-policy.mjs";
import { APP_SHELL } from "../pwa-app-shell.mjs";

test("PWA cache policy permanently bypasses API and auth paths", function () {
  assert.equal(shouldBypassPwaCache("/api"), true);
  assert.equal(shouldBypassPwaCache("/api/nasdaq/history"), true);
  assert.equal(shouldBypassPwaCache("/auth"), true);
  assert.equal(shouldBypassPwaCache("/auth/v1/token"), true);
  assert.equal(shouldBypassPwaCache("/styles.css"), false);
});

test("PWA cache policy accepts only static app-shell asset types", function () {
  assert.equal(isPwaStaticAsset({ destination: "script", pathname: "/app.js" }), true);
  assert.equal(isPwaStaticAsset({ destination: "", pathname: "/assets/icon.png" }), true);
  assert.equal(isPwaStaticAsset({ destination: "", pathname: "/api/nasdaq/history" }), false);
  assert.equal(isPwaStaticAsset({ destination: "fetch", pathname: "/unexpected-resource" }), false);
});

test("PWA only updates the offline shell from successful HTML navigation responses", function () {
  const response = function (ok, contentType) {
    return { ok, headers: { get: function () { return contentType; } } };
  };
  assert.equal(isPwaCacheableNavigationResponse(response(true, "text/html; charset=utf-8")), true);
  assert.equal(isPwaCacheableNavigationResponse(response(true, "application/json")), false);
  assert.equal(isPwaCacheableNavigationResponse(response(false, "text/html")), false);
});

test("PWA app shell includes every local static module imported by the page", function () {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const localImports = Array.from(appSource.matchAll(/^import\s+[\s\S]*?\s+from\s+["'](\.[^"']+)["'];?$/gm))
    .map(function (match) { return match[1]; });
  assert.ok(localImports.length > 0);
  localImports.forEach(function (modulePath) {
    assert.equal(APP_SHELL.includes(modulePath), true, modulePath + " must be pre-cached for offline startup");
  });
});
