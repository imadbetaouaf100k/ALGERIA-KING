import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Award, ChevronDown, CirclePlay, Crosshair, Globe2, Keyboard, Map, Maximize, Minimize, Play, RotateCcw, Settings2, Shield, Shirt, SkipForward, Trophy, Volume2, VolumeX } from 'lucide-react';
import { BrandTitle, LionMark } from './components/Brand';
import Modal from './components/Modal';
import JourneyAtlas from './components/JourneyAtlas';
import JourneyCinematic from './components/JourneyCinematic';
import { AchievementsPanel, ArmoryPanel, ControlsPanel, HighScores, SettingsPanel, WardrobePanel } from './components/Panels';
import { CAMPAIGN, local, validJourneySave } from './game/campaign';
import { jt } from './game/journeyText';
import { sound } from './game/audio';
import { text, type TranslationKey } from './game/i18n';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, INITIAL_SNAPSHOT, formatTime, loadLocal, saveLocal, type GameSnapshot, type JourneyTransition, type Language, type Profile, type ProgressReward, type RunResult, type SavedRun, type ScoreEntry, type Settings } from './game/types';
import type { GameEngine } from './game/engine';

const GameView = lazy(() => import('./components/GameView'));
type Panel = 'map' | 'armory' | 'wardrobe' | 'achievements' | 'settings' | 'controls' | 'confirm';

