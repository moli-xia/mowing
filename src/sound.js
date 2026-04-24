import backgroundMusicUrl from './assets/music/background.mp3?url';
import zombieHitWavUrl from './assets/music/pain-from-a-zombie-2207.wav?url';
import zombieWalkWavUrl from './assets/music/single-zombie-breath-2233.wav?url';

export let audioCtx = null;
let masterGain = null;
let noiseBuffer = null;
let bgMusic = null;
let bgMusicSource = null;
let bgMusicGain = null;
let bgMusicEnabled = false;
let soundEffectsEnabled = true;
let zombieHitBuffer = null;
let zombieWalkBuffer = null;
let sfxGain = null;
let currentVolume = 1.0;

function ensureBackgroundMusic() {
  if (bgMusic) return bgMusic;
  bgMusic = new Audio(backgroundMusicUrl);
  bgMusic.loop = true;
  bgMusic.preload = 'auto';
  return bgMusic;
}

function connectBgMusicToWebAudio() {
  if (!audioCtx || !bgMusic || bgMusicSource) return;
  bgMusicSource = audioCtx.createMediaElementSource(bgMusic);
  bgMusicGain = audioCtx.createGain();
  bgMusicGain.gain.value = currentVolume;
  bgMusicSource.connect(bgMusicGain);
  bgMusicGain.connect(masterGain);
}

export function initAudio() {
  if (!audioCtx || audioCtx.state === 'closed') {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.35 * currentVolume;
    masterGain.connect(audioCtx.destination);
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = currentVolume;
    sfxGain.connect(masterGain);
    noiseBuffer = createNoiseBuffer(audioCtx);
    loadZombieSounds();
  }

  const ctx = audioCtx;
  if (ctx.state !== 'running') {
    return ctx.resume().then(() => {
      // Emit a near-silent pulse so browsers fully unlock the context on first gesture.
      const unlockOsc = ctx.createOscillator();
      const unlockGain = ctx.createGain();
      unlockGain.gain.value = 0.00001;
      unlockOsc.connect(unlockGain);
      unlockGain.connect(masterGain);
      unlockOsc.start();
      unlockOsc.stop(ctx.currentTime + 0.01);
      syncBackgroundMusic();
    }).catch(() => {});
  }
  syncBackgroundMusic();
  return Promise.resolve();
}

function withAudioReady(playFn) {
  if (!soundEffectsEnabled) return;
  const ctx = audioCtx;
  if (!ctx || !masterGain || !noiseBuffer) {
    return;
  }
  if (ctx.state === 'running') {
    playFn(ctx);
    return;
  }
  ctx.resume().then(() => {
    if (ctx.state === 'running') {
      playFn(ctx);
    }
  }).catch(() => {});
}

// Create a reusable noise buffer for percussive sounds
function createNoiseBuffer(ctx) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

async function loadAudioBuffer(url) {
  if (!audioCtx) return null;
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.warn('Failed to load audio:', url, e);
    return null;
  }
}

async function loadZombieSounds() {
  zombieHitBuffer = await loadAudioBuffer(zombieHitWavUrl);
  zombieWalkBuffer = await loadAudioBuffer(zombieWalkWavUrl);
}

function playWavBuffer(buffer, volume = 1.0, loop = false) {
  if (!soundEffectsEnabled) return null;
  if (!buffer || !audioCtx || !sfxGain) return null;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = volume;
  source.connect(gainNode);
  gainNode.connect(sfxGain);
  source.start(0);
  return source;
}

