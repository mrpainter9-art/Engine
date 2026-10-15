import { execFile } from 'node:child_process';

/** Runs git in the project folder. Everything is scoped to that folder ("-- ."), so a project inside a bigger repo only sees its own files. */
function git(root, args, input) {
  return new Promise((resolve) => {
    const p = execFile('git', args, { cwd: root, maxBuffer: 20 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (err, stdout, stderr) =>
      resolve({ ok: !err, code: err ? err.code ?? 1 : 0, out: stdout.toString(), err: stderr.toString() }));
    if (input != null) { p.stdin.write(input); p.stdin.end(); }
  });
}

const fail = (r) => Object.assign(new Error((r.err || r.out).trim() || 'git 명령이 실패했어요'), { status: 400 });

export async function status(root) {
  const inside = await git(root, ['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok) return { isRepo: false };
  const [st, br, top] = await Promise.all([
    git(root, ['status', '--porcelain=v1', '-b', '--untracked-files=all', '--', '.']),
    git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    git(root, ['rev-parse', '--show-prefix']),
  ]);
  const lines = st.out.split('\n').filter(Boolean);
  const head = lines[0]?.startsWith('##') ? lines.shift() : '';
  const prefix = top.out.trim();
  const ahead = /ahead (\d+)/.exec(head)?.[1], behind = /behind (\d+)/.exec(head)?.[1];
  const files = lines.map((l) => {
    let p = l.slice(3);
    if (p.includes(' -> ')) p = p.split(' -> ')[1];
    p = p.replace(/^"|"$/g, '');
    return { status: l.slice(0, 2).trim() || '?', path: 'res://' + (p.startsWith(prefix) ? p.slice(prefix.length) : p) };
  });
  return { isRepo: true, branch: br.out.trim(), upstream: head.includes('...'), ahead: +(ahead || 0), behind: +(behind || 0), files };
}

export async function diff(root, { path: p }) {
  const rel = p ? p.replace(/^res:\/\//, '') : '.';
  const r = await git(root, ['diff', 'HEAD', '--', rel]);
  if (r.out.trim()) return { text: r.out };
  // untracked files have no diff against HEAD; show them as all-new
  const u = await git(root, ['diff', '--no-index', '--', '/dev/null', rel]);
  return { text: u.out };
}

export async function log(root) {
  const r = await git(root, ['log', '-n', '15', '--pretty=format:%h%x09%an%x09%ar%x09%s', '--', '.']);
  return { commits: r.ok ? r.out.split('\n').filter(Boolean).map((l) => { const [hash, author, when, subject] = l.split('\t'); return { hash, author, when, subject }; }) : [] };
}

export async function commit(root, { message }) {
  if (!String(message || '').trim()) throw Object.assign(new Error('커밋 메시지를 적어 주세요'), { status: 400 });
  const add = await git(root, ['add', '-A', '--', '.']);
  if (!add.ok) throw fail(add);
  const c = await git(root, ['commit', '-F', '-'], message);
  if (!c.ok) throw fail(c);
  return { out: c.out };
}

export async function pull(root) {
  const r = await git(root, ['pull', '--ff-only']);
  if (!r.ok) throw fail(r);
  return { out: r.out + r.err };
}

export async function push(root) {
  let r = await git(root, ['push']);
  if (!r.ok && /no upstream|has no upstream/i.test(r.err)) {
    const br = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).out.trim();
    r = await git(root, ['push', '-u', 'origin', br]);
  }
  if (!r.ok) throw fail(r);
  return { out: r.out + r.err };
}

export async function init(root) {
  const r = await git(root, ['init']);
  if (!r.ok) throw fail(r);
  return { out: r.out };
}
