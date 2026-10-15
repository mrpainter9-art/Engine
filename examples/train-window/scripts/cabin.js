// Scrolls the scenery past the cabin window. Trees pass at train speed; the hill and mountain pictures
// move much slower, which is what distance does to things seen from a moving train.

const wrap = (x, half) => ((((x + half) % (half * 2)) + half * 2) % (half * 2)) - half;

export default class {
  ready() {
    this.trees = this.node.find('Outside/Trees').children;
    this.hills = this.node.find('Outside/Hills');
    this.mountains = this.node.find('Outside/Mountains');
    this.info = this.node.find('HUD/Info');
    this.speed = 12; // m/s, about 43 km/h
  }

  process(dt) {
    const input = this.game.input;
    if (input.isActionDown('faster')) this.speed = Math.min(this.speed + 20 * dt, 60);
    if (input.isActionDown('slower')) this.speed = Math.max(this.speed - 20 * dt, 0);
    if (input.isActionPressed('switch_view')) this.game.changeScene('res://scenes/main.scene.json');
    const d = this.speed * dt;
    for (const t of this.trees) t.position = { ...t.position, x: wrap(t.position.x + d, 16) };
    this.hills.position = { ...this.hills.position, x: wrap(this.hills.position.x + d * 0.05, 38) };
    this.mountains.position = { ...this.mountains.position, x: wrap(this.mountains.position.x + d * 0.012, 30) };
    this.info.text = `3D 객실  ${Math.round(this.speed * 3.6)} km/h  (← → 속도, Space 창밖 보기)`;
  }
}
