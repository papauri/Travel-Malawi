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
    const val = localStorage.getItem(STORAGE_KEY);
    // Notification sound is enabled by default unless user explicitly muted it ('false')
    return val !== 'false';
  } catch {
    // Private browsing, or storage blocked entirely.
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // The preference will not survive a reload; honouring it now still helps.
  }
  listeners.forEach(listener => listener(enabled));

  // Warming the context here ensures immediate playback
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
export async function unlock(): Promise<void> {
  const ctx = ensureContext();
  if (!ctx || ctx.state !== 'suspended') return;
  try {
    await ctx.resume();
  } catch {
    // Still locked; the next gesture will get another chance.
  }
}

// Auto-warm and unlock audio on the very first user interaction anywhere on the window
if (typeof window !== 'undefined') {
  const unlockEvents = ['click', 'touchstart', 'keydown', 'pointerdown'];
  const onFirstInteraction = () => {
    void unlock();
    unlockEvents.forEach(evt => window.removeEventListener(evt, onFirstInteraction));
  };
  unlockEvents.forEach(evt => window.addEventListener(evt, onFirstInteraction, { passive: true, once: true }));
}

/**
 * Plays a vibrant, crystal-clear concierge bell "DING!" notification chime.
 * Synthesized using harmonic overtones resembling a physical brass counter bell.
 */
export function playDingSound(volume = 0.22): void {
  if (!isSoundEnabled()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void unlock();
    return;
  }

  const now = ctx.currentTime;

  // Harmonic layers of a bright crystal desk bell (fundamental strike + crystalline ring overtones)
  const bellPartials = [
    { freq: 1174.66, gain: volume * 0.9, decay: 0.85, type: 'sine' as OscillatorType },    // Fundamental strike (D6)
    { freq: 2349.32, gain: volume * 0.55, decay: 0.55, type: 'sine' as OscillatorType },   // 1st harmonic (D7)
    { freq: 3520.00, gain: volume * 0.30, decay: 0.35, type: 'triangle' as OscillatorType }, // Sparkle shimmer (A7)
    { freq: 4698.64, gain: volume * 0.12, decay: 0.20, type: 'sine' as OscillatorType },   // High ping transient (D8)
  ];

  for (const partial of bellPartials) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = partial.type;
    osc.frequency.setValueAtTime(partial.freq, now);

    // Instant attack for crisp strike, followed by exponential ring-down
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(partial.gain, now + 0.003);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + partial.decay);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + partial.decay + 0.05);
  }
}

/** Legacy alias for playDingSound */
export function playChime(): void {
  playDingSound();
}

let activeRinger: number | NodeJS.Timeout | null = null;

export function startRinging(): void {
  if (!isSoundEnabled()) return;
  if (activeRinger) return; // already ringing

  const ring = () => {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void unlock();
    }
    const now = ctx.currentTime;
    const notes = [
      { frequency: 440, at: 0 },
      { frequency: 480, at: 0.1 },
      { frequency: 440, at: 0.2 },
      { frequency: 480, at: 0.3 }
    ];
    for (const note of notes) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = note.frequency;
      const start = now + note.at;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    }
  };
  
  ring();
  activeRinger = setInterval(ring, 2000);
}

export function stopRinging(): void {
  if (activeRinger) {
    clearInterval(activeRinger);
    activeRinger = null;
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

/** Chimes for a message somebody else just sent, only when not already actively looking at the open foreground tab. */
export function chimeForIncoming(
  messages: { id?: string; senderId?: string; text?: string; content?: string }[],
  currentUserId: string | undefined,
  seen: React.MutableRefObject<ChimeState>
): void {
  // If the user is actively viewing this tab with the chat open, no notification noise needed
  if (typeof document !== 'undefined' && !document.hidden && document.hasFocus?.()) {
    if (messages.length > 0) {
      for (const message of messages) if (message.id) seen.current.ids.add(message.id);
      seen.current.primed = true;
    }
    return;
  }

  const incoming = messages.filter(m => m.id && !seen.current.ids.has(m.id));
  if (shouldChime(messages, currentUserId, seen.current)) {
    playChime();
    
    if ('Notification' in window && Notification.permission === 'granted') {
      const otherMsgs = incoming.filter(m => m.senderId && m.senderId !== currentUserId);
      if (otherMsgs.length > 0) {
        const text = otherMsgs[otherMsgs.length - 1].text || otherMsgs[otherMsgs.length - 1].content || 'You have a new message.';
        new Notification('New Message', { body: text });
      }
    }
  }
}
