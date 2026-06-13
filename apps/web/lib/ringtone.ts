/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/lib/ringtone.ts
 * Layer:   Web / Audio (ringtones — fully client-side, by design)
 * Purpose: The ring you hear is YOURS — it never needs to touch the server, so it
 *          doesn't. Built-in ringtones are synthesized (no asset to ship/404).
 *          A CUSTOM ringtone is validated IN THE BROWSER and stored in IndexedDB:
 *          we require an audio/* file, cap size + duration, and — critically —
 *          decode it with the Web Audio decoder before it's ever saved. A
 *          mislabelled/malicious file fails to decode and is rejected; a valid
 *          one can only ever affect this one sandboxed tab. No upload endpoint
 *          means no server file-handling attack surface at all.
 *          Public API preserved: `ringtone.start()` / `ringtone.stop()`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

type Ctor = typeof AudioContext;

// ── Single shared AudioContext (created lazily on a user gesture) ─────────────
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctx: Ctor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

// ── Built-in ringtones — synthesized note patterns, looped ───────────────────
interface Note { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number }
interface Pattern { id: string; name: string; notes: Note[]; loopMs: number }

const PATTERNS: Pattern[] = [
  { id: 'classic', name: 'Classic', loopMs: 2600, notes: [
    { freq: 480, at: 0, dur: 0.4 }, { freq: 480, at: 0.5, dur: 0.4 } ] },
  { id: 'pulse', name: 'Pulse', loopMs: 1700, notes: [
    { freq: 620, at: 0, dur: 0.16 }, { freq: 620, at: 0.26, dur: 0.16 }, { freq: 620, at: 0.52, dur: 0.16 } ] },
  { id: 'chime', name: 'Chime', loopMs: 2300, notes: [
    { freq: 880, at: 0, dur: 0.3, type: 'triangle' }, { freq: 1175, at: 0.2, dur: 0.45, type: 'triangle' } ] },
  { id: 'calm', name: 'Calm', loopMs: 2900, notes: [
    { freq: 392, at: 0, dur: 0.55, type: 'sine', gain: 0.1 }, { freq: 523, at: 0.5, dur: 0.7, type: 'sine', gain: 0.1 } ] },
  { id: 'alert', name: 'Alert', loopMs: 1500, notes: [
    { freq: 740, at: 0, dur: 0.12, type: 'square', gain: 0.08 }, { freq: 988, at: 0.16, dur: 0.12, type: 'square', gain: 0.08 } ] },
];

export interface RingtoneOption { id: string; name: string; custom: boolean }

export function builtinRingtones(): RingtoneOption[] {
  return PATTERNS.map((p) => ({ id: p.id, name: p.name, custom: false }));
}

// ── Playback engine ──────────────────────────────────────────────────────────
let loopTimer: number | null = null;
let previewTimer: number | null = null;
let customSource: AudioBufferSourceNode | null = null;
let customBuffer: AudioBuffer | null = null;

function playNotes(p: Pattern): void {
  const a = audio();
  if (!a) return;
  for (const n of p.notes) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;
    const t = a.currentTime + n.at;
    const peak = n.gain ?? 0.14;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
    osc.connect(gain);
    gain.connect(a.destination);
    osc.start(t);
    osc.stop(t + n.dur + 0.02);
  }
}

function startPattern(p: Pattern): void {
  playNotes(p);
  loopTimer = window.setInterval(() => playNotes(p), p.loopMs);
}

function startCustom(buffer: AudioBuffer): void {
  const a = audio();
  if (!a) return;
  const src = a.createBufferSource();
  const gain = a.createGain();
  gain.gain.value = 0.6;
  src.buffer = buffer;
  src.loop = true;
  src.connect(gain);
  gain.connect(a.destination);
  src.start();
  customSource = src;
}

function stopAll(): void {
  if (loopTimer !== null) { window.clearInterval(loopTimer); loopTimer = null; }
  if (previewTimer !== null) { window.clearTimeout(previewTimer); previewTimer = null; }
  if (customSource) {
    try { customSource.stop(); } catch { /* already stopped */ }
    customSource = null;
  }
}

