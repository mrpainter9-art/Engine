import path from 'node:path';

/** Map 'res://a/b.png' or 'a/b.png' to an absolute path inside root; throws if it would escape the project folder. */
export function resolveInside(root, p) {
  const rel = String(p || '').replace(/^res:\/\//, '').replace(/^\/+/, '');
  const abs = path.resolve(root, rel);
  const r = path.resolve(root);
  if (abs !== r && !abs.startsWith(r + path.sep)) throw Object.assign(new Error('프로젝트 폴더 밖의 경로예요: ' + p), { status: 400 });
  return abs;
}

export const toRes = (root, abs) => 'res://' + path.relative(root, abs).split(path.sep).join('/');
