/**
 * The chime that plays when a message arrives.
 *
 * Synthesised with the Web Audio API rather than shipped as an audio file: two
 * short sine tones weigh nothing, need no network request to be ready the
 * first time, and cannot 404. Every browser the app supports has it.
 *
 * Off by default. A page that starts making noise unprompted is worse than one
 * that stays quiet, and browsers block audio until the visitor has interacted
 * with the page anyway — so the preference is opted into deliberately, and the
 * toggle that turns it on doubles as the gesture that unlocks playback.
 */

const STORAGE_KEY = 'chatSoundEnabled';

type Listener = (enabled: boolean) => void;
const listeners = new Set<Listener>();

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    // Private browsing, or storage blocked entirely.
    return false;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // The preference will not survive a reload; honouring it now still helps.
  }
  listeners.forEach(listener => listener(enabled));
  // Turning it on is a click, which is the gesture browsers require before
  // audio may play. Warming the context here means the first real message
  // makes a sound instead of being silently dropped.
  if (enabled) void unlock();
}

/** Subscribe to changes, so a toggle in one place updates one in another. */
export function onSoundPreferenceChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext ?? (window as any).webkitAudioContext ?? null;
}

let context: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  if (!context) {
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  return context;
}

/** Resumes the audio context, which starts suspended until a user gesture. */
async function unlock(): Promise<void> {
  const ctx = ensureContext();
  if (!ctx || ctx.state !== 'suspended') return;
  try {
    await ctx.resume();
  } catch {
    // Still locked; the next gesture will get another chance.
  }
}

/**
 * Two soft notes, a fifth apart. Deliberately quiet and short — this fires
 * while someone is reading, not to summon them from another room.
 */
export function playChime(): void {
  if (!isSoundEnabled()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    // Nothing has been clicked yet this session; a chime here would be
    // dropped by the browser regardless.
    void unlock();
    return;
  }

  const now = ctx.currentTime;
  const notes = [
    { frequency: 880, at: 0 },
    { frequency: 1320, at: 0.11 },
  ];

  for (const note of notes) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = note.frequency;

    const start = now + note.at;
    // A quick fade in and out; a square-edged tone clicks.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.09, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.24);
  }
}

/** What a caller remembers between snapshots. */
export interface ChimeState {
  ids: Set<string>;
  primed: boolean;
}

export function newChimeState(): ChimeState {
  return { ids: new Set<string>(), primed: false };
}

/**
 * Whether this batch of messages deserves a sound — kept separate from making
 * one so the decision can be tested without a browser.
 *
 * Two things must not chime: the conversation a chat opens with, which would
 * otherwise ping once for every message already in it, and anything the
 * current user sent themselves. Mutates `state` to record what it has seen.
 */
export function shouldChime(
  messages: { id?: string; senderId?: string }[],
  currentUserId: string | undefined,
  state: ChimeState
): boolean {
  const incoming = messages.filter(m => m.id && !state.ids.has(m.id));
  for (const message of messages) if (message.id) state.ids.add(message.id);

  // The first snapshot is the existing conversation, not new activity.
  if (!state.primed) {
    state.primed = true;
    return false;
  }
  return incoming.some(m => m.senderId && m.senderId !== currentUserId);
}

/** Chimes for a message somebody else just sent. */
export function chimeForIncoming(
  messages: { id?: string; senderId?: string }[],
  currentUserId: string | undefined,
  seen: React.MutableRefObject<ChimeState>
): void {
  if (shouldChime(messages, currentUserId, seen.current)) playChime();
}
