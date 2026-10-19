import type { Game, Module } from '../../core/module';
import { drawText } from '../../core/text';
import defaults from './rules.json';

type Rules = typeof defaults;

// The rules of one stage: collect every object of one kind before time runs out.
// rules.json holds the usual values; a scene's "rules" can change any of them.
// A scene without rules is a menu (like the title): "action" goes to the scene's "next".
// Text can use {score}, {goal}, {time} and {best} (this scene's best record, kept after closing the browser).
// The record is the seconds left at clear (or the score when there is no time limit).
export function createRules(): Module {
  let rules: Rules | null = null;
  let goal = 0;
  let timeLeft = 0;
  let status: 'playing' | 'won' | 'lost' = 'playing';
  let newRecord = false;

  const fill = (text: string, game: Game) =>
    text
      .replace(/\{score\}/g, String(game.vars.score ?? 0))
      .replace(/\{goal\}/g, String(goal))
      .replace(/\{time\}/g, String(Math.ceil(timeLeft)))
      .replace(/\{best\}/g, String(game.save.get(`best-${game.sceneName}`)));

  return {
    name: 'rules',
    fixed: true,
    enter(game) {
      rules = game.scene.rules ? { ...defaults, ...game.scene.rules } : null;
      game.vars.score = 0;
      goal = rules ? game.world.find(rules.collect).length : 0;
      timeLeft = rules?.timeLimit ?? 0;
      status = 'playing';
      newRecord = false;
    },
    update(dt, game) {
      const next = game.scene.next ?? game.sceneName;
      if (!rules) {
        if (game.input.wasPressed('action')) game.goTo(next);
        return;
      }
      if (status !== 'playing') {
        // Cleared: on to the next scene. Failed: this scene again.
        if (game.input.wasPressed('action')) game.goTo(status === 'won' ? next : game.sceneName);
        return;
      }
      if (rules.timeLimit > 0) timeLeft = Math.max(0, timeLeft - dt);
      if (goal > 0 && game.world.find(rules.collect).length === 0) status = 'won';
      else if (rules.timeLimit > 0 && timeLeft === 0) status = 'lost';
      if (status !== 'playing') {
        game.paused = true;
        game.sound.play(status === 'won' ? rules.winSound : rules.loseSound);
        if (status === 'won') {
          const key = `best-${game.sceneName}`;
          const record = rules.timeLimit > 0 ? Math.ceil(timeLeft) : (game.vars.score ?? 0);
          newRecord = record > game.save.get(key);
          if (newRecord) game.save.set(key, record);
        }
      }
    },
    draw(ctx, game) {
      if (!rules) return;
      drawText(ctx, fill(rules.hud, game), 4, 3);
      if (rules.timeLimit > 0) drawText(ctx, fill(rules.hudTime, game), game.width - 4, 3, { align: 'right' });
      if (status === 'playing') return;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, game.width, game.height);
      const won = status === 'won';
      const message = fill(won ? rules.winText : rules.loseText, game);
      drawText(ctx, message, game.width / 2, game.height / 2 - 24, { align: 'center', color: won ? '#f2c14e' : '#ff8a80' });
      if (newRecord) drawText(ctx, rules.recordText, game.width / 2, game.height / 2 - 40, { align: 'center', color: '#9be38f' });
      drawText(ctx, won ? rules.nextText : rules.restartText, game.width / 2, game.height / 2 + 16, { align: 'center' });
    },
  };
}
