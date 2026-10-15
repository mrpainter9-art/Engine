import { ed, on, log } from '../state';
import { h, clear } from '../ui';

export function createOutputPanel(): HTMLElement {
  const list = h('div', { class: 'out-list' });
  const render = () => {
    clear(list);
    for (const l of ed.logs) list.append(h('div', { class: 'out-line ' + l.level }, h('span', { class: 'muted' }, l.at.toLocaleTimeString() + ' '), l.msg));
    list.scrollTop = list.scrollHeight;
  };
  on('log', render);
  // messages from the game window (print and errors)
  if ('BroadcastChannel' in window) new BroadcastChannel('engine-play').onmessage = (e) => log('▶ ' + e.data.msg, e.data.level === 'error' ? 'error' : 'info');
  return h('div', { class: 'panel' }, h('div', { class: 'panel-tools' }, h('button', { class: 'tool', onclick: () => { ed.logs.length = 0; render(); } }, '지우기')), list);
}
