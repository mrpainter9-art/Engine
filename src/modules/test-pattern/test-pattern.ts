import type { Module } from '../../core/module';

// Step 2 check: a 1-pixel checkerboard and a frame around the screen edge.
// If the zoom is blurry, the checkerboard turns into a grey smudge.
export function createTestPattern(screenWidth: number, screenHeight: number): Module {
  return {
    name: 'test-pattern',
    draw(ctx) {
      ctx.fillStyle = '#ffffff';
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if ((x + y) % 2 === 0) ctx.fillRect(4 + x, 4 + y, 1, 1);
        }
      }
      ctx.strokeStyle = '#3a7bd5';
      ctx.strokeRect(0.5, 0.5, screenWidth - 1, screenHeight - 1);
    },
  };
}
