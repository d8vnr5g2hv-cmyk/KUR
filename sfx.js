// HALO LINK — 効果音（その場で合成。電子音寄り）と振動
'use strict';
const Sfx = (() => {
  let ac = null, out = null;
  function bus() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      out = ac.createGain(); out.gain.value = .8;
      const comp = ac.createDynamicsCompressor(); out.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state !== 'running') ac.resume();
    return out;
  }
  function tone(f, at, dur, vol, type = 'sine', f2) {
    const o = bus(), t = ac.currentTime + at, osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t); if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    osc.connect(g); g.connect(o); osc.start(t); osc.stop(t + dur + .02);
  }
  function noise(at, dur, vol, f0, f1) {
    const o = bus(), t = ac.currentTime + at, b = ac.createBuffer(1, Math.max(1, ac.sampleRate * dur), ac.sampleRate), x = b.getChannelData(0);
    for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = b; bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(o); s.start(t); s.stop(t + dur);
  }
  const P = {
    tap:  () => { tone(1800, 0, .05, .05, 'square'); },
    back: () => { tone(900, 0, .07, .05, 'square', 500); },
    ok:   () => { tone(1200, 0, .08, .06, 'square'); tone(1800, .06, .12, .05, 'square'); },
    link: n => tone(520 * Math.pow(1.0595, Math.min(n, 24) * 2), 0, .07, .05, 'triangle'),
    clear:n => { tone(700 + n * 90, 0, .16, .08, 'triangle'); noise(0, .2, .06, 3000, 9000); },
    shot: () => { noise(0, .12, .05, 1200, 4000); },
    hit:  () => { tone(180, 0, .14, .1, 'square', 70); noise(0, .1, .07, 800, 300); },
    heal: () => { [880, 1175, 1480].forEach((f, i) => tone(f, i * .06, .3, .05, 'sine')); },
    enemy:() => { tone(120, 0, .35, .14, 'sawtooth', 50); noise(0, .3, .1, 400, 120); },
    skill:() => { noise(0, .5, .08, 300, 6000); tone(440, .05, .5, .07, 'sawtooth', 880); tone(880, .25, .6, .06, 'triangle'); },
    warn: () => { [0, .25, .5].forEach(a => tone(220, a, .2, .1, 'square', 180)); },
    floor:() => { tone(660, 0, .1, .06, 'square'); tone(990, .1, .2, .06, 'square'); },
    win:  () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * .09, .4, .07, 'triangle')); },
    lose: () => { [440, 349, 262].forEach((f, i) => tone(f, i * .18, .5, .07, 'triangle')); },
    gate: () => { noise(0, 1.4, .07, 200, 5000); tone(110, 0, 1.4, .08, 'sawtooth', 880); },
    draw: () => { noise(0, .08, .03, 2500, 6000); },
    play: () => { noise(0, .14, .05, 800, 5000); tone(660, 0, .1, .04, 'triangle', 990); },
    guard:() => { tone(300, 0, .18, .08, 'square', 600); noise(0, .15, .05, 2000, 800); },
    flip: () => { noise(0, .1, .05, 1500, 7000); tone(1320, .04, .12, .04, 'sine'); },
    tear: () => { noise(0, .45, .12, 6000, 900); },
    turn: () => { tone(523, 0, .12, .05, 'triangle'); tone(784, .08, .2, .05, 'triangle'); },
    rare: r => { const b = r >= 4 ? [1046, 1318, 1568, 2093, 2637, 3136] : r >= 3 ? [1046, 1318, 1568, 2093] : [784, 988, 1175]; b.forEach((f, i) => tone(f, i * .07, .6, .07, 'triangle')); },
  };
  function play(k, a) { try { (P[k] || P.tap)(a); } catch (e) {} }
  return { play };
})();
const vib = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
