/**
 * High-Fidelity Notification Audio Engine using Web Audio API & HTML5 Audio Fallback
 * Works across desktop browsers, mobile devices, and standalone installed PWAs.
 */

let globalAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass();
    }
  }
  return globalAudioCtx;
}

/**
 * Unlocks AudioContext on user interaction to comply with browser Autoplay policies.
 */
export function unlockAudioContext(): void {
  if (isAudioUnlocked) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().then(() => {
      isAudioUnlocked = true;
    }).catch(() => {});
  } else {
    isAudioUnlocked = true;
  }
}

// Auto-register unlock listeners
if (typeof window !== 'undefined') {
  const unlockEvents = ['click', 'touchstart', 'keydown', 'mousedown'];
  const handleFirstInteraction = () => {
    unlockAudioContext();
    unlockEvents.forEach((evt) => window.removeEventListener(evt, handleFirstInteraction));
  };
  unlockEvents.forEach((evt) => window.addEventListener(evt, handleFirstInteraction, { passive: true }));
}

export interface CustomSoundPreference {
  name: string;
  dataUrl: string;
  updatedAt: number;
}

const CUSTOM_SOUND_KEY = 'cruvels_custom_notification_sound';

/**
 * Retrieves the user's custom notification audio preference if configured.
 */
export function getCustomSound(): CustomSoundPreference | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CUSTOM_SOUND_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CustomSoundPreference;
  } catch {
    return null;
  }
}

/**
 * Saves a user's uploaded custom audio chime.
 */
export function setCustomSound(name: string, dataUrl: string): void {
  if (typeof window === 'undefined') return;
  try {
    const pref: CustomSoundPreference = {
      name,
      dataUrl,
      updatedAt: Date.now(),
    };
    localStorage.setItem(CUSTOM_SOUND_KEY, JSON.stringify(pref));
  } catch (err) {
    console.warn('[CUSTOM SOUND SAVE FAILED]', err);
  }
}

/**
 * Removes the custom sound preference, restoring standard synthesized chime.
 */
export function removeCustomSound(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CUSTOM_SOUND_KEY);
  } catch {}
}

/**
 * Plays a specific audio data URL directly (useful for previewing).
 */
export async function playCustomAudioUrl(dataUrl: string): Promise<boolean> {
  if (typeof window === 'undefined' || !dataUrl) return false;
  try {
    const audio = new Audio(dataUrl);
    audio.volume = 0.85;
    await audio.play();
    return true;
  } catch (err) {
    console.warn('[CUSTOM AUDIO PLAYBACK FAILED]', err);
    return false;
  }
}

/**
 * Plays either the user's custom audio file or a modern dual-tone synthesized alert chime.
 * Tone 1: 587.33 Hz (D5) -> Tone 2: 880 Hz (A5) with smooth exponential decay.
 */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return;

  // 1. Try playing custom audio if set
  const custom = getCustomSound();
  if (custom && custom.dataUrl) {
    try {
      const audio = new Audio(custom.dataUrl);
      audio.volume = 0.85;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[CUSTOM AUDIO PLAY BLOCKED/FAILED, FALLING BACK TO SYNTH]', err);
          playSynthesizedChime();
        });
      }
    } catch {
      playSynthesizedChime();
    }
  } else {
    playSynthesizedChime();
  }

  // Device vibration pattern for mobile / installed app
  if ('navigator' in window && navigator.vibrate) {
    try {
      navigator.vibrate([150, 80, 150]);
    } catch {}
  }
}

/**
 * Internal Web Audio API synthesized workplace alert chime.
 */
export function playSynthesizedChime(): void {
  if (typeof window === 'undefined') return;

  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Tone 1: Warm chime tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.55);

      // Tone 2: Harmonic sparkle overtone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1174.66, now + 0.08); // D6
      osc2.frequency.exponentialRampToValueAtTime(1760.0, now + 0.18); // A6

      gain2.gain.setValueAtTime(0.001, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.18, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.08);
      osc2.stop(now + 0.65);
    }
  } catch (err) {
    console.warn('[AUDIO CHIME ERROR]', err);
  }
}
