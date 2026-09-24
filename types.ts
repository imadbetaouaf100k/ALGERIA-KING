export type Language = 'en' | 'ar' | 'fr';
export type Quality = 'Low' | 'Medium' | 'High' | 'Ultra';
export type Weather = 'clear' | 'dust' | 'rain';
export type Outfit = 'olive' | 'sand' | 'midnight';
export type Weapon = 'azru' | 'sirocco';
export type Localized = { en: string; ar: string; fr: string };

export interface JourneyProgress {
  region: number;
  step: number;
  completed: string[];
  visited: number[];
  met: string[];
  evidence: string[];
  souvenirs: string[];
  finished: boolean;
  elapsed: number;
  chaseRemaining: number;
  vehicle?: { position: [number, number, number]; yaw: number; integrity: number; driving: boolean };
  companions?: Record<string, { position: [number, number, number]; trail: number }>;
  trail?: [number, number, number][];
}

export interface ConversationView {
  actor: string;
  speaker: string;
  role: string;
  line: string;
  index: number;
  total: number;
  choices: string[];
  feedback?: string;
}

export interface JourneyMarker {
  id: string;
  type: 'npc' | 'evidence' | 'waypoint' | 'travel' | 'vehicle' | 'relic';
  position: [number, number];
  label: string;
  active: boolean;
}

export interface JourneyView {
  region: number;
  chapter: number;
  title: string;
  location: string;
  objective: string;
  detail: string;
  step: number;
  totalSteps: number;
  completed: string[];
  visited: number[];
  met: string[];
  evidence: string[];
  finished: boolean;
  elapsed: number;
  chaseRemaining: number;
  promptLabel: string;
  markers: JourneyMarker[];
  destination: [number, number] | null;
  distance: number;
  conversation: ConversationView | null;
  driving: boolean;
  speed: number;
  integrity: number;
  companion: string | null;
  checkpoint: string;
}

export interface JourneyTransition { from: number; to: number; kind: 'travel' | 'ending' | 'visit' }
export interface ProgressReward { xp: number; targets?: number; fragments?: number; relics?: number; combo?: number; completion?: boolean }

export interface Settings {
  language: Language;
  quality: Quality;
  sound: number;
  music: number;
  sensitivity: number;
  touchSize: number;
  touchInset: number;
  leftHanded: boolean;
  shake: boolean;
  dayCycle: boolean;
  weather: Weather;
  voices: boolean;
}

export interface Profile {
  xp: number;
  outfit: Outfit;
  backpack: boolean;
  glasses: boolean;
  hair: 'short' | 'cropped';
  weapon: Weapon;
  upgrade: number;
  completions: number;
  targets: number;
  fragments: number;
  relics: number;
  bestCombo: number;
}

export interface SavedRun {
  version?: number;
  journey?: JourneyProgress;
  position: [number, number, number];
  yaw: number;
  health: number;
  score: number;
  xp: number;
  time: number;
  stage: number;
  targets: number[];
  clues: boolean[];
  relics: boolean[];
  enemies: number[];
  ammo: number;
  weapon: Weapon;
  kills: number;
  bestCombo: number;
}

export interface RunResult {
  chapter?: number;
  campaignComplete?: boolean;
  won: boolean;
  score: number;
  xp: number;
  elapsed: number;
  targets: number;
  fragments: number;
  relics: number;
  bestCombo: number;
  kills: number;
}

export interface ScoreEntry extends RunResult {
  id: number;
  date: string;
}

export interface GameSnapshot {
  health: number;
  score: number;
  xp: number;
  time: number;
  stage: number;
  targets: number;
  clues: number;
  relics: number;
  ammo: number;
  capacity: number;
  reloading: boolean;
  weapon: Weapon;
  combo: number;
  hit: number;
  damage: number;
  crouching: boolean;
  swimming: boolean;
  aiming: boolean;
  prompt: 'clue' | 'murad' | 'exit' | 'climb' | null;
  position: [number, number];
  yaw: number;
  enemies: [number, number][];
  collectedClues: boolean[];
  fps: number;
  journey?: JourneyView;
}

export interface GameNotice {
  id: number;
  kind: 'score' | 'mission' | 'dialogue';
  title: string;
  body?: string;
  speaker?: string;
}

export interface GameCallbacks {
  snapshot: (snapshot: GameSnapshot) => void;
  notice: (notice: GameNotice) => void;
  end: (result: RunResult) => void;
  save: (saved: SavedRun) => void;
  pause: () => void;
  transition: (transition: JourneyTransition) => void;
  reward: (reward: ProgressReward) => void;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'ar',
  quality: typeof window !== 'undefined' && window.innerWidth < 800 ? 'Medium' : 'High',
  sound: 65,
  music: 30,
  sensitivity: 50,
  touchSize: 100,
  touchInset: 24,
  leftHanded: false,
  shake: typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  dayCycle: true,
  weather: 'clear',
  voices: true,
};

export const DEFAULT_PROFILE: Profile = {
  xp: 0,
  outfit: 'olive',
  backpack: true,
  glasses: false,
  hair: 'short',
  weapon: 'azru',
  upgrade: 0,
  completions: 0,
  targets: 0,
  fragments: 0,
  relics: 0,
  bestCombo: 0,
};

export const INITIAL_SNAPSHOT: GameSnapshot = {
  health: 100, score: 0, xp: 0, time: 300, stage: 0, targets: 0,
  clues: 0, relics: 0, ammo: 12, capacity: 12, reloading: false,
  weapon: 'azru', combo: 0, hit: 0, damage: 0, crouching: false,
  swimming: false, aiming: false, prompt: null, position: [0, 14],
  yaw: 0, enemies: [], collectedClues: [false, false, false], fps: 60,
};

export function loadLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(`loa:${key}`);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function saveLocal(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(`loa:${key}`);
    else localStorage.setItem(`loa:${key}`, JSON.stringify(value));
  } catch {
    // Private browsing may disable persistent storage; the current session still works.
  }
}

export const levelFor = (xp: number) => Math.min(50, 1 + Math.floor(xp / 800));
export const formatTime = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;