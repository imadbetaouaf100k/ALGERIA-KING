import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownToLine, ArrowUp, ArrowUpRight, BookOpen, CarFront, Check, ChevronUp, CircleHelp, Crosshair, Footprints, Hand, Heart, Map, Navigation, Pause, Radio, RefreshCw, Repeat2, Shield, Target, Timer, Users, Zap } from 'lucide-react';
import { LionMark } from './Brand';
import { LocalMap } from './JourneyAtlas';
import Conversation from './Conversation';
import { jt } from '../game/journeyText';
import { text, type TranslationKey } from '../game/i18n';
import { INITIAL_SNAPSHOT, formatTime, levelFor, type GameNotice, type GameSnapshot, type JourneyTransition, type Profile, type ProgressReward, type RunResult, type SavedRun, type Settings } from '../game/types';
import type { GameAction, GameEngine } from '../game/engine';

interface GameViewProps {
  settings: Settings;
  profile: Profile;
  saved: SavedRun | null;
  session: number;
  paused: boolean;
  onPause: () => void;
  onMap: () => void;
  onJournal: () => void;
  onTransition: (value: JourneyTransition) => void;
  onReward: (reward: ProgressReward) => void;
  onHelp: () => void;
  onEnd: (result: RunResult) => void;
  onSave: (saved: SavedRun) => void;
  onReady: (engine: GameEngine | null) => void;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onExit: () => void;
}

function TouchButton({ label, children, action, held, engine, className = '', disabled = false }: { label: string; children: ReactNode; action?: GameAction; held?: 'aim' | 'fire' | 'brake'; engine: React.RefObject<GameEngine | null>; className?: string; disabled?: boolean }) {
  const release = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (held) engine.current?.hold(held, false);
  };
  return <button className={`touch-action ${className}`} disabled={disabled} aria-label={label} onPointerDown={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); if (held) engine.current?.hold(held, true); else if (action) engine.current?.action(action); }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>{children}<span>{label}</span></button>;
}

function TouchControls({ engine, settings, driving = false }: { engine: React.RefObject<GameEngine | null>; settings: Settings; driving?: boolean }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);
  const stick = useRef<HTMLDivElement>(null);
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId || !stick.current) return;
    const rect = stick.current.getBoundingClientRect();
    const radius = rect.width * 0.34;
    let dx = event.clientX - rect.left - rect.width / 2;
    let dy = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) { dx *= radius / distance; dy *= radius / distance; }
    setKnob({ x: dx / (settings.touchSize / 100), y: dy / (settings.touchSize / 100) });
    engine.current?.setJoystick(dx / radius, dy / radius);
  };
  const release = () => { pointer.current = null; setKnob({ x: 0, y: 0 }); engine.current?.setJoystick(0, 0); };
  const t = (key: TranslationKey) => text(settings.language, key);
  return <div className={`touch-controls ${settings.leftHanded ? 'left-handed' : ''}`} style={{ '--touch-scale': settings.touchSize / 100, '--touch-inset': `${settings.touchInset}px` } as CSSProperties}>
    <div className="touch-stick" ref={stick} onPointerDown={e => { e.preventDefault(); if (pointer.current !== null) return; pointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); }} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} role="group" aria-label={t('move')}><span className="stick-direction top" /><span className="stick-direction bottom" /><span className="stick-direction left" /><span className="stick-direction right" /><div className="stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} /><small>{t('move')}</small></div>
    <div className="touch-actions"><TouchButton engine={engine} held="aim" label={t('aim')} disabled={driving}><Target size={22} /></TouchButton><TouchButton engine={engine} held="fire" label={t('fire')} className="touch-fire" disabled={driving}><Crosshair size={32} /></TouchButton><TouchButton engine={engine} action={driving ? undefined : 'jump'} held={driving ? 'brake' : undefined} label={driving ? jt(settings.language, 'brake') : t('jump')}>{driving ? <ArrowDownToLine size={23} /> : <ArrowUp size={23} />}</TouchButton><TouchButton engine={engine} action="crouch" label={t('crouch')} disabled={driving}><ArrowDownToLine size={20} /></TouchButton><TouchButton engine={engine} action="interact" label={t('interact')} className="touch-interact"><Hand size={22} /></TouchButton><TouchButton engine={engine} action="switch" label={t('switch')} disabled={driving}><Repeat2 size={19} /></TouchButton><TouchButton engine={engine} action="reload" label={t('reload')} className="touch-reload" disabled={driving}><RefreshCw size={17} /></TouchButton></div>
  </div>;
}