function Cinematic({ language, onDone }: { language: Language; onDone: () => void }) {
  const [scene, setScene] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const iv = setInterval(() => setScene(p => Math.min(p + 1, 3)), 1200);
    const tm = setTimeout(() => doneRef.current(), 5000);
    return () => { clearInterval(iv); clearTimeout(tm); };
  }, []);
  const caps = language === 'ar' ? ['هذه أرضك.', 'الحقيقة تنتظر خلف المألوف.', 'وبعض الظلال تمتد عبر وطن.', 'رحلتك تبدأ الآن.']
    : language === 'fr' ? ['Ici, chez vous.', 'La verite attend au-dela.', 'Certaines ombres traversent un pays.', 'Votre voyage commence.']
    : ['This is home.', 'The truth waits beyond.', 'Some shadows reach across a nation.', 'Your journey begins.'];
  return (
    <motion.div className="cinematic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <img src="/images/village-journey.jpg" alt="" className={scene === 0 ? 'visible' : ''} />
      <img src="/images/atlas-mountains.jpg" alt="" className={scene === 1 ? 'visible' : ''} />
      <img src="/images/sahara-dunes.jpg" alt="" className={scene === 2 ? 'visible' : ''} />
      <div className="cinematic-shade" />
      <div className="cinematic-letterbox top" /><div className="cinematic-letterbox bottom" />
      <AnimatePresence mode="wait">
        <motion.div key={scene} className="cinematic-caption" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {scene === 3 && <><LionMark size={58} /><BrandTitle compact /></>}
          <p dir={language === 'ar' ? 'rtl' : 'ltr'}>{caps[scene]}</p>
        </motion.div>
      </AnimatePresence>
      <div className="cinematic-progress">{[0,1,2,3].map(i => <span key={i} className={scene >= i ? 'active' : ''} />)}</div>
      <button className="cinematic-skip text-button" onClick={onDone}>{text(language, 'skip')}<SkipForward size={16} /></button>
    </motion.div>
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...loadLocal<Partial<Settings>>('settings', {}) }));
  const [profile, setProfile] = useState<Profile>(() => ({ ...DEFAULT_PROFILE, ...loadLocal<Partial<Profile>>('profile', {}) }));
  const [saved, setSaved] = useState<SavedRun | null>(() => {
    const run = loadLocal<unknown>('campaign', null);
    return validJourneySave(run) ? run as SavedRun : null;
  });
  const [scores, setScores] = useState<ScoreEntry[]>(() => {
    const loaded = loadLocal<ScoreEntry[]>('scores', []);
    return Array.isArray(loaded) ? loaded : [];
  });
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
  const language = settings.language;
  const t = useCallback((key: TranslationKey) => text(language, key), [language]);
  const j = useCallback((key: Parameters<typeof jt>[1]) => jt(language, key), [language]);
  const currentRegion = CAMPAIGN[saved?.journey?.region ?? 0];

  // Persist settings
  useEffect(() => { saveLocal('settings', settings); sound.configure(settings, muted); document.documentElement.lang = language; }, [settings, muted, language]);
  useEffect(() => { saveLocal('profile', profile); }, [profile]);
  useEffect(() => { saveLocal('scores', scores); }, [scores]);
  useEffect(() => { saveLocal('muted', muted); sound.setMuted(muted); }, [muted]);
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  // Start game
  const start = useCallback((resume = false, cinematic = true) => {
    sound.start(); sound.ui(); sound.stopVoice();
    setRunSave(resume ? saved : null);
    if (!resume) { saveLocal('campaign', null); setSaved(null); }
    snapshot.current = INITIAL_SNAPSHOT;
    setPanel(null); setResult(null); setPaused(false); setTransition(null);
    setSession(v => v + 1); setScreen('playing'); setIntro(!resume && cinematic);
  }, [saved]);

  const begin = useCallback(() => { if (saved) setPanel('confirm'); else start(false); }, [saved, start]);
  const openPanel = useCallback((p: Panel) => { sound.ui(); setPanel(p); }, []);
  const closePanel = useCallback(() => { sound.ui(); setPanel(null); }, []);

  // Save/Load
  const saveRun = useCallback((value: SavedRun) => { setSaved(value); saveLocal('campaign', value); }, []);
  const ready = useCallback((value: GameEngine | null) => { engine.current = value; }, []);
  const updateSnapshot = useCallback((value: GameSnapshot) => { snapshot.current = value; }, []);
  const travel = useCallback((value: JourneyTransition) => { setPanel(null); setPaused(false); setTransition(value); }, []);
  const grantReward = useCallback((reward: ProgressReward) => {
    setProfile(p => ({
      ...p, xp: p.xp + reward.xp,
      targets: p.targets + (reward.targets ?? 0), fragments: p.fragments + (reward.fragments ?? 0),
      relics: p.relics + (reward.relics ?? 0), bestCombo: Math.max(p.bestCombo, reward.combo ?? 0),
      completions: p.completions + (reward.completion ? 1 : 0),
    }));
  }, []);

  const endRun = useCallback((value: RunResult) => {
    setResult(value); setPaused(false); setIntro(false);
    if (value.won) setTransition({ from: 13, to: 13, kind: 'ending' });
    const entry: ScoreEntry = { ...value, id: Date.now(), date: new Date().toISOString() };
    setScores(prev => [...prev, entry].sort((a, b) => b.score - a.score).slice(0, 7));
  }, []);

  const returnHome = useCallback(() => {
    if (engine.current && !result) saveRun(engine.current.getSave());
    setScreen('home'); setPanel(null); setPaused(false); setResult(null); setIntro(false); setTransition(null);
    sound.stopVoice(); sound.vehicle(0, false); sound.ui();
  }, [result, saveRun]);

  const finishTransition = useCallback(() => { engine.current?.completeTravel(); setTransition(null); }, []);
  const retry = useCallback(() => { engine.current?.restartCheckpoint(); setPaused(false); setPanel(null); setResult(null); sound.ui(); }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement;
      if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && e.code !== 'Escape') return;
      
      if (e.code === 'Escape') {
        e.preventDefault();
        if (transition) finishTransition();
        else if (intro) setIntro(false);
        else if (panel) closePanel();
        else if (screen === 'playing' && !result) setPaused(v => !v);
      } else if (!panel && !intro && !transition) {
        if (screen === 'playing' && !result) {
          if (e.code === 'KeyP') setPaused(v => !v);
          if (e.code === 'KeyM') { e.preventDefault(); openPanel('map'); }
          if (e.code === 'KeyH') openPanel('controls');
        } else if (screen === 'home' && e.code === 'Enter' && !(target instanceof HTMLElement && target.closest('button,a'))) {
          e.preventDefault(); begin();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [intro, panel, screen, result, transition, finishTransition, closePanel, openPanel, begin]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  const menu = [
    { key: 'map', icon: Map }, { key: 'armory', icon: Crosshair }, { key: 'wardrobe', icon: Shirt },
    { key: 'achievements', icon: Award }, { key: 'settings', icon: Settings2 },
  ] as const;

  return (
    <div className={`app ${language === 'ar' ? 'arabic-ui' : ''}`} onPointerDownCapture={() => sound.start()}>
      <AnimatePresence mode="wait">
        {screen === 'home' ? (
          <motion.div className="home-screen" key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="home-background">
              <img src="/images/village-journey.jpg" alt="Yassine overlooks the sunlit rooftops" fetchPriority="high" />
              <div className="home-shade" />
            </div>
            <div className="film-grain" />

            <header className="home-header">
              <div className="studio-mark">
                <LionMark size={42} />
                <span>LIONS OF ALGERIA<small>AN ORIGINAL ADVENTURE</small></span>
              </div>
              <div className="header-actions">
                <div className="edition-label"><span />{t('prototype')}</div>
                <label className="language-picker">
                  <Globe2 size={15} />
                  <select value={language} onChange={e => setSettings(p => ({ ...p, language: e.target.value as Language }))}>
                    <option value="en">EN</option><option value="ar">AR</option><option value="fr">FR</option>
                  </select>
                  <ChevronDown size={10} />
                </label>
                <button className="icon-button" onClick={() => setMuted(v => !v)}>
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <button className="icon-button fullscreen-button" onClick={toggleFullscreen}>
                  {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                </button>
              </div>
            </header>

            <main className="home-main">
              <div className="hero-brand">
                <div className="hero-eyebrow"><span />{t('adventure')}</div>
                <BrandTitle />
                <p className="hero-tagline">{j('subtitle')}</p>
              </div>

              <nav className="main-menu">
                <button className="start-button" onClick={begin}>
                  <Play size={18} /><span>{t('newGame')}</span><ArrowRight size={20} />
                </button>
                <button className="menu-button continue-button" onClick={() => start(true, false)} disabled={!saved}>
                  <RotateCcw size={17} /><span>{t('continue')}</span>
                  <small>{saved ? local(currentRegion.place, language) : t('noSave')}</small>
                </button>
                <div className="menu-divider" />
                {menu.map(item => (
                  <button key={item.key} className={`menu-button menu-${item.key}`} onClick={() => openPanel(item.key)}>
                    <item.icon size={18} /><span>{t(item.key as TranslationKey)}</span>
                    <ArrowUpRight className="menu-arrow" size={15} />
                  </button>
                ))}
              </nav>
            </main>

            <footer className="home-footer">
              <div className="footer-motto">{t('footer')}</div>
              <button className="prologue-button" onClick={() => { sound.ui(); setIntro(true); }}>
                <span>{t('prologue')}</span><CirclePlay size={25} />
              </button>
            </footer>
          </motion.div>
        ) : (
          <motion.div className="play-screen" key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Suspense fallback={<div className="game-loading"><LionMark size={58} /><h2>{t('loading')}</h2></div>}>
              <GameView
                settings={settings} profile={profile} saved={runSave} session={session}
                paused={paused || Boolean(panel) || intro || Boolean(transition) || Boolean(result)}
                onPause={() => setPaused(true)} onMap={() => openPanel('map')} onJournal={() => openPanel('map')} onHelp={() => openPanel('controls')}
                onTransition={travel} onReward={grantReward} onEnd={endRun} onSave={saveRun}
                onReady={ready} onSnapshot={updateSnapshot} onExit={returnHome}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause overlay */}
      <AnimatePresence>
        {paused && screen === 'playing' && !result && !transition && (
          <motion.div className="pause-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="pause-content" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
              <LionMark size={53} /><h2>{t('paused')}</h2><p>{t('pauseDescription')}</p>
              <div className="pause-menu">
                <button className="gold-button" onClick={() => { setPaused(false); sound.ui(); }}>
                  <Play size={16} />{t('resume')}<ArrowRight size={17} />
                </button>
                <button className="menu-button" onClick={() => openPanel('settings')}><Settings2 size={18} />{t('settings')}</button>
                <button className="menu-button" onClick={() => openPanel('controls')}><Keyboard size={18} />{t('controls')}</button>
                <button className="menu-button" onClick={retry}><RotateCcw size={17} />{t('restart')}</button>
                <button className="menu-button" onClick={returnHome}><ArrowUpRight size={17} />{t('exit')}</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Result screen */}
        {result && screen === 'playing' && (
          <motion.div className={`result-backdrop ${result.won ? 'won' : 'lost'}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="result-content" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              <div className="result-mark">{result.won ? <LionMark size={64} /> : <Shield size={48} />}</div>
              <span className="eyebrow">{result.won ? t('completeEyebrow') : t('overEyebrow')}</span>
              <h2>{result.won ? t('missionComplete') : t('gameOver')}</h2>
              <p>{result.won ? t('completeDescription') : t('overDescription')}</p>
              <div className="result-score">
                <span>{scores[0]?.score === result.score ? <><Trophy size={13} />{t('best')}</> : t('score')}</span>
                <strong>{result.score.toLocaleString()}</strong>
              </div>
              <div className="result-stats">
                <div><strong>+{result.xp}</strong><span>{t('earned')}</span></div>
                <div><strong>{formatTime(result.elapsed)}</strong><span>{t('elapsed')}</span></div>
                <div><strong>{result.kills}</strong><span>{t('accuracy')}</span></div>
              </div>
              <div className="result-actions">
                <button className="gold-button" onClick={retry}>
                  <RotateCcw size={17} />{t('playAgain')}<ArrowRight size={17} />
                </button>
                <button className="text-button" onClick={returnHome}>{t('mainMenu')}</button>
              </div>
              <HighScores language={language} scores={scores} compact />
            </motion.section>
          </motion.div>
        )}

        {/* Modals */}
        {panel && (
          <Modal key={panel} title={t(panel === 'confirm' ? 'newConfirm' : panel)} language={language} onClose={closePanel}>
            {panel === 'map' && <JourneyAtlas language={language} inGame={screen === 'playing'} onPlay={() => { setPanel(null); setPaused(false); }} onVisit={() => {}} />}
            {panel === 'settings' && <SettingsPanel settings={settings} onChange={setSettings} />}
            {panel === 'controls' && <ControlsPanel language={language} />}
            {panel === 'wardrobe' && <WardrobePanel language={language} profile={profile} onChange={setProfile} />}
            {panel === 'armory' && <ArmoryPanel language={language} profile={profile} onChange={setProfile} />}
            {panel === 'achievements' && <AchievementsPanel language={language} profile={profile} scores={scores} />}
            {panel === 'confirm' && (
              <div className="confirm-content">
                <p>{t('newConfirmDetail')}</p>
                <button className="gold-button" onClick={() => start(false)}>{t('startFresh')}<ArrowRight size={17} /></button>
                <button className="text-button" onClick={closePanel}>{t('cancel')}</button>
              </div>
            )}
          </Modal>
        )}

        {/* Cinematic intro */}
        {intro && <Cinematic key="intro" language={language} onDone={() => setIntro(false)} />}

        {/* Region transition */}
        {transition && (
          <JourneyCinematic
            key={`travel-${transition.to}`}
            language={language}
            from={transition.from}
            to={transition.to}
            mode={transition.kind === 'ending' ? 'ending' : 'travel'}
            onDone={finishTransition}
          />
        )}
      </AnimatePresence>
    </div>
  );
}