import type { Game, Module } from '../../core/module';
import { drawText } from '../../core/text';
import data from './rules.json';

// The rules of one round: collect every object of one kind before time runs out.
// Shows the score and time on screen, a clear / time-up message, and restarts with "action".
// Text can use {score}, {goal} and {time}.
export function createRules(): Module {
  let goal = 0;
  let timeLeft = 0;
  let status: 'playing' | 'won' | 'lost' = 'playing';

  const begin = (game: Game) => {
    game.vars.score = 0;
    goal = game.world.find(data.collect).length;
    timeLeft = data.timeLimit;
    status = 'playing';
    game.paused = false;
  };
  const fill = (text: string, game: Game) =>
    text
      .replace(/\{score\}/g, String(game.vars.score ?? 0))
      .replace(/\{goal\}/g, String(goal))
      .replace(/\{time\}/g, String(Math.ceil(timeLeft)));

  return {
    name: 'rules',
    fixed: true,
    init: begin,
    update(dt, game) {
      if (status !== 'playing') {
        if (game.input.wasPressed('action')) {
          game.world.restart();
          begin(game);
        }
        return;
      }
      if (data.timeLimit > 0) timeLeft = Math.max(0, timeLeft - dt);
      if (goal > 0 && game.world.find(data.collect).length === 0) status = 'won';
      else if (data.timeLimit > 0 && timeLeft === 0) status = 'lost';
      if (status !== 'playing') game.paused = true;
    },
    draw(ctx, game) {
      drawText(ctx, fill(data.hud, game), 4, 3);
      if (data.timeLimit > 0) drawText(ctx, fill(data.hudTime, game), game.width - 4, 3, { align: 'right' });
      if (status === 'playing') return;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, game.width, game.height);
      const message = fill(status === 'won' ? data.winText : data.loseText, game);
      const color = status === 'won' ? '#f2c14e' : '#ff8a80';
      drawText(ctx, message, game.width / 2, game.height / 2 - 24, { align: 'center', color });
      drawText(ctx, data.restartText, game.width / 2, game.height / 2 + 16, { align: 'center' });
    },
  };
}
