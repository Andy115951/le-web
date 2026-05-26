const fs = require("fs");
const path = require("path");
const http = require("http");
const { URL } = require("url");

const ROOT_DIR = __dirname;
const HOST = process.env.HOST || "127.0.0.1";
const DEFAULT_PORT = Number(process.env.PORT || 3000);

const apiEnvHandler = require("./api/env");
const loginHandler = require("./api/auth/login");
const logoutHandler = require("./api/auth/logout");
const meHandler = require("./api/auth/me");
const registerHandler = require("./api/auth/register");
const tasksHandler = require("./api/tasks/index");
const taskByIdHandler = require("./api/tasks/[id]");

loadEnvFiles();

const routes = [
  { method: null, pattern: /^\/api\/env$/, handler: apiEnvHandler },
  { method: null, pattern: /^\/api\/auth\/login$/, handler: loginHandler },
  { method: null, pattern: /^\/api\/auth\/logout$/, handler: logoutHandler },
  { method: null, pattern: /^\/api\/auth\/me$/, handler: meHandler },
  { method: null, pattern: /^\/api\/auth\/register$/, handler: registerHandler },
  { method: null, pattern: /^\/api\/tasks$/, handler: tasksHandler },
  {
    method: null,
    pattern: /^\/api\/tasks\/([^/]+)$/,
    handler: taskByIdHandler,
    getQuery(match) {
      return { id: decodeURIComponent(match[1]) };
    }
  }
];

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;

    const apiRoute = matchApiRoute(pathname, req.method || "GET");
    if (apiRoute) {
      decorateRequest(req, parsedUrl, apiRoute.query);
      decorateResponse(res);
      await apiRoute.handler(req, res);
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    await serveStatic(pathname, res);
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify({ error: error.message || "Local dev server error" }));
  }
});

server.listen(DEFAULT_PORT, HOST, () => {
  console.log(`Quadrant Todo local dev server running at http://${HOST}:${DEFAULT_PORT}`);
});

function loadEnvFiles() {
  [".env.local", ".env"].forEach((fileName) => {
    const filePath = path.join(ROOT_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = fs.readFileSync(filePath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex <= 0) {
        return;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      if (!key || process.env[key] !== undefined) {
        return;
      }

      let value = trimmed.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    });
  });
}

function matchApiRoute(pathname, method) {
  for (const route of routes) {
    if (route.method && route.method !== method) {
      continue;
    }

    const match = pathname.match(route.pattern);
    if (!match) {
      continue;
    }

    return {
      handler: route.handler,
      query: route.getQuery ? route.getQuery(match) : {}
    };
  }

  return null;
}

function decorateRequest(req, parsedUrl, routeQuery) {
  req.query = {
    ...Object.fromEntries(parsedUrl.searchParams.entries()),
    ...routeQuery
  };
}

function decorateResponse(res) {
  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };

  res.json = function json(payload) {
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(payload));
    return res;
  };
}

async function serveStatic(pathname, res) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(ROOT_DIR, normalizedPath);
  const resolvedRoot = path.resolve(ROOT_DIR);
  const resolvedFile = path.resolve(filePath);

  if (!resolvedFile.startsWith(resolvedRoot)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(resolvedFile) || fs.statSync(resolvedFile).isDirectory()) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", getContentType(resolvedFile));
  res.end(await fs.promises.readFile(resolvedFile));
}

function getContentType(filePath) {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    default:
      return "text/plain; charset=utf-8";
  }
}
