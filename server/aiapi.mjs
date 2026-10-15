import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTEXT = fs.readFileSync(path.join(HERE, 'ai-context.md'), 'utf8');

/**
 * How each agent is started. The prompt always goes in on stdin, so the arguments are fixed strings (safe with shell: true on Windows).
 * ENGINE_CLAUDE_CMD / ENGINE_CODEX_CMD replace the program (tests point them at a fake agent).
 */
export function agentCommand(agent, { mode, resume }) {
  const edit = mode === 'edit';
  if (agent === 'codex') {
    const cmd = process.env.ENGINE_CODEX_CMD || 'codex';
    const args = resume ? ['exec', 'resume', '--last', '-'] : ['exec', '-s', edit ? 'workspace-write' : 'read-only', '-'];
    return { cmd, args, format: 'text' };
  }
  const cmd = process.env.ENGINE_CLAUDE_CMD || 'claude';
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', edit ? 'acceptEdits' : 'plan'];
  if (resume) args.push('--continue');
  return { cmd, args, format: 'claude-stream' };
}

/** The editor sends what is on screen (scene, selected node, open script) so the agent starts in the right place instead of exploring. */
export function buildPrompt({ prompt, context = {} }) {
  const lines = [];
  if (context.scene) lines.push(`Open scene: ${context.scene}`);
  if (context.node) lines.push(`Selected node: ${context.node}`);
  if (context.script) lines.push(`Open script: ${context.script}`);
  return `${CONTEXT}\n${lines.length ? 'Editor state:\n- ' + lines.join('\n- ') + '\n' : ''}\nRequest:\n${prompt}\n`;
}

const short = (v) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s.length > 90 ? s.slice(0, 87) + '...' : s; };

/** Turn one line of `claude -p --output-format stream-json` into events for the AI panel. */
export function claudeEvents(line) {
  let m;
  try { m = JSON.parse(line); } catch { return line.trim() ? [{ type: 'log', text: line }] : []; }
  const out = [];
  if (m.type === 'assistant' && m.message?.content) {
    for (const c of m.message.content) {
      if (c.type === 'text' && c.text) out.push({ type: 'text', text: c.text });
      if (c.type === 'tool_use') out.push({ type: 'tool', text: `${c.name} ${short(c.input?.file_path || c.input?.command || c.input?.pattern || c.input || '')}` });
    }
  } else if (m.type === 'result') {
    const u = m.usage || {};
    const tokens = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    out.push({ type: 'usage', text: `${m.is_error ? '오류로 끝남' : '완료'} · ${Math.round((m.duration_ms || 0) / 1000)}초 · 토큰 ${tokens.toLocaleString()}${m.total_cost_usd != null ? ` · $${m.total_cost_usd.toFixed(3)}` : ''}` });
  }
  return out;
}

let current = null;

/** Start an agent and stream its events to the response as Server-Sent Events. One run at a time. */
export function run(root, body, res) {
  if (current) { res.writeHead(409, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: '이미 실행 중이에요' })); return; }
  const { cmd, args, format } = agentCommand(body.agent, body);
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
  const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  send({ type: 'log', text: `$ ${cmd} ${args.join(' ')}` });
  let child;
  try {
    child = spawn(cmd, args, { cwd: root, shell: process.platform === 'win32', env: { ...process.env, NO_COLOR: '1' } });
  } catch (e) { send({ type: 'error', text: e.message }); res.end(); return; }
  current = child;
  child.stdin.on('error', () => {});
  child.stdin.end(buildPrompt(body));
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const l of lines) for (const ev of format === 'claude-stream' ? claudeEvents(l) : [{ type: 'text', text: l + '\n' }]) send(ev);
  });
  child.stderr.on('data', (d) => send({ type: 'log', text: d.toString() }));
  child.on('error', (e) => send({ type: 'error', text: e.code === 'ENOENT' ? `${cmd} 프로그램을 찾을 수 없어요. 설치하고 로그인했는지 확인해 주세요.` : e.message }));
  child.on('close', (code) => {
    if (buf) for (const ev of format === 'claude-stream' ? claudeEvents(buf) : [{ type: 'text', text: buf }]) send(ev);
    send({ type: 'done', code });
    current = null;
    res.end();
  });
  res.on('close', () => { if (current === child) stop(); });
}

export function stop() {
  if (current) { current.kill(); current = null; return { stopped: true }; }
  return { stopped: false };
}
