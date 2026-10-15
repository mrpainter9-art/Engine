// Calls into the local editor server (server/server.mjs).
export async function api<T = any>(name: string, body: unknown = {}): Promise<T> {
  const res = await fetch('/api/' + name, { method: 'POST', headers: { 'content-type': 'application/json', 'x-engine': '1' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export interface FileEntry { path: string; dir: boolean; size?: number; mtime?: number }

export const projectUrl = (p: string) => '/project/' + p.replace(/^res:\/\//, '');

/** Streams Server-Sent Events from POST /api/ai/run. */
export async function apiStream(name: string, body: unknown, onEvent: (ev: any) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch('/api/' + name, { method: 'POST', headers: { 'content-type': 'application/json', 'x-engine': '1' }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) { const d = await res.json().catch(() => ({})); throw new Error(d.error || res.statusText); }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (chunk.startsWith('data: ')) onEvent(JSON.parse(chunk.slice(6)));
    }
  }
}