export function playShoot() {
  withAudioReady((ctx) => {
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(820, now);
    filter.frequency.exponentialRampToValueAtTime(360, now + 0.2);
    filter.Q.value = 0.6;

    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(96, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(52, now + 0.16);

    const tailOsc = ctx.createOscillator();
    tailOsc.type = 'sine';
    tailOsc.frequency.setValueAtTime(180, now);
    tailOsc.frequency.exponentialRampToValueAtTime(74, now + 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.95, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    bodyOsc.connect(gain);
    tailOsc.connect(gain);
    gain.connect(masterGain);

    noise.start(now);
    bodyOsc.start(now);
    tailOsc.start(now);
    noise.stop(now + 0.2);
    bodyOsc.stop(now + 0.16);
    tailOsc.stop(now + 0.12);
  });
}

export function playFootstep() {
  // Footstep sound intentionally removed.
}

let lastWalkSoundTime = 0;
export function playZombieRoar() {
  if (!soundEffectsEnabled) return;
  const now = performance.now();
  if (now - lastWalkSoundTime < 800) return;
  lastWalkSoundTime = now;
  playWavBuffer(zombieWalkBuffer, 0.7);
}

export function playWeakSpotHit() {
  playWavBuffer(zombieHitBuffer, 0.8);
}

export function playZombieNormalDeath() {
  withAudioReady((ctx) => {
    const now = ctx.currentTime;

    const rumble = ctx.createOscillator();
    rumble.type = 'triangle';
    rumble.frequency.setValueAtTime(82, now);
    rumble.frequency.exponentialRampToValueAtTime(34, now + 0.34);

    const punch = ctx.createOscillator();
    punch.type = 'sine';
    punch.frequency.setValueAtTime(138, now);
    punch.frequency.exponentialRampToValueAtTime(42, now + 0.18);

    const tail = ctx.createOscillator();
    tail.type = 'sawtooth';
    tail.frequency.setValueAtTime(210, now + 0.012);
    tail.frequency.exponentialRampToValueAtTime(74, now + 0.22);

    const blast = ctx.createBufferSource();
    blast.buffer = noiseBuffer;
    const blastFilter = ctx.createBiquadFilter();
    blastFilter.type = 'lowpass';
    blastFilter.frequency.setValueAtTime(1650, now);
    blastFilter.frequency.exponentialRampToValueAtTime(240, now + 0.24);
    blastFilter.Q.value = 0.7;

    const crack = ctx.createBufferSource();
    crack.buffer = noiseBuffer;
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(920, now);
    crackFilter.frequency.exponentialRampToValueAtTime(360, now + 0.12);
    crackFilter.Q.value = 1.1;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.001, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.46, now + 0.014);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(0.001, now);
    tailGain.gain.exponentialRampToValueAtTime(0.16, now + 0.026);
    tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    const blastGain = ctx.createGain();
    blastGain.gain.setValueAtTime(0.001, now);
    blastGain.gain.exponentialRampToValueAtTime(0.8, now + 0.008);
    blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.001, now);
    crackGain.gain.exponentialRampToValueAtTime(0.24, now + 0.004);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    rumble.connect(rumbleGain);
    punch.connect(rumbleGain);
    tail.connect(tailGain);
    blast.connect(blastFilter);
    blastFilter.connect(blastGain);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);

    rumbleGain.connect(masterGain);
    tailGain.connect(masterGain);
    blastGain.connect(masterGain);
    crackGain.connect(masterGain);

    rumble.start(now);
    punch.start(now);
    tail.start(now + 0.01);
    blast.start(now);
    crack.start(now);
    rumble.stop(now + 0.36);
    punch.stop(now + 0.22);
    tail.stop(now + 0.26);
    blast.stop(now + 0.18);
    crack.stop(now + 0.08);
  });
}

export function playZombieHeadshotDeath() {
  withAudioReady((ctx) => {
    const now = ctx.currentTime;

    const pop = ctx.createOscillator();
    pop.type = 'square';
    pop.frequency.setValueAtTime(320, now);
    pop.frequency.exponentialRampToValueAtTime(96, now + 0.09);

    const ring = ctx.createOscillator();
    ring.type = 'triangle';
    ring.frequency.setValueAtTime(840, now);
    ring.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    const crack = ctx.createBufferSource();
    crack.buffer = noiseBuffer;
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(1900, now);
    crackFilter.frequency.exponentialRampToValueAtTime(620, now + 0.11);
    crackFilter.Q.value = 1.5;

    const burst = ctx.createBufferSource();
    burst.buffer = noiseBuffer;
    const burstFilter = ctx.createBiquadFilter();
    burstFilter.type = 'lowpass';
    burstFilter.frequency.setValueAtTime(1300, now);
    burstFilter.frequency.exponentialRampToValueAtTime(220, now + 0.2);
    burstFilter.Q.value = 0.85;

    const tonalGain = ctx.createGain();
    tonalGain.gain.setValueAtTime(0.001, now);
    tonalGain.gain.exponentialRampToValueAtTime(0.28, now + 0.004);
    tonalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.001, now);
    crackGain.gain.exponentialRampToValueAtTime(0.34, now + 0.003);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    const burstGain = ctx.createGain();
    burstGain.gain.setValueAtTime(0.001, now);
    burstGain.gain.exponentialRampToValueAtTime(0.54, now + 0.008);
    burstGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    pop.connect(tonalGain);
    ring.connect(tonalGain);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    burst.connect(burstFilter);
    burstFilter.connect(burstGain);

    tonalGain.connect(masterGain);
    crackGain.connect(masterGain);
    burstGain.connect(masterGain);

    pop.start(now);
    ring.start(now);
    crack.start(now);
    burst.start(now);
    pop.stop(now + 0.1);
    ring.stop(now + 0.13);
    crack.stop(now + 0.07);
    burst.stop(now + 0.17);
  });
}

export function isBackgroundMusicEnabled() {
  return bgMusicEnabled;
}

export function syncBackgroundMusic() {
  const audio = ensureBackgroundMusic();
  if (!bgMusicEnabled) {
    audio.pause();
    return;
  }
  connectBgMusicToWebAudio();
  const playPromise = audio.play();
  if (playPromise?.catch) {
    playPromise.catch(() => {});
  }
}

export function toggleBackgroundMusic() {
  bgMusicEnabled = !bgMusicEnabled;
  syncBackgroundMusic();
  return bgMusicEnabled;
}

export function isSoundEffectsEnabled() {
  return soundEffectsEnabled;
}

export function toggleSoundEffects() {
  soundEffectsEnabled = !soundEffectsEnabled;
  return soundEffectsEnabled;
}

export function setMasterVolume(volume) {
  const vol = Math.max(0, Math.min(1, volume));
  currentVolume = vol;
  if (masterGain) {
    masterGain.gain.value = 1.35 * vol;
  }
  if (sfxGain) {
    sfxGain.gain.value = vol;
  }
  if (bgMusicGain) {
    bgMusicGain.gain.value = vol;
  }
  if (bgMusic) {
    bgMusic.volume = vol;
  }
}
