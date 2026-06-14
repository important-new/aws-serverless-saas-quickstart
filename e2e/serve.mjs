// Tiny static file server with SPA (index.html) fallback. Args: <dir> <port>
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const dir = resolve(process.argv[2]);
const port = Number(process.argv[3] || 4300);
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject', '.png': 'image/png', '.jpg': 'image/jpeg',
};

http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = join(dir, urlPath);
  try {
    if ((await stat(file)).isDirectory()) throw new Error('dir');
  } catch {
    file = join(dir, 'index.html'); // SPA fallback for client-side routes
  }
  try {
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(port, () => console.log(`serving ${dir} on http://localhost:${port}`));
