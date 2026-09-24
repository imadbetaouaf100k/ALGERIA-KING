import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Award, BookOpen, Check, ChevronDown, CirclePlay, Crosshair, Globe2, Keyboard, Map, Maximize, Minimize, MousePointer2, Play, RotateCcw, Settings2, Shield, Shirt, Trophy, Volume2, VolumeX } from 'lucide-react';
import { BrandTitle, LionMark } from './components/Brand';
import Modal from './components/Modal';
import JourneyAtlas, { JourneyJournal } from './components/JourneyAtlas';
import JourneyCinematic from './components/JourneyCinematic';
import { AchievementsPanel, ArmoryPanel, ControlsPanel, HighScores, SettingsPanel, WardrobePanel } from './components/Panels';
import { CAMPAIGN, local, validJourneySave } from './game/campaign';
import { jt } from './game/journeyText';
import { sound } from './game/audio';
import { text, type TranslationKey } from './game/i18n';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, INITIAL_SNAPSHOT, formatTime, levelFor, loadLocal, saveLocal, type GameSnapshot, type JourneyTransition, type Language, type Profile, type ProgressReward, type RunResult, type SavedRun, type ScoreEntry, type Settings } from './game/types';
import type { GameEngine } from './game/engine';

const GameView = lazy(() => import('./components/GameView'));
type Panel = 'map' | 'journal' | 'armory' | 'wardrobe' | 'achievements' | 'settings' | 'controls' | 'confirm';

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...loadLocal<Partial<Settings>>('settings', {}) }));
  const [profile, setProfile] = useState<Profile>(() => ({ ...DEFAULT_PROFILE, ...loadLocal<Partial<Profile>>('profile', {}) }));
  const [saved, setSaved] = useState<SavedRun | null>(() => { const run = loadLocal<unknown>('campaign', null); return validJourneySave(run) ? run : null; });
  const [scores, setScores] = useState<ScoreEntry[]>(() => { const entries = loadLocal<ScoreEntry[]>('scores', []); return Array.isArray(entries) ? entries : []; });
  const [screen, setScreen] = useState<'home' | 'playing'>('home');
  const [panel, setPanel] = useState<Panel | null>(null);
  const [intro, setIntro] = useState(false);
  const [transition, setTransition] = useState<JourneyTransition | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [session, setSession] = useState(0);
  const [runSave, setRunSave] = useState<SavedRun | null>(null);
  const [muted, setMuted] = useState(() => loadLocal('muted', false));
  const [fullscreen, setFullscreen] = useState(false);
  const engine = useRef<GameEngine | null>(null);
  const snapshot = useRef<GameSnapshot>(INITIAL_SNAPSHOT);
  const pendingVisit = useRef<number | null>(null);
  const language = settings.language;
  const t = useCallback((key: TranslationKey) => text(language, key), [language]);
  const j = useCallback((key: Parameters<typeof jt>[1]) => jt(language, key), [language]);
  const currentRegion = CAMPAIGN[saved?.journey?.region ?? 0];

  useEffect(() => { saveLocal('settings', settings); sound.configure(settings, muted); document.documentElement.lang = language; }, [settings, muted, language]);
  useEffect(() => { saveLocal('profile', profile); }, [profile]);
  useEffect(() => { saveLocal('scores', scores); }, [scores]);
  useEffect(() => { saveLocal('muted', muted); sound.setMuted(muted); }, [muted]);
  useEffect(() => { const update = () => setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', update); return () => document.removeEventListener('fullscreenchange', update); }, []);

  useEffect(() => {
    if (panel || intro || transition) return;
    const selector = result ? '.result-content' : paused ? '.pause-content' : null;
    if (!selector) return;
    const overlay = document.querySelector<HTMLElement>(selector); if (!overlay) return;
    const frame = requestAnimationFrame(() => overlay.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }));
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const buttons = overlay.querySelectorAll<HTMLButtonElement>('button:not([disabled])'); if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', trap); };
  }, [panel, intro, transition, result, paused]);

  const start = useCallback((resume = false, cinematic = true) => {
    sound.start(); sound.ui(); sound.stopVoice();
    setRunSave(resume ? saved : null);
    if (!resume) { saveLocal('campaign', null); setSaved(null); }
    snapshot.current = INITIAL_SNAPSHOT;
    setPanel(null); setResult(null); setPaused(false); setTransition(null);
    setSession(value => value + 1); setScreen('playing'); setIntro(!resume && cinematic);
  }, [saved]);
  const begin = useCallback(() => { if (saved) setPanel('confirm'); else start(false); }, [saved, start]);
  const openPanel = useCallback((next: Panel) => { sound.ui(); sound.stopVoice(); setPanel(next); }, []);
  const closePanel = useCallback(() => { sound.ui(); setPanel(null); }, []);
  const pause = useCallback(() => { if (!result && !intro && !transition) setPaused(true); }, [result, intro, transition]);
  const saveRun = useCallback((value: SavedRun) => { setSaved(value); saveLocal('campaign', value); }, []);
  const ready = useCallback((value: GameEngine | null) => {
    engine.current = value;
    if (value && pendingVisit.current !== null) { const target = pendingVisit.current; pendingVisit.current = null; value.visitRegion(target); }
  }, []);
  const updateSnapshot = useCallback((value: GameSnapshot) => { snapshot.current = value; }, []);
  const travel = useCallback((value: JourneyTransition) => { setPanel(null); setPaused(false); setTransition(value); }, []);
  const grantReward = useCallback((reward: ProgressReward) => {
    setProfile(p => ({ ...p, xp: p.xp + reward.xp, targets: p.targets + (reward.targets ?? 0), fragments: p.fragments + (reward.fragments ?? 0), relics: p.relics + (reward.relics ?? 0), bestCombo: Math.max(p.bestCombo, reward.combo ?? 0), completions: p.completions + (reward.completion ? 1 : 0) }));
  }, []);
  const endRun = useCallback((value: RunResult) => {
    setResult(value); setPaused(false); setIntro(false);
    if (value.won) setTransition({ from: 13, to: 13, kind: 'ending' });
    const entry: ScoreEntry = { ...value, id: Date.now(), date: new Date().toISOString() };
    setScores(previous => [...previous, entry].sort((a, b) => b.score - a.score).slice(0, 7));
  }, []);
  const returnHome = useCallback(() => {
    if (engine.current && !result) saveRun(engine.current.getSave());
    setScreen('home'); setPanel(null); setPaused(false); setResult(null); setIntro(false); setTransition(null);
    sound.stopVoice(); sound.vehicle(0, false); sound.setRegion('village'); sound.ui();
  }, [result, saveRun]);
  const finishTransition = useCallback(() => { if (transition?.kind !== 'ending') engine.current?.completeTravel(); setTransition(null); }, [transition]);
  const retry = useCallback(() => { engine.current?.restartCheckpoint(); setPaused(false); setPanel(null); setResult(null); sound.ui(); }, []);
  const explore = useCallback(() => { engine.current?.resumeExploration(); setResult(null); setPaused(false); setTransition(null); sound.ui(); }, []);
  const visit = useCallback((region: number) => {
    setPanel(null); setPaused(false);
    if (screen === 'playing') engine.current?.visitRegion(region);
    else { pendingVisit.current = region; start(true, false); }
  }, [screen, start]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement;
      if (typing && event.code !== 'Escape') return;
      if (event.code === 'Escape') {
        event.preventDefault();
        if (transition) finishTransition();
        else if (intro) setIntro(false);
        else if (panel) closePanel();
        else if (screen === 'playing' && snapshot.current.journey?.conversation) engine.current?.closeDialogue();
        else if (screen === 'playing' && !result) setPaused(value => !value);
      } else if (!panel && !intro && !transition) {
        if (screen === 'playing' && !result && !snapshot.current.journey?.conversation) {
          if (event.code === 'KeyP') setPaused(value => !value);
          if (event.code === 'KeyM') { event.preventDefault(); openPanel('map'); }
          if (event.code === 'KeyJ') { event.preventDefault(); openPanel('journal'); }
          if (event.code === 'KeyH') openPanel('controls');
        } else if (screen === 'home' && event.code === 'Enter' && !(event.target instanceof HTMLElement && event.target.closest('button, a'))) { event.preventDefault(); begin(); }
      }
    };
    window.addEventListener('keydown', keyDown); return () => window.removeEventListener('keydown', keyDown);
  }, [intro, panel, screen, result, transition, finishTransition, closePanel, openPanel, begin]);

  const toggleFullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void document.documentElement.requestFullscreen?.().catch(() => {}); };
  const resumeFromMap = () => { if (screen === 'playing') { setPanel(null); setPaused(false); } else start(Boolean(saved)); };
  const menu = [{ key: 'map', icon: Map }, { key: 'journal', icon: BookOpen }, { key: 'armory', icon: Crosshair }, { key: 'wardrobe', icon: Shirt }, { key: 'achievements', icon: Award }, { key: 'settings', icon: Settings2 }] as const;
  const panelTitle = panel === 'map' ? j('atlas') : panel === 'journal' ? j('journey') : t(panel === 'confirm' ? 'newConfirm' : panel ?? 'home');
  const panelDescription = panel === 'map' ? j('atlasDesc') : panel === 'journal' ? j('journalDesc') : panel === 'armory' ? t('armoryDescription') : panel === 'wardrobe' ? t('wardrobeDescription') : panel === 'controls' ? t('controlsDescription') : undefined;

  return <MotionConfig reducedMotion="user"><div className={`app journey-edition ${language === 'ar' ? 'arabic-ui' : ''}`} onPointerDownCapture={() => sound.start()}>
    <AnimatePresence mode="wait">
      {screen === 'home' ? <motion.div className="home-screen" key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
        <div className="home-background"><img src="/images/village-journey.jpg" alt="Yassine returns to an Algerian village of olive trees, farms and mountain paths." fetchPriority="high" /><div className="home-shade" /></div>
        <div className="film-grain" /><div className="ambient-dust" aria-hidden="true">{Array.from({ length: 13 }, (_, i) => <span key={i} style={{ left: `${26 + i * 5.8}%`, top: `${12 + i * 17 % 74}%`, animationDelay: `${i * -1.9}s`, animationDuration: `${18 + i % 5 * 3}s` }} />)}</div>
        <header className="home-header">
          <a className="studio-mark" href="#" onClick={e => { e.preventDefault(); setPanel(null); }} aria-label="Lions of Algeria home"><LionMark size={42} /><span>LIONS OF ALGERIA<small>AN ATLAS ORIGINAL</small></span></a>
          <div className="header-actions"><div className="edition-label"><span />{j('campaign')}</div><div className="header-divider" /><label className="language-picker"><Globe2 size={15} strokeWidth={1.5} /><select value={language} onChange={e => setSettings(p => ({ ...p, language: e.target.value as Language }))} aria-label={t('language')}><option value="en">EN</option><option value="ar">AR</option><option value="fr">FR</option></select><ChevronDown size={10} /></label><button className="icon-button" onClick={() => setMuted(value => !value)} aria-label={muted ? 'Enable audio' : 'Mute audio'} aria-pressed={!muted}>{muted ? <VolumeX size={18} strokeWidth={1.5} /> : <Volume2 size={18} strokeWidth={1.5} />}</button><button className="icon-button fullscreen-button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}</button></div>
        </header>
        <main className="home-main">
          <motion.div className="hero-brand" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08 }}><div className="hero-eyebrow"><span />{t('adventure')}</div><BrandTitle /><p className="hero-tagline" dir={language === 'ar' ? 'rtl' : 'ltr'}>{j('subtitle')}</p></motion.div>
          <motion.nav className="main-menu" aria-label="Main menu" dir={language === 'ar' ? 'rtl' : 'ltr'} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <button className="start-button" onClick={begin}><Play size={18} strokeWidth={1.6} /><span>{j('begin')}</span><ArrowRight size={20} strokeWidth={1.4} /></button>
            <button className="menu-button continue-button" onClick={() => start(true, false)} disabled={!saved}><RotateCcw size={17} strokeWidth={1.4} /><span>{t('continue')}</span><small>{saved?.journey?.finished ? j('freeExplore') : saved ? `${String(currentRegion.chapter).padStart(2, '0')} / ${local(currentRegion.place, language)}` : t('noSave')}</small>{saved && <ArrowUpRight size={13} />}</button>
            <div className="menu-divider" />{menu.map(item => <button className={`menu-button menu-${item.key}`} key={item.key} onClick={() => openPanel(item.key)}><item.icon size={18} strokeWidth={1.4} /><span>{item.key === 'journal' ? j('journey') : item.key === 'map' ? j('atlas') : t(item.key)}</span><ArrowUpRight className="menu-arrow" size={15} strokeWidth={1.3} /></button>)}
          </motion.nav>
          <motion.button className="how-to-play text-button" onClick={() => openPanel('controls')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}><Keyboard size={15} strokeWidth={1.3} />{t('controls')}<span className="tiny-dot" /><span>WASD / TOUCH</span></motion.button>
        </main>
        <footer className="home-footer"><div className="footer-key-hints"><span><kbd>ENTER</kbd>{j('begin')}</span><span><MousePointer2 size={12} />{t('navigate')}</span></div><div className="footer-motto">{t('footer')}</div><button className="prologue-button" onClick={() => { sound.ui(); setIntro(true); }}><span>{t('prologue')}</span><CirclePlay size={25} strokeWidth={1} /></button></footer>
      </motion.div> : <motion.div className="play-screen" key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
        <Suspense fallback={<div className="game-loading"><LionMark size={58} /><h2>{t('loading')}</h2><span className="loading-spinner" /></div>}>
          <GameView settings={settings} profile={profile} saved={runSave} session={session} paused={paused || Boolean(panel) || intro || Boolean(transition) || Boolean(result)} onPause={pause} onMap={() => openPanel('map')} onJournal={() => openPanel('journal')} onHelp={() => openPanel('controls')} onTransition={travel} onReward={grantReward} onEnd={endRun} onSave={saveRun} onReady={ready} onSnapshot={updateSnapshot} onExit={returnHome} />
        </Suspense>
      </motion.div>}
    </AnimatePresence>

    <AnimatePresence>
      {paused && screen === 'playing' && !result && !intro && !transition && <motion.div className="pause-backdrop" key="pause" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="pause-content" role="dialog" aria-modal="true" aria-label={t('pause')} dir={language === 'ar' ? 'rtl' : 'ltr'} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <LionMark size={53} /><span className="eyebrow">{local(currentRegion.place, language)}</span><h2>{t('paused')}</h2><p>{t('pauseDescription')}</p>
          <div className="pause-menu"><button className="gold-button" onClick={() => { setPaused(false); sound.ui(); }}><Play size={16} />{t('resume')}<ArrowRight size={17} /></button><button className="menu-button" onClick={() => openPanel('map')}><Map size={18} />{j('atlas')}<kbd>M</kbd></button><button className="menu-button" onClick={() => openPanel('journal')}><BookOpen size={18} />{j('journey')}<kbd>J</kbd></button><button className="menu-button" onClick={() => openPanel('settings')}><Settings2 size={18} />{t('settings')}</button><button className="menu-button" onClick={() => openPanel('controls')}><Keyboard size={18} />{t('controls')}</button><div className="menu-divider" /><button className="menu-button" onClick={retry}><RotateCcw size={17} />{j('retry')}</button><button className="menu-button" onClick={returnHome}><ArrowUpRight size={17} />{t('exit')}</button></div>
          <span className="pause-chapter">{j('chapter')} {String(currentRegion.chapter).padStart(2, '0')} / 12 <i /> {j('day')} {currentRegion.day}</span>
        </motion.div>
      </motion.div>}
      {result && screen === 'playing' && <motion.div className={`result-backdrop ${result.won ? 'won' : 'lost'}`} key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.section className="result-content" role="dialog" aria-modal="true" aria-label={result.won ? j('freeExploreTitle') : j('recover')} dir={language === 'ar' ? 'rtl' : 'ltr'} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
          <div className="result-mark">{result.won ? <LionMark size={64} /> : <Shield size={48} strokeWidth={1} />}</div><span className="eyebrow">{result.won ? j('done') : t('overEyebrow')}</span><h2>{result.won ? j('freeExploreTitle') : j('recover')}</h2><p>{result.won ? j('freeExploreDetail') : j('lossDetail')}</p>
          <div className="result-score"><span>{scores[0]?.score === result.score ? <><Trophy size={13} />{t('best')}</> : t('score')}</span><strong>{result.score.toLocaleString()}</strong></div>
          <div className="result-stats"><div><strong>{result.fragments}</strong><span>{j('cluesFound')}</span></div><div><strong>{formatTime(result.elapsed)}</strong><span>{j('journeyTime')}</span></div><div><strong>{result.won ? 12 : Math.max(0, (result.chapter ?? 1) - 1)}<small> / 12</small></strong><span>{j('chapterCount')}</span></div></div>
          <div className="result-actions"><button className="gold-button" onClick={result.won ? explore : retry}>{result.won ? <Map size={17} /> : <RotateCcw size={17} />}{j(result.won ? 'freeExplore' : 'retry')}<ArrowRight size={17} /></button><button className="text-button" onClick={returnHome}>{t('mainMenu')}<ArrowUpRight size={15} /></button></div>
          <div className="result-records"><div className="eyebrow">{t('highScores')}<span>{t('level')} {levelFor(profile.xp)}</span></div><HighScores language={language} scores={scores} compact /></div>
        </motion.section>
      </motion.div>}
      {panel && <Modal key={panel} title={panelTitle} description={panelDescription} language={language} onClose={closePanel} className={panel === 'confirm' ? 'confirm-modal' : `panel-${panel}`}>
        {panel === 'map' && <JourneyAtlas language={language} progress={saved?.journey} snapshot={screen === 'playing' ? snapshot.current : undefined} inGame={screen === 'playing'} onPlay={resumeFromMap} onVisit={visit} />}
        {panel === 'journal' && <JourneyJournal language={language} progress={saved?.journey} />}
        {panel === 'settings' && <SettingsPanel settings={settings} onChange={setSettings} />}
        {panel === 'controls' && <ControlsPanel language={language} />}
        {panel === 'wardrobe' && <WardrobePanel language={language} profile={profile} onChange={setProfile} />}
        {panel === 'armory' && <ArmoryPanel language={language} profile={profile} onChange={setProfile} />}
        {panel === 'achievements' && <AchievementsPanel language={language} profile={profile} scores={scores} />}
        {panel === 'confirm' && <div className="confirm-content"><p>{j('newConfirm')}</p><button className="gold-button" onClick={() => start(false)}>{t('startFresh')}<ArrowRight size={17} /></button><button className="text-button" onClick={closePanel}>{t('cancel')}<Check size={15} /></button></div>}
      </Modal>}
      {intro && <JourneyCinematic key="intro" language={language} mode="arrival" onDone={() => setIntro(false)} onEnter={() => { setIntro(false); if (screen === 'home') { if (saved) setPanel('confirm'); else start(false, false); } }} />}
      {transition && <JourneyCinematic key={`${transition.kind}-${transition.to}`} language={language} mode={transition.kind === 'ending' ? 'ending' : 'travel'} from={transition.from} to={transition.to} onDone={finishTransition} />}
    </AnimatePresence>
  </div></MotionConfig>;
}