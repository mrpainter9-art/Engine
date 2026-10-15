// Calls into the local editor server (server/server.mjs).
export async function api<T = any>(name: string, body: unknown = {}): Promise<T> {
  const res = await fetch('/api/' + name, { method: 'POST', headers: { 'content-type': 'application/json', 'x-engine': '1' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export interface FileEntry { path: string; dir: boolean; size?: number; mtime?: number }

export const projectUrl = (p: string) => '/project/' + p.replace(/^res:\/\//, '');
