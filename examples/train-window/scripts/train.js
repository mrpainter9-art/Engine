// Moves the camera along the Meiringen -> Interlaken Ost line and colours the sky and light by the time of day.
// Values come from LifeTrain prototype/web/train.html (SKY table, tintFor) and assets/terrain/brienz/manifest.json.

const NEAR_F = 0.26, NEAR_S0 = 51576.92; // near strip: 1 px = 1/0.26 m along the line
const S_START = 53000, S_END = 79648.62;
const STATIONS = [['Meiringen', 53000], ['Brienzwiler', 60194], ['Brienz', 64907], ['Oberried', 71130], ['Niederried', 73938], ['Ringgenberg', 77287], ['Interlaken Ost', 79649]];
const SKY = [[-90, '#070a18', '#10162c'], [-12, '#0b1130', '#1b2346'], [-6, '#1d2655', '#6b4f78'], [-2, '#2e3f7a', '#d2786a'], [2, '#4566a6', '#f0a46c'], [8, '#3f72c4', '#e9d6b4'], [20, '#2f6fd0', '#a9d3ee'], [90, '#2a68cc', '#9ccbec']];
const DAY_SECONDS = 180; // one in-game day lasts three real minutes

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const lerp = (a, b, t) => a + (b - a) * t;

function skyColors(el) {
  for (let i = 1; i < SKY.length; i++) if (el < SKY[i][0]) { const a = SKY[i - 1], b = SKY[i], t = (el - a[0]) / (b[0] - a[0]); return [mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
  return [SKY[7][1], SKY[7][2]];
}

// tintFor() from the prototype, turned into a multiply colour (white = no change)
function light(el) {
  let c, a;
  if (el < -10) { c = '#141a3c'; a = 0.66; }
  else if (el < -3) { const t = (el + 10) / 7; c = mix('#141a3c', '#5a3e6e', t); a = lerp(0.66, 0.42, t); }
  else if (el < 5) { const t = (el + 3) / 8; c = mix('#5a3e6e', '#ff9a5a', t); a = lerp(0.42, 0.18, t); }
  else if (el < 16) { const t = (el - 5) / 11; c = '#ffb070'; a = lerp(0.18, 0, t); }
  else { c = '#ffffff'; a = 0; }
  return mix('#ffffff', c, a);
}

export default class {
  ready() {
    this.s = S_START;
    this.speed = 16; // m/s, about 58 km/h
    this.hour = 15.5;
    this.camera = this.node.find('Camera');
    this.sky = this.node.find('Sky/Gradient');
    this.light = this.node.find('Light');
    this.info = this.node.find('HUD/Info');
  }

  process(dt) {
    const input = this.game.input;
    if (input.isActionDown('faster')) this.speed = Math.min(this.speed + 60 * dt, 400);
    if (input.isActionDown('slower')) this.speed = Math.max(this.speed - 60 * dt, 0);
    if (input.isActionPressed('skip_time')) this.hour = (this.hour + 2) % 24;

    this.s = Math.min(this.s + this.speed * dt, S_END);
    this.hour = (this.hour + dt * 24 / DAY_SECONDS) % 24;

    // camera centre = screen-left edge on the near strip + half the screen
    this.camera.position = { x: Math.round((this.s - NEAR_S0) * NEAR_F) + 280, y: 120 };

    const el = Math.sin(((this.hour - 6) / 24) * Math.PI * 2) * 45; // rough sun height in degrees
    const [top, bottom] = skyColors(el);
    this.sky.color = top;
    this.sky.colorBottom = bottom;
    this.light.color = light(el);

    const next = STATIONS.find(([, at]) => at > this.s + 1);
    const hh = Math.floor(this.hour), mm = Math.floor((this.hour % 1) * 60);
    this.info.text = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ${Math.round(this.speed * 3.6)} km/h  ` +
      (next ? `다음 ${next[0]} ${((next[1] - this.s) / 1000).toFixed(1)} km` : '종착 Interlaken Ost');
  }
}
