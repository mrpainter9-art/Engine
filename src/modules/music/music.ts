import type { Module } from '../../core/module';

// Plays the scene's "music". A scene without music is silent; the same song keeps going across scenes.
export function createMusic(): Module {
  return {
    name: 'music',
    enter({ sound, scene }) {
      sound.music(scene.music ?? '');
    },
  };
}
