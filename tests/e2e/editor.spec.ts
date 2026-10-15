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
      ENGINE_CLAUDE_CMD: path.resolve('tests/fixtures/fake-claude.mjs'),
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

const sceneFile = () => fs.readFileSync(path.join(project, 'scenes/main.scene.json'), 'utf8');
const sceneRow = (name: string) => page.locator('.dock', { hasText: '씬' }).first().locator('.row', { hasText: name }).first();

test('opens the main scene with its node tree', async () => {
  await expect(sceneRow('Main')).toBeVisible();
  await expect(sceneRow('Camera')).toBeVisible();
  await expect(page.locator('.scene-tab.sel')).toContainText('main');
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
  await page.locator('.vp-canvas').click({ position: { x: 5, y: 5 } });
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

test('version control: init and commit', async () => {
  await page.locator('.btab', { hasText: '버전 관리' }).click();
  await page.getByRole('button', { name: 'Git 저장소 만들기' }).click();
  await expect(page.locator('.git-files')).toContainText('project.json');
  await page.locator('.git-left textarea').fill('예제 프로젝트 시작');
  await page.getByRole('button', { name: '커밋 (모두 담기)' }).click();
  await expect(page.locator('.git-log')).toContainText('예제 프로젝트 시작');
});

test('AI panel runs the agent and picks up the files it wrote', async () => {
  await page.locator('.btab', { hasText: 'AI' }).click();
  await page.locator('.panel.ai select').nth(1).selectOption('edit');
  await page.locator('.ai-input textarea').fill('스크립트 하나 만들어줘');
  await page.locator('.ai-input textarea').press('Control+Enter');
  await expect(page.locator('.ai-out')).toContainText('엔진 설명을 받았어요.');
  await expect(page.locator('.ai-out')).toContainText('토큰 1,234');
  await expect(page.locator('.row', { hasText: 'from_ai.js' })).toBeVisible();
});
