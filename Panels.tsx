import { lazy, Suspense, useId, useState } from 'react';
import { ArrowRight, Award, Check, ChevronRight, CircleHelp, Crosshair, Gem, Globe2, Headphones, Keyboard, LockKeyhole, Monitor, Mouse, Move, RotateCcw, Shield, SlidersHorizontal, Sparkles, Sun, Trophy, Volume2, Waves, Zap } from 'lucide-react';
import { text, type TranslationKey } from '../game/i18n';
import { jt } from '../game/journeyText';
import { DEFAULT_SETTINGS, formatTime, levelFor, type Language, type Outfit, type Profile, type ScoreEntry, type Settings, type Weapon } from '../game/types';

const CharacterPreview = lazy(() => import('./CharacterPreview'));

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle-switch ${checked ? 'checked' : ''}`} onClick={() => onChange(!checked)}><span /></button>;
}

function Range({ label, value, min = 0, max = 100, suffix = '%', onChange }: { label: string; value: number; min?: number; max?: number; suffix?: string; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="range-control"><div><label htmlFor={id}>{label}</label><output htmlFor={id}>{value}{suffix}</output></div><input id={id} type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} style={{ '--range-value': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties} /></div>;
}

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (settings: Settings) => void }) {
  const [tab, setTab] = useState<'graphics' | 'audio' | 'input' | 'language'>('graphics');
  const t = (key: TranslationKey) => text(settings.language, key);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  const tabs = [{ key: 'graphics', icon: Monitor }, { key: 'audio', icon: Headphones }, { key: 'input', icon: SlidersHorizontal }, { key: 'language', icon: Globe2 }] as const;
  return <div className="settings-layout">
    <nav className="settings-nav" aria-label={t('settings')}>{tabs.map(item => <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><item.icon size={18} /><span>{t(item.key)}</span><ChevronRight size={14} /></button>)}</nav>
    <div className="settings-body">
      {tab === 'graphics' && <section><div className="section-heading"><Sun size={20} /><h3>{t('graphics')}</h3></div>
        <label className="setting-label">{t('quality')}</label>
        <div className="segmented-control quality-options">{(['Low', 'Medium', 'High', 'Ultra'] as const).map(quality => <button key={quality} className={settings.quality === quality ? 'active' : ''} onClick={() => update('quality', quality)} aria-pressed={settings.quality === quality}>{quality}</button>)}</div>
        <p className="field-hint">{settings.language === 'ar' ? 'دقة تكيفية للحفاظ على سلاسة اللعب. الجودة المنخفضة تعطل الظلال.' : settings.language === 'fr' ? 'Resolution adaptative pour un jeu fluide. Le mode Low desactive les ombres.' : 'Adaptive resolution keeps the action fluid. Low quality turns off shadows.'}</p>
        <div className="setting-row"><span>{t('dayCycle')}</span><Switch label={t('dayCycle')} checked={settings.dayCycle} onChange={v => update('dayCycle', v)} /></div>
        <div className="setting-row"><label htmlFor="weather-select">{t('weather')}</label><select id="weather-select" value={settings.weather} onChange={e => update('weather', e.target.value as Settings['weather'])}><option value="clear">{jt(settings.language, 'regionalWeather')}</option><option value="dust">{t('dust')}</option><option value="rain">{t('rain')}</option></select></div><p className="field-hint">{jt(settings.language, 'nightNote')}</p>
      </section>}
      {tab === 'audio' && <section><div className="section-heading"><Volume2 size={20} /><h3>{t('audio')}</h3></div><Range label={t('volume')} value={settings.sound} onChange={v => update('sound', v)} /><Range label={t('music')} value={settings.music} onChange={v => update('music', v)} /><div className="setting-row"><span>{jt(settings.language, 'voices')}</span><Switch label={jt(settings.language, 'voices')} checked={settings.voices} onChange={v => update('voices', v)} /></div><p className="field-hint">{jt(settings.language, 'voiceNote')}</p><p className="field-hint sound-note"><Waves size={24} />{settings.language === 'ar' ? 'موسيقى وأصوات أصلية تتغير بين القرية والجبال والصحراء والموانئ والأنهار، وتُولّد مباشرة في متصفحك.' : settings.language === 'fr' ? 'Des ambiances originales, synthétisées dans le navigateur, pour les villages, montagnes, déserts, ports et rivières.' : 'Original browser-synthesized soundscapes for villages, mountains, dunes, harbors and rivers.'}</p></section>}
      {tab === 'input' && <section><div className="section-heading"><SlidersHorizontal size={20} /><h3>{t('input')}</h3></div><Range label={t('sensitivity')} value={settings.sensitivity} min={10} max={100} onChange={v => update('sensitivity', v)} /><Range label={t('touchSize')} value={settings.touchSize} min={70} max={140} onChange={v => update('touchSize', v)} /><Range label={t('touchInset')} value={settings.touchInset} min={12} max={72} suffix=" px" onChange={v => update('touchInset', v)} /><div className="setting-row"><span>{t('handed')}</span><Switch label={t('handed')} checked={settings.leftHanded} onChange={v => update('leftHanded', v)} /></div><div className="setting-row"><span>{t('shake')}</span><Switch label={t('shake')} checked={settings.shake} onChange={v => update('shake', v)} /></div></section>}
      {tab === 'language' && <section><div className="section-heading"><Globe2 size={20} /><h3>{t('language')}</h3></div><div className="language-options">{[{ value: 'en', label: 'English', sub: 'English' }, { value: 'ar', label: 'العربية', sub: 'Arabic' }, { value: 'fr', label: 'Français', sub: 'French' }].map(item => <button className={settings.language === item.value ? 'selected' : ''} key={item.value} onClick={() => update('language', item.value as Language)}><span><strong lang={item.value}>{item.label}</strong><small>{item.sub}</small></span>{settings.language === item.value ? <Check size={18} /> : <span className="radio-empty" />}</button>)}</div></section>}
      <div className="settings-save"><p><Check size={13} />{t('savedAutomatically')}</p><button className="text-button" onClick={() => onChange({ ...DEFAULT_SETTINGS, language: settings.language })}><RotateCcw size={13} />{t('reset')}</button></div>
    </div>
  </div>;
}

export function ControlsPanel({ language }: { language: Language }) {
  const [tab, setTab] = useState<'keyboard' | 'touch'>(() => window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard');
  const t = (key: TranslationKey) => text(language, key);
  const controls = [
    { action: t('move'), keys: ['W', 'A', 'S', 'D'], description: t('movementHelp') },
    { action: t('look'), keys: ['RMB'], description: t('lookHelp') },
    { action: t('fire'), keys: ['LMB', 'F'] }, { action: t('sprint'), keys: ['SHIFT'] },
    { action: t('jump'), keys: ['SPACE'] }, { action: t('crouch'), keys: ['C'] },
    { action: t('interact'), keys: ['E'] }, { action: t('reload'), keys: ['R'] },
    { action: t('switch'), keys: ['Q'] }, { action: t('map'), keys: ['M'] }, { action: jt(language, 'journey'), keys: ['J'] }, { action: jt(language, 'enterVehicle'), keys: ['E'] }, { action: jt(language, 'brake'), keys: ['SPACE'] }, { action: t('pause'), keys: ['ESC', 'P'] },
  ];
  return <div className="controls-panel"><div className="panel-tabs"><button className={tab === 'keyboard' ? 'active' : ''} onClick={() => setTab('keyboard')}><Keyboard size={17} />{t('keyboard')}</button><button className={tab === 'touch' ? 'active' : ''} onClick={() => setTab('touch')}><Move size={17} />{t('touch')}</button></div>
    {tab === 'keyboard' ? <div className="controls-grid">{controls.map(item => <div className="control-row" key={item.action}><span>{item.action}{item.description && <small>{item.description}</small>}</span><div>{item.keys.map(key => <kbd key={key}>{key}</kbd>)}</div></div>)}</div> : <div className="touch-instructions"><div className="touch-diagram"><div className="diagram-stick"><span /><i /></div><div className="diagram-look"><Move size={30} strokeWidth={1} /><span>{t('look')}</span></div><div className="diagram-actions"><span><Crosshair size={27} /></span><span>{t('jump')}</span><span>{t('interact')}</span></div></div><p>{t('touchHelp')}</p><p className="field-hint">{t('touchSize')} / {t('touchInset')} / {t('handed')}: {t('settings')}</p></div>}
    <div className="play-goal"><div><CompassIcon /><h3>{t('ready')}</h3></div><p>{jt(language, 'goal')}</p></div><p className="controls-tip"><span>{t('tip')}</span>{t('tipBody')}</p>
  </div>;
}

function CompassIcon() { return <CircleHelp size={19} strokeWidth={1.4} />; }

export function WardrobePanel({ language, profile, onChange }: { language: Language; profile: Profile; onChange: (profile: Profile) => void }) {
  const [outfit, setOutfit] = useState<Outfit>(profile.outfit);
  const t = (key: TranslationKey) => text(language, key);
  const preview = { ...profile, outfit };
  return <div className="wardrobe-layout">
    <div className="character-stage"><div className="preview-index">CHARACTER / 01</div><Suspense fallback={<div className="preview-loading"><span className="loading-spinner" /></div>}><CharacterPreview profile={preview} /></Suspense><div className="character-caption"><span>YASSINE</span><small>{t('level')} {String(levelFor(profile.xp)).padStart(2, '0')}</small></div><div className="rotate-hint"><Mouse size={12} />{t('look')}</div></div>
    <div className="wardrobe-options"><div className="eyebrow">PERSONAL EQUIPMENT</div><h3>{t('outfit')}</h3><div className="outfit-choices">{([{ key: 'olive', color: '#71806a' }, { key: 'sand', color: '#bca27a' }, { key: 'midnight', color: '#4e6c80' }] as const).map(item => <button key={item.key} className={outfit === item.key ? 'selected' : ''} onClick={() => setOutfit(item.key)} aria-pressed={outfit === item.key}><span className="outfit-swatch" style={{ background: item.color }}>{outfit === item.key && <Check size={20} />}</span><span>{t(item.key)}</span>{profile.outfit === item.key && <small>{t('equipped')}</small>}</button>)}</div>
      <h4>{t('accessories')}</h4><div className="setting-row"><span>{t('backpack')}</span><Switch label={t('backpack')} checked={profile.backpack} onChange={backpack => onChange({ ...profile, backpack })} /></div><div className="setting-row"><span>{t('glasses')}</span><Switch label={t('glasses')} checked={profile.glasses} onChange={glasses => onChange({ ...profile, glasses })} /></div><div className="setting-row"><span>{t('hair')}</span><div className="segmented-control small">{(['short', 'cropped'] as const).map(hair => <button key={hair} className={profile.hair === hair ? 'active' : ''} onClick={() => onChange({ ...profile, hair })}>{t(hair)}</button>)}</div></div><button className="gold-button" disabled={outfit === profile.outfit} onClick={() => onChange({ ...profile, outfit })}>{t(outfit === profile.outfit ? 'equipped' : 'equip')}{outfit === profile.outfit ? <Check size={17} /> : <ArrowRight size={17} />}</button>
    </div>
  </div>;
}

export function WeaponArt({ weapon }: { weapon: Weapon }) {
  return <svg viewBox="0 0 620 290" className={`weapon-art ${weapon}`} role="img" aria-label={weapon === 'azru' ? 'Original Azru non-lethal pulse caster design' : 'Original Sirocco sonic resonator design'}>
    <defs><linearGradient id="weapon-brass" x1="0" x2=".4" y2="1"><stop stopColor="#d1b983" /><stop offset=".5" stopColor="#8c784e" /><stop offset="1" stopColor="#b39a68" /></linearGradient><linearGradient id="weapon-body" x2=".3" y2="1"><stop stopColor="#54645c" /><stop offset="1" stopColor="#27382f" /></linearGradient><filter id="weapon-glow"><feGaussianBlur stdDeviation="4" /></filter></defs>
    <g stroke="#8d9d7a" strokeWidth=".55" opacity=".2"><path d="M44 150H580M313 30V263M84 61H542V243H84ZM42 59h13m-7-7v14M565 247h13m-7-7v14" /><circle cx="313" cy="150" r="108" /><circle cx="313" cy="150" r="117" strokeDasharray="3 7" /></g>
    <ellipse cx="307" cy="243" rx="154" ry="9" fill="#000" opacity=".23" />
    <g transform={weapon === 'sirocco' ? 'translate(-12,8) scale(1.03)' : undefined}>
      <path d="m144 125 25-22h187l23 12 94 7 12 15-10 28-85 2-39 16-53-4-58-7-25 55h-56l15-72-30-10Z" fill="url(#weapon-body)" stroke="#778575" strokeWidth="1.5" />
      <path d="m170 106 40-18 114 1 29 16" fill="#303f36" stroke="#9b9b7b" /><path d="M181 106h147" stroke="#c1b081" strokeWidth="4" />
      <path d="m243 171-14 44-15 5 8-49" fill="#1e3029" stroke="#62715f" /><path d="m178 164-11 49 28 3 14-47" fill="#746648" stroke="#98815c" />
      <path d="m252 120 73-1 8 12-3 31h-77Z" fill="#1d3029" stroke="#92977a" />
      <path d="M258 124h58v31h-58Z" fill="#518775" opacity=".45" /><path d="M261 125v29m12-29v29m12-29v29m12-29v29m12-29v29" stroke="#9cd4b6" strokeWidth="5" className="weapon-core" />
      <path d="M261 125v29m12-29v29m12-29v29m12-29v29m12-29v29" stroke="#bce9c0" strokeWidth="7" filter="url(#weapon-glow)" opacity=".5" />
      <path d="m347 116 28-3 11 12-2 40-32 6Z" fill="url(#weapon-brass)" stroke="#c6b281" /><path d="m412 120 32 2 6 44-39 1Z" fill="url(#weapon-brass)" stroke="#c6b281" />
      <path d="M376 128h40m-38 25h34" stroke="#a5ac8f" strokeWidth="6" /><path d="m466 126 20 3-3 26-14 5Z" fill="#28483e" stroke="#a1baa0" /><path d="m479 130-2 21" stroke="#a4d9b8" strokeWidth="5" />
      <path d="m147 126 30-3 21 30-40-7Z" fill="#77724f" stroke="#b3a97a" /><path d="M179 185h20m-22 6h20m-22 6h20m-22 6h20" stroke="#2e3d31" strokeWidth="3" />
      <path d="M337 109V92h25v15M275 90V76h15v14" stroke="#8d987c" strokeWidth="4" fill="none" />
      {[183, 227, 342, 366, 428, 456].map((x, i) => <circle key={x} cx={x} cy={i % 2 ? 158 : 119} r="2.7" fill="#d5c391" />)}
      {weapon === 'sirocco' && <g><path d="M384 115v-8h58v15m-53 46v11h57v-14" stroke="#b99f71" strokeWidth="6" fill="none" /><path d="M493 125h17v34h-24" fill="#718270" stroke="#a4b79d" /><path d="M497 129v26" stroke="#c7dcbc" strokeWidth="6" /></g>}
    </g>
    <g fontFamily="Barlow Condensed, sans-serif" fontSize="8" letterSpacing="2" fill="#8e9e83"><text x="65" y="39">{weapon === 'azru' ? 'AZRU / MK.I' : 'SIROCCO / MK.I'}</text><text x="433" y="258">NON-LETHAL / ORIGINAL</text><path d="m287 122-8-70H198m242 107 61 45h42" stroke="#a7a889" strokeWidth=".5" fill="none" /></g>
  </svg>;
}

export function ArmoryPanel({ language, profile, onChange }: { language: Language; profile: Profile; onChange: (profile: Profile) => void }) {
  const [weapon, setWeapon] = useState<Weapon>(profile.weapon);
  const t = (key: TranslationKey) => text(language, key);
  const required = (profile.upgrade + 1) * 1200;
  const canUpgrade = profile.xp >= required && profile.upgrade < 3;
  return <div className="armory-panel"><div className="panel-tabs">{(['azru', 'sirocco'] as const).map((w, i) => <button className={weapon === w ? 'active' : ''} key={w} onClick={() => setWeapon(w)}><span className="tab-index">0{i + 1}</span>{t(w === 'azru' ? 'pulse' : 'scatter')}{w === profile.weapon && <Check size={13} />}</button>)}</div><div className="armory-layout"><div className="weapon-stage"><div className="preview-index">MURAD'S WORKSHOP / ORIGINAL DESIGN</div><WeaponArt weapon={weapon} /><div className="weapon-serial">AZ / {weapon === 'azru' ? '001' : '002'}<span>{t('tier')} {String(profile.upgrade + 1).padStart(2, '0')}</span></div></div><div className="weapon-detail"><div className="eyebrow">{t('current')}</div><h3>{t(weapon === 'azru' ? 'pulse' : 'scatter')}</h3><p>{t(weapon === 'azru' ? 'pulseDescription' : 'scatterDescription')}</p><div className="weapon-stats">{[{ label: 'power', value: (weapon === 'azru' ? 3 : 6) + profile.upgrade }, { label: 'handling', value: weapon === 'azru' ? 8 : 5 }, { label: 'capacity', value: weapon === 'azru' ? 8 : 4 }].map(stat => <div key={stat.label}><span>{t(stat.label as TranslationKey)}</span><div>{Array.from({ length: 10 }, (_, i) => <i className={i < stat.value ? 'filled' : ''} key={i} />)}</div></div>)}</div><button className="gold-button" disabled={weapon === profile.weapon} onClick={() => onChange({ ...profile, weapon })}>{t(weapon === profile.weapon ? 'equipped' : 'choose')}{weapon === profile.weapon ? <Check size={17} /> : <ArrowRight size={17} />}</button></div></div><div className="upgrade-row"><div><Zap size={22} /><span><strong>{t('upgrade')}</strong><small>{t('upgradeDetail')}</small></span></div><button className="outline-button" disabled={!canUpgrade} onClick={() => { if (canUpgrade) onChange({ ...profile, upgrade: profile.upgrade + 1 }); }}>{profile.upgrade >= 3 ? <><Check size={14} />{t('maxed')}</> : <>{!canUpgrade && <LockKeyhole size={13} />}{required.toLocaleString()} XP<ArrowRight size={14} /></>}</button></div></div>;
}

export function HighScores({ language, scores, compact = false }: { language: Language; scores: ScoreEntry[]; compact?: boolean }) {
  const t = (key: TranslationKey) => text(language, key);
  if (!scores.length) return <div className="empty-records"><Trophy size={37} strokeWidth={1} /><h3>{t('noScores')}</h3><p>{t('noScoresDetail')}</p></div>;
  return <div className={`high-scores ${compact ? 'compact' : ''}`}><table><thead><tr><th>{t('rank')}</th><th>{t('you')}</th><th>{t('score')}</th>{!compact && <th>{t('date')}</th>}<th>{t('result')}</th></tr></thead><tbody>{scores.slice(0, compact ? 3 : 7).map((entry, i) => <tr key={entry.id} className={i === 0 ? 'top-score' : ''}><td>{i === 0 ? <Trophy size={16} /> : String(i + 1).padStart(2, '0')}</td><td>{t('you')}<small>{formatTime(entry.elapsed)}</small></td><td className="record-score">{entry.score.toLocaleString()}</td>{!compact && <td>{new Date(entry.date).toLocaleDateString(language, { month: 'short', day: 'numeric' })}</td>}<td><span className={entry.won ? 'teal' : 'muted'}>{entry.won ? <Check size={13} /> : <RotateCcw size={12} />}{!compact && t(entry.won ? 'completed' : 'interrupted')}</span></td></tr>)}</tbody></table><div className="records-note"><Shield size={12} />{language === 'ar' ? 'محفوظ على هذا الجهاز فقط' : language === 'fr' ? 'Sauvegarde sur cet appareil uniquement' : 'Stored on this device. Your own little hall of fame.'}</div></div>;
}

export function AchievementsPanel({ language, profile, scores }: { language: Language; profile: Profile; scores: ScoreEntry[] }) {
  const [tab, setTab] = useState<'milestones' | 'highScores'>('milestones');
  const t = (key: TranslationKey) => text(language, key);
  const achievements = [
    { name: 'firstSteps', detail: 'firstStepsDetail', icon: Award, progress: profile.completions, goal: 1 },
    { name: 'steadyHand', detail: 'steadyHandDetail', icon: Crosshair, progress: profile.targets, goal: 3 },
    { name: 'truthSeeker', detail: 'truthSeekerDetail', icon: Sparkles, progress: profile.fragments, goal: 3 },
    { name: 'collector', detail: 'collectorDetail', icon: Gem, progress: profile.relics, goal: 5 },
    { name: 'untouchable', detail: 'untouchableDetail', icon: Zap, progress: profile.bestCombo, goal: 3 },
    { name: 'risingLion', detail: 'risingLionDetail', icon: Shield, progress: levelFor(profile.xp), goal: 5 },
  ];
  const unlocked = achievements.filter(a => a.progress >= a.goal).length;
  return <div><div className="panel-tabs">{(['milestones', 'highScores'] as const).map(key => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{key === 'milestones' ? <Award size={17} /> : <Trophy size={17} />}{t(key)}{key === 'milestones' && <span className="tab-count">{unlocked} / 6</span>}</button>)}</div>{tab === 'milestones' ? <><div className="progression-header"><div className="level-emblem">{String(levelFor(profile.xp)).padStart(2, '0')}</div><div><span className="eyebrow">{t('risingLion')}</span><h3>{t('level')} {levelFor(profile.xp)}</h3><div className="xp-track"><span style={{ width: `${profile.xp % 800 / 8}%` }} /></div><small>{profile.xp.toLocaleString()} XP <span>/ {levelFor(profile.xp) < 50 ? `${800 - profile.xp % 800} XP to level ${levelFor(profile.xp) + 1}` : 'MAX LEVEL'}</span></small></div></div><div className="achievement-list">{achievements.map(item => <div key={item.name} className={`achievement-row ${item.progress >= item.goal ? 'unlocked' : ''}`}><item.icon size={28} strokeWidth={1.2} /><div><h4>{t(item.name as TranslationKey)}</h4><p>{t(item.detail as TranslationKey)}</p></div><span>{Math.min(item.progress, item.goal)} / {item.goal}</span>{item.progress >= item.goal ? <Check size={17} /> : <LockKeyhole size={15} />}</div>)}</div></> : <HighScores language={language} scores={scores} />}</div>;
}