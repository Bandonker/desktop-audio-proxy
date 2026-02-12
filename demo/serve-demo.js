#!/usr/bin/env node

/**
 * Simple static server for demo assets.
 * Used by `npm run demo:serve`.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

const demoRoot = path.join(process.cwd(), 'demo');
const projectRoot = process.cwd();
const port = 8080;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
  '.tsx': 'text/plain'
};

const legacyRedirects = {
  '/examples/react-video-player.tsx': '/examples/react-example.tsx'
};

function resolvePathname(rawUrl) {
  const parsed = new URL(rawUrl, 'http://localhost');
  return decodeURIComponent(parsed.pathname);
}

function chooseBaseDir(pathname) {
  if (
    pathname.startsWith('/dist/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/examples/')
  ) {
    return projectRoot;
  }
  return demoRoot;
}

function safeResolve(baseDir, pathname) {
  const normalizedPath = path.normalize(pathname).replace(/^[/\\]+/, '');
  const absolute = path.resolve(baseDir, normalizedPath);
  const resolvedBase = path.resolve(baseDir);

  if (!absolute.startsWith(resolvedBase + path.sep) && absolute !== resolvedBase) {
    return null;
  }

  return absolute;
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = resolvePathname(req.url || '/');
  } catch {
    res.writeHead(400);
    res.end('Invalid URL encoding');
    return;
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (legacyRedirects[pathname]) {
    const location = legacyRedirects[pathname];
    res.writeHead(302, { Location: location });
    res.end(`Redirecting to ${location}`);
    return;
  }

  const effectivePath = pathname === '/' ? '/index.html' : pathname;
  const baseDir = chooseBaseDir(effectivePath);
  const filePath = safeResolve(baseDir, effectivePath);

  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end(`File not found: ${effectivePath}`);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(500);
      res.end(`Server error: ${error.message}`);
      return;
    }

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': data.length,
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`Serving demo on http://localhost:${port}`);
});
