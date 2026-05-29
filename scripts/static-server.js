"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) {
    return fallback;
  }
  return args[index + 1];
}

const rootArg = readArg("--root", process.cwd());
const root = path.resolve(rootArg);
const port = Number.parseInt(readArg("--port", "8080"), 10);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function sendResponse(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": contentType
  });
  res.end(body);
}

function getSafePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^([.][.][/\\])+/, "");
  const resolved = path.resolve(root, `.${path.sep}${normalized}`);
  if (!resolved.startsWith(root)) {
    return null;
  }
  return resolved;
}

const server = http.createServer((req, res) => {
  const requestedPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = getSafePath(requestedPath || "/index.html");

  if (!safePath) {
    sendResponse(res, 403, "Forbidden");
    return;
  }

  fs.stat(safePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendResponse(res, 404, "Not Found");
      return;
    }

    const extension = path.extname(safePath).toLowerCase();
    const contentType = mimeTypes[extension] || "application/octet-stream";
    const stream = fs.createReadStream(safePath);

    res.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentType
    });

    stream.on("error", () => {
      sendResponse(res, 500, "Internal Server Error");
    });

    stream.pipe(res);
  });
});

server.listen(port, "127.0.0.1", () => {
  // Keep output concise for start script UX.
  console.log(`Gesture Particles server running at http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
