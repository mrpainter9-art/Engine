import { defineConfig } from '@playwright/test';

// End-to-end test of the editor: `npm run test:e2e` (builds first). Each test file starts its own editor server on a temp copy of the example.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  use: { viewport: { width: 1400, height: 850 } },
});