async function playById(id: string): Promise<void> {
  const a = audio();
  if (a) await a.resume().catch(() => undefined);
  if (id === 'custom') {
    const buf = await loadCustomBuffer();
    if (buf) { startCustom(buf); return; }
    // No custom stored / failed to decode → fall back to the default.
  }
  const pattern = PATTERNS.find((p) => p.id === id) ?? PATTERNS[0];
  startPattern(pattern);
}

export const ringtone = {
  /** Play the user's SELECTED ringtone on a loop (incoming / outgoing). */
  start(): void {
    stopAll();
    void playById(getRingtoneId());
  },
  stop(): void {
    stopAll();
  },
};

/** Preview any ringtone (Settings "Test"); auto-stops after a few seconds. */
export function previewRingtone(id: string): void {
  stopAll();
  void playById(id);
  previewTimer = window.setTimeout(stopAll, 5000);
}

export function stopPreview(): void {
  stopAll();
}

// ── Selection + ring duration (local preferences) ────────────────────────────
const SEL_KEY = 'vx.ringtone';
const DUR_KEY = 'vx.ringSeconds';

export function getRingtoneId(): string {
  if (typeof window === 'undefined') return 'classic';
  return window.localStorage.getItem(SEL_KEY) || 'classic';
}
export function setRingtoneId(id: string): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(SEL_KEY, id);
}

/** How long an outgoing call rings before it auto-cancels (10–120s). */
export function getRingSeconds(): number {
  if (typeof window === 'undefined') return 30;
  const n = parseInt(window.localStorage.getItem(DUR_KEY) || '30', 10);
  if (Number.isNaN(n)) return 30;
  return Math.min(120, Math.max(10, n));
}
export function setRingSeconds(n: number): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(DUR_KEY, String(n));
}

// ── Custom ringtone: validate in-browser, store in IndexedDB ──────────────────
const MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
const MAX_SECONDS = 15;
const IDB_NAME = 'vertxing';
const IDB_STORE = 'ringtone';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openIdb();
  const out = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const r = tx.objectStore(IDB_STORE).get(key);
    r.onsuccess = () => resolve((r.result as T) ?? null);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return out;
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

interface CustomRecord { bytes: ArrayBuffer; name: string; duration: number }

export interface CustomRingtoneMeta { name: string; duration: number }

/**
 * Validate a user-chosen file and store it as the custom ringtone. Throws a
 * friendly Error on anything suspicious — wrong type, too big, too long, or not
 * decodable as audio (this is what stops a renamed image / corrupt / malicious
 * file: the Web Audio decoder rejects it, and nothing is stored).
 */
export async function saveCustomRingtone(file: File): Promise<CustomRingtoneMeta> {
  if (!file.type.startsWith('audio/')) {
    throw new Error('Choose an audio file (mp3, wav, ogg, m4a…).');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Audio must be under 1.5 MB.');
  }
  const a = audio();
  if (!a) throw new Error('Audio isn’t supported in this browser.');

  const bytes = await file.arrayBuffer();
  let decoded: AudioBuffer;
  try {
    // decodeAudioData is the gatekeeper: it only succeeds for real, well-formed
    // audio. We decode a COPY so the stored bytes stay intact.
    decoded = await a.decodeAudioData(bytes.slice(0));
  } catch {
    throw new Error('That file isn’t valid audio.');
  }
  if (decoded.duration > MAX_SECONDS) {
    throw new Error(`Ringtone must be ${MAX_SECONDS} seconds or shorter.`);
  }

  await idbSet('custom', { bytes, name: file.name, duration: decoded.duration } satisfies CustomRecord);
  customBuffer = decoded; // cache the decoded buffer for instant playback
  return { name: file.name, duration: decoded.duration };
}

export async function getCustomRingtoneMeta(): Promise<CustomRingtoneMeta | null> {
  const rec = await idbGet<CustomRecord>('custom');
  return rec ? { name: rec.name, duration: rec.duration } : null;
}

export async function clearCustomRingtone(): Promise<void> {
  await idbDelete('custom');
  customBuffer = null;
}

async function loadCustomBuffer(): Promise<AudioBuffer | null> {
  if (customBuffer) return customBuffer;
  const a = audio();
  if (!a) return null;
  const rec = await idbGet<CustomRecord>('custom');
  if (!rec) return null;
  try {
    customBuffer = await a.decodeAudioData(rec.bytes.slice(0));
    return customBuffer;
  } catch {
    return null; // stored bytes somehow unreadable → safe fallback to default
  }
}
