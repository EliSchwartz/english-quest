let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18) {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  } catch {
    /* no audio */
  }
}

export const sounds = {
  correct: () => {
    tone(880, 0, 0.12, 'triangle');
    tone(1320, 0.09, 0.22, 'triangle');
  },
  wrong: () => {
    tone(220, 0, 0.18, 'sawtooth', 0.07);
    tone(185, 0.12, 0.25, 'sawtooth', 0.07);
  },
  tap: () => tone(600, 0, 0.05, 'sine', 0.08),
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, i === 3 ? 0.5 : 0.15, 'triangle')),
};
