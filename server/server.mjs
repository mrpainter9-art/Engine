// Local editor server: serves the editor, the project's files under /project/, and a small JSON API
// for files, git and the asset graph. It only listens on 127.0.0.1 and only answers same-origin API calls.
import http from 'node:http';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fsapi from './fsapi.mjs';
import * as gitapi from './gitapi.mjs';
import { exportWeb } from './export.mjs';
import { graph } from './graph.mjs';
import { resolveInside } from './paths.mjs';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => { const i = process.argv.lastIndexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const DEV = process.argv.includes('--dev');
const PORT = +arg('port', process.env.PORT || 8710);
const PROJECT = path.resolve(arg('project', process.cwd()));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

const API = {
  'project': async () => ({ root: PROJECT, name: path.basename(PROJECT), engine: ENGINE }),
  'fs/list': () => fsapi.list(PROJECT),
  'fs/read': (b) => fsapi.read(PROJECT, b.path),
  'fs/write': (b) => fsapi.write(PROJECT, b),
  'fs/mkdir': (b) => fsapi.mkdir(PROJECT, b),
  'fs/rename': (b) => fsapi.rename(PROJECT, b),
  'fs/delete': (b) => fsapi.remove(PROJECT, b),
  'git/status': () => gitapi.status(PROJECT),
  'git/diff': (b) => gitapi.diff(PROJECT, b),
  'git/log': () => gitapi.log(PROJECT),
  'git/commit': (b) => gitapi.commit(PROJECT, b),
  'git/pull': () => gitapi.pull(PROJECT),
  'git/push': () => gitapi.push(PROJECT),
  'git/init': () => gitapi.init(PROJECT),
  'export/web': () => exportWeb(PROJECT),
  'project/graph': () => graph(PROJECT),
  'project/agents': () => writeAgents(PROJECT),
};

/** Puts the engine guide for coding agents (server/project-agents.md) into the project as AGENTS.md, plus CLAUDE.md pointing at it. */
async function writeAgents(root) {
  await fsapi.write(root, { path: 'res://AGENTS.md', text: fs.readFileSync(path.join(ENGINE, 'server', 'project-agents.md'), 'utf8') });
  if (!fs.existsSync(path.join(root, 'CLAUDE.md'))) await fsapi.write(root, { path: 'res://CLAUDE.md', text: '@AGENTS.md\n' });
  return { ok: true };
}

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };

/** Reject requests that did not come from the editor page itself (another website, a DNS-rebinding host name). */
function trusted(req) {
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) return false;
  if (req.headers['x-engine'] !== '1') return false;
  const origin = req.headers.origin;
  return !origin || /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(origin);
}

async function readBody(req) {
  let s = '';
  for await (const c of req) { s += c; if (s.length > 64 * 1024 * 1024) throw Object.assign(new Error('요청이 너무 커요'), { status: 413 }); }
  return s ? JSON.parse(s) : {};
}

async function handleApi(req, res, name) {
  if (req.method !== 'POST' || !trusted(req)) return json(res, 403, { error: 'forbidden' });
  try {
    const body = await readBody(req);
    const fn = API[name];
    if (!fn) return json(res, 404, { error: 'unknown api ' + name });
    json(res, 200, await fn(body));
  } catch (e) {
    json(res, e.status || 500, { error: e.message });
  }
}

function serveFile(res, abs) {
  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) return json(res, 404, { error: 'not found' });
    res.writeHead(200, { 'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(abs).pipe(res);
  });
}

let vite = null;
if (DEV) {
  const { createServer } = await import('vite');
  vite = await createServer({ root: ENGINE, server: { middlewareMode: true }, appType: 'mpa' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url.pathname.slice(5));
  if (url.pathname.startsWith('/project/')) {
    try { return serveFile(res, resolveInside(PROJECT, decodeURIComponent(url.pathname.slice(9)))); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (vite) return vite.middlewares(req, res, () => json(res, 404, { error: 'not found' }));
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  try { serveFile(res, resolveInside(path.join(ENGINE, 'dist'), rel)); } catch { json(res, 400, { error: 'bad path' }); }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`에디터: http://127.0.0.1:${PORT}/`);
  if (process.argv.includes('--open')) exec(`${process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open'} http://127.0.0.1:${PORT}/`);
  console.log(`프로젝트: ${PROJECT}${DEV ? ' (개발 모드)' : ''}`);
});
