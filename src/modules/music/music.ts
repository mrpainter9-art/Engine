import type { Module } from '../../core/module';

// Plays the scene's "music". A scene without music is silent; the same song keeps going across scenes.
// While the game is being edited there is no music; it starts again when playing.
export function createMusic(): Module {
  return {
    name: 'music',
    enter({ sound, scene, editing }) {
      sound.music(editing ? '' : (scene.music ?? ''));
    },
  };
}