export default function GameView(props: GameViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<GameEngine | null>(null);
  const currentProps = useRef(props);
  currentProps.current = props;
  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notices, setNotices] = useState<Partial<Record<GameNotice['kind'], GameNotice>>>({});
  const timers = useRef<Partial<Record<GameNotice['kind'], ReturnType<typeof setTimeout>>>>({});
  const { settings, profile, paused } = props;
  const t = (key: TranslationKey) => text(settings.language, key);

  const showNotice = useCallback((notice: GameNotice) => {
    if (timers.current[notice.kind]) clearTimeout(timers.current[notice.kind]);
    setNotices(prev => ({ ...prev, [notice.kind]: notice }));
    timers.current[notice.kind] = setTimeout(() => setNotices(prev => ({ ...prev, [notice.kind]: undefined })), notice.kind === 'dialogue' ? 6700 : notice.kind === 'score' ? 2200 : 4500);
  }, []);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(false);
    setNotices({});
    setSnapshot(INITIAL_SNAPSHOT);
    import('../game/engine').then(({ GameEngine }) => {
      if (canceled || !container.current) return;
      try {
        const p = currentProps.current;
        const game = new GameEngine(container.current, p.settings, p.profile, {
          snapshot: value => { if (!canceled) { setSnapshot(value); currentProps.current.onSnapshot(value); } },
          notice: showNotice,
          end: result => currentProps.current.onEnd(result),
          save: saved => currentProps.current.onSave(saved),
          pause: () => currentProps.current.onPause(),
          transition: value => currentProps.current.onTransition(value),
          reward: reward => currentProps.current.onReward(reward),
        }, p.saved);
        engine.current = game;
        game.setPaused(p.paused);
        p.onReady(game);
        setLoading(false);
      } catch (cause) {
        console.error('Unable to initialize the 3D prototype:', cause);
        setError(true);
        setLoading(false);
      }
    }).catch(() => { if (!canceled) { setError(true); setLoading(false); } });
    return () => {
      canceled = true;
      engine.current?.dispose();
      engine.current = null;
      currentProps.current.onReady(null);
      Object.values(timers.current).forEach(timer => { if (timer) clearTimeout(timer); });
    };
  }, [props.session, showNotice]);

  useEffect(() => { engine.current?.setPaused(paused); }, [paused]);
  useEffect(() => { engine.current?.configure(settings); }, [settings]);
  useEffect(() => { setNotices({}); }, [snapshot.journey?.region]);

  const journey = snapshot.journey;
  const completed = journey?.step ?? 0;
  const talking = Boolean(journey?.conversation);
  const chase = (journey?.chaseRemaining ?? 0) > 0;
  const direction = journey?.destination ? Math.atan2(journey.destination[0] - snapshot.position[0], -(journey.destination[1] - snapshot.position[1])) + snapshot.yaw - Math.PI / 4 : 0;

  return <div className={`game-view journey-game ${talking ? 'is-conversing' : ''}`}>
    <div ref={container} className="game-canvas" />
    {loading && <div className="game-loading"><LionMark size={65} /><span className="eyebrow">{jt(settings.language, 'campaign')}</span><h2>{t('loading')}</h2><div className="loading-track"><span /></div><p>{t('previewNotice')}</p></div>}
    {error && <div className="game-loading error-state"><Shield size={45} strokeWidth={1} /><h2>{t('unavailable')}</h2><p>{t('unavailableDetail')}</p><button className="gold-button" onClick={props.onExit}>{t('mainMenu')}<ArrowUpRight size={17} /></button></div>}
    {!loading && !error && <>
      <div className="game-vignette" />
      <div className="damage-vignette" style={{ opacity: snapshot.damage }} />
      <div className={`game-hud ${paused ? 'hud-paused' : ''} ${talking ? 'hud-conversation' : ''}`} dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="hud-top-left"><div className="hud-location"><LionMark size={32} /><div><span>{journey?.location}</span><strong>{journey?.title}</strong></div></div><div className="hud-objective"><div className="objective-eyebrow"><span className="objective-diamond" />{jt(settings.language, 'chapter')} {String(journey?.chapter ?? 1).padStart(2, '0')}<span>{jt(settings.language, 'campaign')}</span></div><h3>{journey?.objective}</h3><p>{journey?.detail}</p>{!journey?.finished && <div className="objective-progress">{Array.from({ length: journey?.totalSteps ?? 7 }, (_, i) => <span className={i < completed ? 'complete' : ''} key={i}>{i < completed && <Check size={9} />}</span>)}<small>{completed} / {journey?.totalSteps}</small></div>}{journey?.destination && <div className="journey-destination"><Navigation size={15} style={{ transform: `rotate(${direction}rad)` }} /><span>{journey.distance} {jt(settings.language, 'distance')}</span>{chase && <small>{jt(settings.language, 'sprint')}</small>}</div>}</div>{journey?.companion && <div className="companion-indicator"><Users size={13} /><span>{jt(settings.language, 'companion')}<strong>{journey.companion}</strong></span></div>}</div>
        <div className="hud-compass"><span>W</span><i /><i /><i /><strong>N</strong><i /><i /><i /><span>E</span><div><ChevronUp size={13} /></div></div>
        <div className="hud-top-right"><div className="score-display"><span>{t('score')}</span><strong>{snapshot.score.toLocaleString().padStart(5, '0')}</strong></div><div className={`timer-display ${chase ? 'chase-timer' : ''} ${chase && snapshot.time < 25 ? 'urgent' : ''}`} title={jt(settings.language, 'journeyTime')}><Timer size={14} /><span>{formatTime(snapshot.time)}</span></div><button className="hud-icon journal-game" onClick={props.onJournal} aria-label={jt(settings.language, 'journey')}><BookOpen size={18} /></button><button className="hud-icon" onClick={props.onHelp} aria-label={t('controls')}><CircleHelp size={18} /></button><button className="hud-icon pause-game" onClick={props.onPause} aria-label={t('pause')}><Pause size={18} /></button></div>
        {!journey?.driving && <div className={`crosshair ${snapshot.aiming ? 'is-aiming' : ''}`}><i /><i /><i /><i /><span /><div className="hit-cross" style={{ opacity: snapshot.hit }}><span /><span /></div></div>}
        {snapshot.combo > 1 && <div className="combo-display"><Zap size={13} /><span>{snapshot.combo}<small>x</small></span>{t('combo')}</div>}
        <div className="hud-bottom-left"><button className="minimap-shell" onClick={props.onMap} aria-label={t('map')}><LocalMap snapshot={snapshot} compact /><span className="minimap-north">N</span><span className="minimap-key">M</span></button><div className="vitality"><div><Heart size={12} /><span>{t('health')}</span><strong>{snapshot.health}</strong></div><div className="health-track"><span className={snapshot.health < 35 ? 'low' : ''} style={{ width: `${snapshot.health}%` }} /></div><div className="hud-level"><span>{t('level')} {String(levelFor(profile.xp)).padStart(2, '0')}</span><small>+{snapshot.xp} XP</small></div><div className="hud-xp-track"><span style={{ width: `${profile.xp % 800 / 8}%` }} /></div></div></div>
        <div className="hud-bottom-right">{journey?.driving ? <><div className="weapon-hud-name"><span>ASFAR</span><CarFront size={23} strokeWidth={1} /></div><div className="ammo-display speed-display"><strong>{journey.speed}</strong><span>km/h</span></div><div className="vehicle-integrity"><span style={{ width: `${journey.integrity}%` }} /></div><div className="equipment-hint"><kbd>SPACE</kbd>{jt(settings.language, 'brake')}</div></> : <><div className="weapon-hud-name"><span>{snapshot.weapon === 'azru' ? 'AZRU' : 'SIROCCO'}</span><Zap size={19} strokeWidth={1} /></div><div className={`ammo-display ${snapshot.reloading ? 'is-reloading' : ''}`}><strong>{String(snapshot.ammo).padStart(2, '0')}</strong><span>/ {String(snapshot.capacity).padStart(2, '0')}</span></div><button className="reload-button" onClick={() => engine.current?.action('reload')}><kbd>R</kbd>{t(snapshot.reloading ? 'reloading' : 'reload')}</button><div className="equipment-hint"><kbd>Q</kbd>{t('switch')}</div></>}</div>
        {(snapshot.crouching || snapshot.swimming) && <div className="stance-indicator">{snapshot.swimming ? <Footprints size={13} /> : <Shield size={13} />}{t(snapshot.swimming ? 'swimming' : 'cover')}</div>}
        <AnimatePresence>
          {snapshot.prompt && !paused && !talking && <motion.button className={`interact-prompt ${journey?.driving ? 'driving-prompt' : ''}`} key={journey?.promptLabel} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={() => engine.current?.action('interact')}><kbd>E</kbd><span>{journey?.promptLabel}</span>{journey?.driving ? <CarFront size={17} /> : <Hand size={17} />}</motion.button>}
          {notices.score && <motion.div key={`score-${notices.score.id}`} className="score-notice" initial={{ opacity: 0, y: 14, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15 }}><span>{notices.score.title}</span><strong>{notices.score.body}</strong></motion.div>}
          {notices.mission && <motion.div key={`mission-${notices.mission.id}`} className="mission-notice" initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><div><Check size={19} /></div><span><strong>{notices.mission.title}</strong><small>{notices.mission.body}</small></span></motion.div>}
          {notices.dialogue && !talking && <motion.div key={`dialogue-${notices.dialogue.id}`} className="dialogue-notice" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><Radio size={20} strokeWidth={1.3} /><div><span>{notices.dialogue.speaker}<i /></span><p>{notices.dialogue.body}</p></div><button aria-label={t('close')} onClick={() => setNotices(prev => ({ ...prev, dialogue: undefined }))}>x</button></motion.div>}
        </AnimatePresence>
        <div className="desktop-controls"><span><kbd>W A S D</kbd>{t('move')}</span><span><kbd>RMB</kbd>{t('look')}</span><span><kbd>SPACE</kbd>{journey?.driving ? jt(settings.language, 'brake') : t('jump')}</span><span><kbd>E</kbd>{t('interact')}</span><button onClick={props.onMap}><Map size={13} />{t('map')}</button><button onClick={props.onJournal}><kbd>J</kbd>{jt(settings.language, 'journey')}</button></div>
        <TouchControls engine={engine} settings={settings} driving={journey?.driving} />
        <div className="game-build-label">LOA / JOURNEY 0.2 <span>{settings.quality.toUpperCase()}</span></div>
        {journey?.checkpoint && <div className="journey-save-indicator"><Check size={11} />{journey.checkpoint}</div>}
      </div>
      <AnimatePresence>{journey?.conversation && !paused && <Conversation key={journey.conversation.actor} conversation={journey.conversation} language={settings.language} onNext={() => engine.current?.advanceDialogue()} onChoice={index => engine.current?.chooseDialogue(index)} onClose={() => engine.current?.closeDialogue()} />}</AnimatePresence>
    </>}
  </div>;
}