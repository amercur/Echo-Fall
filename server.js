'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const allowed = new Set(['index.html', 'style.css', 'game.js', 'world-data.js', 'assets/art-manifest.js', 'assets/wanderer.png', 'assets/ruin-arch.png', 'assets/choir-spire.png', 'assets/ruin-ledge.png', 'assets/asset-preview.png', 'assets/map-preview.png']);
for (const file of ['sentinel','lancer','drone','king','mother','bestiary-preview','wanderer-smooth']) allowed.add(`assets/${file}.png`);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png' };
const port = Number(process.env.PORT || 4173);
http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!allowed.has(name)) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(root, name), (err, data) => {
    if (err) { res.writeHead(500); res.end('Unable to read game file'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(name)], 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`ECHO//FALL is ready at http://127.0.0.1:${port}`));
