import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 8790;
const URL = `http://127.0.0.1:${PORT}/`;
let server: ChildProcess;
let project: string;
let page: Page;

test.beforeAll(async ({ browser }) => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-e2e-'));
  fs.cpSync('examples/train-window', project, { recursive: true });
  server = spawn(process.execPath, ['server/server.mjs', '--project', project, '--port', String(PORT)], {
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com',
    },
    stdio: 'pipe',
  });
  await new Promise<void>((ok, fail) => {
    server.stdout!.on('data', (d) => { if (String(d).includes('에디터:')) ok(); });
    server.on('exit', (c) => fail(new Error('server exited ' + c)));
  });
  page = await browser.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.goto(URL);
});

test.afterAll(() => { server?.kill(); });

const sceneFile = (name = 'main') => fs.readFileSync(path.join(project, `scenes/${name}.scene.json`), 'utf8');
const sceneRow = (name: string) => page.locator('.dock', { hasText: '씬' }).first().locator('.row', { hasText: name }).first();
const fileRow = (name: string) => page.locator('.dock', { hasText: '파일시스템' }).locator('.row', { hasText: name }).first();
const view = () => page.locator('.center-view:not([hidden])');

test('opens the main scene with its node tree', async () => {
  await expect(sceneRow('Main')).toBeVisible();
  await expect(sceneRow('Camera')).toBeVisible();
  await expect(view().locator('.scene-tab.sel')).toContainText('main');
});

test('adds a Label, edits it in the inspector and saves the scene', async () => {
  await sceneRow('Main').click();
  await page.keyboard.press('Control+a');
  await page.locator('.type-row', { hasText: /^.?Label$/ }).dblclick();
  await expect(sceneRow('Label')).toBeVisible();
  const text = page.locator('.insp-row[data-prop=text] textarea');
  await text.fill('안녕 기차');
  await text.press('Tab');
  await page.keyboard.press('Control+s');
  await expect.poll(sceneFile).toContain('안녕 기차');
  // undo brings the old text back in the editor
  await view().locator('.vp-canvas').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+z');
  await sceneRow('Label').click();
  await expect(page.locator('.insp-row[data-prop=text] textarea')).toHaveValue('Label');
});

test('runs the game in a play window', async () => {
  const [play] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('F5')]);
  await play.waitForFunction(() => (window as any).game?.root?.name === 'Main');
  await play.waitForTimeout(500);
  const x = await play.evaluate(() => (window as any).game.find('Camera').position.x);
  expect(x).toBeGreaterThan(650);
  await expect(play.locator('#err')).toBeHidden();
  await play.close();
});

test('previews an image and shows where it is used', async () => {
  await fileRow('far.png').click();
  const preview = page.locator('.file-preview');
  await expect(preview).toContainText('1074 × 240 px');
  await expect(preview.locator('.pv-ref', { hasText: 'main.scene.json' })).toBeVisible();
  await preview.getByTitle('노드 속성으로 돌아가기').click();
  await expect(preview).toBeHidden();
});

test('opens the 3D cabin in the 3D view and moves a tree', async () => {
  await fileRow('cabin.scene.json').dblclick();
  await expect(page.locator('.main-tab.sel')).toHaveText('3D');
  const canvas = view().locator('canvas.vp3d');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1500);
  // a drawn scene makes a big screenshot; an empty canvas compresses to almost nothing
  expect((await canvas.screenshot()).length).toBeGreaterThan(20000);
  await sceneRow('Pine1').click();
  await expect(page.locator('.insp-head')).toContainText('MeshInstance3D');
  const z = page.locator('.insp-row[data-prop=position] input').nth(2);
  await z.fill('-7.5');
  await z.press('Tab');
  await page.keyboard.press('Control+s');
  await expect.poll(() => sceneFile('cabin')).toContain('"z": -7.5');
});

test('shows how files connect in the graph', async () => {
  await page.locator('.main-tab', { hasText: '연결' }).click();
  await expect(page.locator('.gcard')).toHaveCount(9);
  // one line per "uses" row: the seven pine trees share one line to pine.glb (17 uses, 11 lines)
  await expect(page.locator('.graph-edges path')).toHaveCount(11);
  await expect(page.locator('.graph-stats')).toContainText('연결 17');
  await page.locator('.gcard[data-path="res://models/pine.glb"]').click();
  await expect(page.locator('.file-preview')).toContainText('3D 모델');
  await expect(page.locator('.gcard.faded')).not.toHaveCount(0);
});

test('plays the 3D scene', async () => {
  await page.locator('.main-tab', { hasText: '3D' }).click();
  const [play] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('F6')]);
  await play.waitForFunction(() => (window as any).game?.root?.name === 'Cabin' && (window as any).game.three);
  await play.waitForTimeout(500);
  await expect(play.locator('#err')).toBeHidden();
  await play.close();
});

test('version control: init and commit', async () => {
  await page.locator('.btab', { hasText: '버전 관리' }).click();
  await page.getByRole('button', { name: 'Git 저장소 만들기' }).click();
  await expect(page.locator('.git-files')).toContainText('project.json');
  await page.locator('.git-left textarea').fill('예제 프로젝트 시작');
  await page.getByRole('button', { name: '커밋 (모두 담기)' }).click();
  await expect(page.locator('.git-log')).toContainText('예제 프로젝트 시작');
});
