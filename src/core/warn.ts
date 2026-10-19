// Shows problems to the person making the game as a red bar at the top of the page,
// in plain words, instead of failing silently. The game keeps running.
const messages = new Set<string>();

export function warn(message: string): void {
  if (messages.has(message)) return;
  messages.add(message);
  console.warn(message);
  let bar = document.getElementById('engine-warning');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'engine-warning';
    bar.style.cssText =
      'position:fixed;left:0;right:0;top:0;padding:8px 12px;background:#b3261e;color:#fff;font:14px sans-serif;white-space:pre-line';
    document.body.appendChild(bar);
  }
  bar.textContent = [...messages].join('\n');
}
