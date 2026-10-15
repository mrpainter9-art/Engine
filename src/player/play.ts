import { Game, type ProjectConfig } from '../engine';

// Runs a project: in the editor's play window (?scene=res://...) or as an exported web build (main scene from project.json).
const resolve = (p: string) => new URL('project/' + p.replace(/^res:\/\//, ''), location.href).href;
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('engine-play') : null;
const errBox = document.getElementById('err')!;

function log(level: 'info' | 'error', msg: string) {
  (level === 'error' ? console.error : console.log)(msg);
  channel?.postMessage({ level, msg });
  if (level === 'error') errBox.textContent += msg + '\n';
}

async function main() {
  const project: ProjectConfig = await (await fetch(resolve('res://project.json'), { cache: 'no-store' })).json();
  document.title = project.name || 'Game';
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas, project, resolve, log);
  // integer pixel scaling with letterbox, like Godot's viewport stretch with integer scale
  const fit = () => {
    const s = Math.max(1, Math.floor(Math.min(innerWidth / project.viewport.width, innerHeight / project.viewport.height)));
    canvas.style.width = project.viewport.width * s + 'px';
    canvas.style.height = project.viewport.height * s + 'px';
  };
  addEventListener('resize', fit);
  fit();
  const scene = new URLSearchParams(location.search).get('scene') || project.mainScene;
  await game.changeScene(scene);
  log('info', `실행: ${scene}`);
  game.start();
  (window as any).game = game;
}

addEventListener('error', (e) => log('error', e.message));
addEventListener('unhandledrejection', (e) => log('error', String((e.reason && e.reason.message) || e.reason)));
main().catch((e) => log('error', e.message));
