import { readBytes } from './files';
import { warn } from './warn';

// Sounds: every file in assets/sounds/ is found automatically and used by its file name
// ("assets/sounds/coin.wav" -> "coin"). Browsers only allow sound after the first key press or click.
const files = import.meta.glob('/assets/sounds/**/*.{wav,mp3,ogg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export interface Volumes {
  soundVolume: number; // effects, 0..1
  musicVolume: number; // background music, 0..1
}

export class Sound {
  private ctx = new AudioContext();
  private buffers = new Map<string, AudioBuffer>();
  private effects: GainNode;
  private musicGain: GainNode;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicName = '';
  private missing = new Set<string>();

  constructor(volumes: Volumes) {
    this.effects = this.gain(volumes.soundVolume);
    this.musicGain = this.gain(volumes.musicVolume);
    const unlock = () => this.ctx.resume();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
  }

  async load(): Promise<void> {
    await Promise.all(
      Object.entries(files).map(async ([path, url]) => {
        try {
          const data = await readBytes(url);
          this.buffers.set(path.replace(/^\/assets\/sounds\//, '').replace(/\.\w+$/, ''), await this.ctx.decodeAudioData(data));
        } catch {
          console.warn(`Could not read sound: ${path}`);
        }
      }),
    );
  }

  /** Every sound name (for the editor's lists). */
  names(): string[] {
    return [...this.buffers.keys()].sort();
  }

  /** How long a sound is, in seconds (0 if there is no such sound). */
  length(name: string): number {
    return this.buffers.get(name)?.duration ?? 0;
  }

  /** Play an effect once. An empty name does nothing, so blocks can leave sound off. */
  play(name: string): void {
    const buffer = this.find(name);
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.effects);
    src.start();
  }

  /** Loop background music. The same song keeps playing; "" stops it. */
  music(name: string): void {
    if (name === this.musicName) return;
    this.musicSource?.stop();
    this.musicSource = null;
    this.musicName = name;
    const buffer = this.find(name);
    if (!buffer) return;
    this.musicSource = this.ctx.createBufferSource();
    this.musicSource.buffer = buffer;
    this.musicSource.loop = true;
    this.musicSource.connect(this.musicGain);
    this.musicSource.start();
  }

  private find(name: string): AudioBuffer | null {
    if (!name) return null;
    const buffer = this.buffers.get(name);
    if (!buffer && !this.missing.has(name)) {
      this.missing.add(name);
      warn(`소리를 못 찾았어요: ${name} (assets/sounds 폴더에 같은 이름의 파일이 있는지 확인해 주세요)`);
    }
    return buffer ?? null;
  }

  private gain(value: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(this.ctx.destination);
    return g;
  }
}
