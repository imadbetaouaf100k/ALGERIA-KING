import { useId, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, Compass, Flag, LockKeyhole, MapPin, Navigation, Route, Users } from 'lucide-react';
import { CAMPAIGN, ACTORS, defaultJourney, local, type RegionDefinition } from '../game/campaign';
import { buildingLayout, relicLocations, REGION_PALETTES } from '../game/regions';
import { jt } from '../game/journeyText';
import type { GameSnapshot, JourneyProgress, Language } from '../game/types';

export function LocalMap({ snapshot, compact = false, regionIndex = 0 }: { snapshot?: GameSnapshot; compact?: boolean; regionIndex?: number }) {
  const id = useId().replace(/:/g, '');
  const region = CAMPAIGN[snapshot?.journey?.region ?? regionIndex];
  const [px, pz] = snapshot?.position ?? [0, 19];
  const width = region.biome === 'village' ? 47 : region.biome === 'desert' ? 44 : region.biome === 'plateau' ? 35 : 29;
  const viewBox = compact ? `${px - 16} ${pz - 16} 32 32` : `${-width - 2} ${22 - region.span} ${width * 2 + 4} ${region.span + 9}`;
  const markers = snapshot?.journey?.markers ?? region.npcs.map(n => ({ id: n.actor, type: 'npc', position: n.at, active: n.actor === region.objectives[0].actor }));
  const color = `#${REGION_PALETTES[region.biome].ground.toString(16).padStart(6, '0')}`;
  return <svg className={`local-map ${compact ? 'local-map--compact' : ''}`} viewBox={viewBox} role="img" aria-label={`${region.place.en} map`}>
    <defs><pattern id={`map-grid-${id}`} width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" stroke="#b8c6a1" strokeWidth=".07" fill="none" opacity=".17" /></pattern></defs>
    <rect x="-200" y="-300" width="400" height="650" fill="#172820" />
    <rect x={-width} y={25 - region.span} width={width * 2} height={region.span + 3} fill={color} opacity=".19" />
    <rect x="-200" y="-300" width="400" height="650" fill={`url(#map-grid-${id})`} />
    <path d={`M0 26V${26 - region.span}`} stroke="#b5b492" strokeWidth={['mountain', 'highland'].includes(region.biome) ? 3 : 5.5} opacity=".21" />
    {['mountain', 'highland'].includes(region.biome) && <path d={`M-29 ${region.biome === 'mountain' ? -29 : -21}H29`} stroke="#58817a" strokeWidth="8" opacity=".7" />}
    {['mountain', 'highland'].includes(region.biome) && <path d={`M0 ${region.biome === 'mountain' ? -18 : -15}V${region.biome === 'mountain' ? -40 : -28}`} stroke="#b6a57c" strokeWidth="4.5" />}
    {buildingLayout(region).map((b, i) => <rect key={i} x={b.x - b.d / 2} y={b.z - b.w / 2} width={b.d} height={b.w} fill="#77856b" stroke="#b1b993" strokeWidth=".2" opacity=".7" />)}
    {['oasis', 'river'].includes(region.biome) && <rect x="-10.7" y={region.biome === 'river' ? -28 : -29} width="7.4" height="10" fill="#4d8c85" stroke="#98c1ac" strokeWidth=".2" />}
    {region.biome === 'river' && [-1, 1].map(side => <rect key={side} x={side < 0 ? -26 : 14} y={30 - region.span} width="12" height={region.span - 12} fill="#467f76" opacity=".6" />)}
    {region.biome === 'citadel' && <><rect x="-24" y="-80" width="10" height="55" fill="#697f76" /><rect x="14" y="-80" width="10" height="55" fill="#697f76" /><rect x="-19.5" y="-100" width="39" height="13" fill="#8a9681" /></>}
    {region.biome === 'border' && <path d="M-28-46H28" stroke={snapshot?.journey?.completed.includes('b-permit') || snapshot?.journey?.finished ? '#91c7a6' : '#cb9469'} strokeWidth=".5" strokeDasharray="1.5 1" />}
    {!compact && !snapshot && relicLocations(region).map(([x, z], i) => <circle key={i} cx={x} cy={z} r=".4" fill="#88bfa5" />)}
    {markers.map(marker => <g key={marker.id} transform={`translate(${marker.position[0]} ${marker.position[1]})`}>
      {marker.active && <circle r="2.2" fill="none" stroke="#e3c78e" strokeWidth=".15" opacity=".6" />}
      {marker.type === 'npc' ? <><circle cy="-.5" r=".35" fill={marker.active ? '#e8cc89' : '#b5c8a7'} /><path d="M-.6.7V.35a.6.5 0 0 1 1.2 0V.7Z" fill={marker.active ? '#e8cc89' : '#b5c8a7'} /></> : marker.type === 'vehicle' ? <rect x="-.65" y="-1.1" width="1.3" height="2.2" rx=".2" fill="none" stroke="#b5c8a7" strokeWidth=".2" /> : marker.type === 'relic' ? <circle r=".35" fill="#89bba5" /> : <path d="M0-1.1.8 0 0 1.1-.8 0Z" fill="#e5bf78" />}
    </g>)}
    {snapshot?.enemies.map(([x, z], i) => <circle key={i} cx={x} cy={z} r=".5" fill="#d18a67" />)}
    <g transform={`translate(${px} ${pz}) rotate(${-(snapshot?.yaw ?? 0) * 180 / Math.PI})`}><circle r="1.8" fill="#eee4be" opacity=".1" /><path d="M0-1.2.85.8 0 .4-.85.8Z" fill="#f2ead3" /></g>
  </svg>;
}

interface AtlasProps {
  language: Language;
  progress?: JourneyProgress;
  snapshot?: GameSnapshot;
  inGame: boolean;
  onPlay: () => void;
  onVisit: (region: number) => void;
}

export default function JourneyAtlas({ language, progress, snapshot, inGame, onPlay, onVisit }: AtlasProps) {
  const journey = progress ?? defaultJourney();
  const [tab, setTab] = useState<'atlas' | 'local' | 'itinerary'>(inGame ? 'local' : 'atlas');
  const [selected, setSelected] = useState(journey.region);
  const [expanded, setExpanded] = useState(CAMPAIGN[journey.region].chapter);
  const region = CAMPAIGN[selected];
  const visited = new Set(journey.visited);
  const furthest = Math.max(0, ...journey.visited);
  const known = visited.has(selected) || selected === 0;
  const t = (key: Parameters<typeof jt>[1]) => jt(language, key);
  const name = (r: RegionDefinition) => local(r.place, language);
  const route = CAMPAIGN.filter((_, i) => i <= furthest).map(r => r.map.join(',')).join(' ');
  const completedChapters = Array.from({ length: 12 }, (_, i) => i + 1).filter(chapter => CAMPAIGN.filter(r => r.chapter === chapter).every(r => journey.completed.includes(r.objectives[r.objectives.length - 1].id))).length;
  return <div className="world-panel journey-atlas-panel">
    <div className="panel-tabs" role="tablist">{(['atlas', 'local', 'itinerary'] as const).map(key => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{key === 'atlas' ? <Compass size={16} /> : key === 'local' ? <MapPin size={16} /> : <Route size={16} />}{t(key)}</button>)}</div>
    {tab === 'atlas' && <div className="world-layout journey-world-layout">
      <div className="journey-world-map"><div className="map-heading"><Compass size={17} /><span>THE ATLAS / A CONNECTED JOURNEY</span></div>
        <svg viewBox="0 0 680 410" role="img" aria-label={t('atlas')}>
          <defs><pattern id="journey-atlas-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" stroke="#c4bd8b" strokeWidth=".4" fill="none" opacity=".15" /></pattern><pattern id="journey-contours" width="9" height="9" patternTransform="rotate(30)" patternUnits="userSpaceOnUse"><path d="M0 0V9" stroke="#b3bc93" strokeWidth=".5" opacity=".11" /></pattern></defs>
          <rect width="680" height="410" fill="url(#journey-atlas-grid)" />
          <g fill="#344735" stroke="#859877" strokeWidth=".8"><path d="m74 109 36-28 48 8 35-18 40 33 20 38-17 45 21 53-20 72-60 25-45-21-28-60-18-48-25-47Z" /><path d="m292 188 31-33 53 1 44 26 13 46-19 58-44 15-37-17-40 8-27-33 5-42Z" /><path d="m415 87 21-39 56-14 28 33-10 45-23 17-21 35-36-23Z" /><path d="m537 134 17-41 46 12 31 34-3 47-24 25-49-12-15-35Z" /><path d="m491 289 27-39 44 15 35-8 43 48-11 46-59 18-53-27-30-12Z" /></g>
          <g fill="url(#journey-contours)"><path d="m74 109 36-28 48 8 35-18 40 33 20 38-17 45 21 53-20 72-60 25-45-21-28-60-18-48-25-47Z" /><path d="m292 188 31-33 53 1 44 26 13 46-19 58-44 15-37-17-40 8-27-33 5-42Z" /></g>
          <text x="152" y="360" textAnchor="middle" fill="#abb595" fontFamily="Cormorant Garamond,serif" fontSize="19" letterSpacing="3">ALGERIA</text>
          {furthest >= 6 && <text x="351" y="328" textAnchor="middle" fill="#9caa8b" fontSize="10" letterSpacing="3">TAZIRA</text>}
          {furthest >= 8 && <text x="455" y="23" fill="#9caa8b" fontSize="9" letterSpacing="3">ORDEL</text>}
          {furthest >= 9 && <text x="550" y="80" fill="#9caa8b" fontSize="9" letterSpacing="3">VELORA</text>}
          {furthest >= 10 && <text x="541" y="387" fill="#9caa8b" fontSize="9" letterSpacing="3">IVARA</text>}
          <polyline points={route} fill="none" stroke="#cfb678" strokeWidth="1.5" strokeDasharray="3 5" opacity=".7" />
          {CAMPAIGN.map((r, i) => {
            const visible = visited.has(i) || i <= furthest + 1;
            if (!visible && !journey.finished) return null;
            return <g key={r.id} className={`map-region ${i === selected ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={visited.has(i) ? name(r) : `${t('chapter')} ${r.chapter}`} onClick={() => setSelected(i)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(i); } }}>
              <circle cx={r.map[0]} cy={r.map[1]} r="17" fill="transparent" />
              {selected === i && <circle cx={r.map[0]} cy={r.map[1]} r="13" stroke="#d8bd7e" fill="none" strokeWidth=".8" className="map-pulse" />}
              <circle cx={r.map[0]} cy={r.map[1]} r={journey.region === i ? 5.5 : 4} fill={journey.region === i ? '#e6c991' : visited.has(i) ? '#9ab793' : '#394d38'} stroke={visited.has(i) ? '#d4cf9d' : '#718867'} strokeWidth="1.2" />
              <text x={r.map[0]} y={r.map[1] - 17} textAnchor="middle" fill={visited.has(i) ? '#cfcc9d' : '#829275'} fontSize="8" letterSpacing="1">{String(r.chapter).padStart(2, '0')}{r.part ? ` / ${r.part}` : ''}</text>
            </g>;
          })}
          <path d="M625 39v34m-7-22 7-15 7 15" stroke="#9eaa80" fill="none" /><text x="622" y="28" fill="#c4bb8d" fontSize="9">N</text>
          <text x="278" y="62" fill="#7d9582" fontSize="7" letterSpacing="2.4">BEYOND THE FAMILIAR</text>
        </svg>
        <div className="atlas-footnote"><Route size={13} /><span>{t('fiction')}</span></div>
      </div>
      <aside className="region-detail">
        <div className="region-image"><img src={known ? region.image : '/images/atlas-mountains.jpg'} alt={known ? name(region) : t('hidden')} className={known ? '' : 'undiscovered-image'} /><span>{String(region.chapter).padStart(2, '0')}{region.part ? `.${region.part}` : ''} / 12</span></div>
        <div className={`availability ${known ? 'available' : ''}`}>{known ? <span className="status-dot" /> : <LockKeyhole size={12} />}{t(journey.region === selected ? 'current' : known ? 'known' : 'locked')}</div>
        <h3>{known ? name(region) : t('hidden')}</h3><p>{known ? local(region.intro, language) : t('fastTravelLocked')}</p>
        {known && <div className="journey-region-meta"><span>{local(region.country, language)}</span><small>{t('day')} {String(region.day).padStart(2, '0')}</small></div>}
        {journey.finished && selected !== journey.region ? <button className="gold-button" onClick={() => onVisit(selected)}>{t('visit')}<ArrowRight size={16} /></button> : selected === journey.region ? <button className="gold-button" onClick={onPlay}>{t(inGame || progress ? 'returnToStory' : 'enterRegion')}<ArrowRight size={16} /></button> : <p className="atlas-unlock-note"><LockKeyhole size={13} />{t('fastTravelLocked')}</p>}
        <label className="region-selector"><span>{t('stages')}</span><select value={selected} onChange={e => setSelected(Number(e.target.value))}>{CAMPAIGN.map((r, i) => <option key={r.id} value={i}>{String(r.chapter).padStart(2, '0')}{r.part ? `.${r.part}` : ''} / {visited.has(i) ? name(r) : t('locked')}</option>)}</select></label>
      </aside>
    </div>}
    {tab === 'local' && <div className="district-layout"><div className="district-map"><LocalMap snapshot={snapshot} regionIndex={journey.region} /><div className="map-north">N<Navigation size={16} /></div></div><div className="district-info"><div className="eyebrow">{t('chapter')} {String(CAMPAIGN[journey.region].chapter).padStart(2, '0')} / 12</div><h3>{name(CAMPAIGN[journey.region])}</h3><p>{snapshot?.journey?.detail ?? local(CAMPAIGN[journey.region].intro, language)}</p><ul className="map-legend"><li><Navigation size={17} />{language === 'ar' ? 'ياسين' : 'Yassine'}</li><li><Flag size={17} className="gold" />{t('itinerary')}</li><li><Users size={17} className="teal" />{t('people')}</li><li><BookOpen size={17} className="gold" />{t('evidence')}</li></ul><div className="mission-brief"><span>{Math.min(journey.step + 1, CAMPAIGN[journey.region].objectives.length)} / {CAMPAIGN[journey.region].objectives.length}</span><h4>{snapshot?.journey?.objective ?? local(CAMPAIGN[journey.region].objectives[Math.min(journey.step, CAMPAIGN[journey.region].objectives.length - 1)].title, language)}</h4><p>{t('goal')}</p></div><button className="gold-button" onClick={onPlay}>{t(inGame || progress ? 'returnToStory' : 'enterRegion')}<ArrowRight size={16} /></button></div></div>}
    {tab === 'itinerary' && <div className="story-layout"><p className="roadmap-note"><Route size={17} />{t('campaignLength')}<span className="journey-itinerary-progress">{completedChapters} / 12</span></p>{Array.from({ length: 12 }, (_, i) => i + 1).map(chapter => {
      const regions = CAMPAIGN.filter(r => r.chapter === chapter); const first = CAMPAIGN.indexOf(regions[0]); const open = visited.has(first); const complete = regions.every(r => journey.completed.includes(r.objectives[r.objectives.length - 1].id));
      return <div className={`chapter-item ${expanded === chapter ? 'expanded' : ''}`} key={chapter}><button className="chapter-toggle" aria-expanded={expanded === chapter} onClick={() => setExpanded(expanded === chapter ? 0 : chapter)}><span className="chapter-number">{String(chapter).padStart(2, '0')}</span><span><small>{open ? local(regions[0].country, language) : t('locked')}</small><strong>{local(regions[0].title, language)}</strong></span><span className="chapter-status">{complete ? <Check size={15} /> : open ? <Flag size={14} /> : <LockKeyhole size={14} />}</span><ChevronDown size={17} /></button>{expanded === chapter && (open ? regions.map(r => <div className="journey-region-objectives" key={r.id}>{regions.length > 1 && <h4>{r.part} / {visited.has(CAMPAIGN.indexOf(r)) ? name(r) : t('locked')}</h4>}{visited.has(CAMPAIGN.indexOf(r)) && <ol className="mission-list">{r.objectives.map((obj, index) => <li className={journey.completed.includes(obj.id) ? 'objective-done' : ''} key={obj.id}><span>{String(index + 1).padStart(2, '0')}</span><div>{local(obj.title, language)}</div>{journey.completed.includes(obj.id) ? <Check size={13} /> : r.id === CAMPAIGN[journey.region].id && index === journey.step ? <span className="status-dot" /> : <span className="future-objective-dot" />}</li>)}</ol>}</div>) : <p className="locked-chapter-note">{t('locked')}</p>)}</div>;
    })}</div>}
  </div>;
}

export function JourneyJournal({ language, progress }: { language: Language; progress?: JourneyProgress }) {
  const [tab, setTab] = useState<'evidence' | 'people'>('evidence');
  const [selectedActor, setSelectedActor] = useState(progress?.met[0] ?? '');
  const p = progress ?? defaultJourney();
  const evidence = p.evidence.map(id => {
    const region = CAMPAIGN.find(r => r.objectives.some(o => o.id === id));
    const objective = region?.objectives.find(o => o.id === id);
    return { region, objective };
  }).filter(entry => entry.objective && entry.region);
  const actor = ACTORS[selectedActor];
  return <div className="journey-journal"><div className="panel-tabs"><button className={tab === 'evidence' ? 'active' : ''} onClick={() => setTab('evidence')}><BookOpen size={16} />{jt(language, 'evidence')}<span className="tab-count">{evidence.length}</span></button><button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}><Users size={16} />{jt(language, 'people')}<span className="tab-count">{p.met.length}</span></button></div>
    {tab === 'evidence' ? evidence.length ? <div className="evidence-timeline">{evidence.map(({ region, objective }, index) => <article key={objective!.id}><div className="evidence-number">{String(index + 1).padStart(2, '0')}</div><div><span className="eyebrow">{jt(language, 'chapter')} {String(region!.chapter).padStart(2, '0')} / {local(region!.place, language)}</span><h3>{local(objective!.evidence?.title ?? objective!.title, language)}</h3><p>{local(objective!.evidence?.body ?? objective!.lines?.[0] ?? objective!.detail, language)}</p></div><Check size={14} /></article>)}</div> : <div className="empty-records"><BookOpen size={34} strokeWidth={1} /><h3>{jt(language, 'evidenceEmpty')}</h3><p>{jt(language, 'synopsis')}</p></div>
      : !p.met.length ? <div className="empty-records"><Users size={34} strokeWidth={1} /><h3>{jt(language, 'peopleEmpty')}</h3></div> : <div className="people-journal-layout"><nav className="people-list">{p.met.filter(id => ACTORS[id]).map(id => <button key={id} className={selectedActor === id ? 'selected' : ''} onClick={() => setSelectedActor(id)}><span className="person-initial" style={{ '--person-color': `#${ACTORS[id].color.toString(16).padStart(6, '0')}` } as React.CSSProperties}>{ACTORS[id].name.en.charAt(0)}</span><span><strong>{local(ACTORS[id].name, language)}</strong><small>{local(ACTORS[id].role, language)}</small></span><ArrowRight size={13} /></button>)}</nav>{actor && <article className="person-detail"><span className="person-large-initial" style={{ '--person-color': `#${actor.color.toString(16).padStart(6, '0')}` } as React.CSSProperties}>{actor.name.en.charAt(0)}</span><span className="eyebrow">{local(actor.role, language)}</span><h3>{local(actor.name, language)}</h3><p>{local(actor.bio, language)}</p><div className="person-encounters"><span>{jt(language, 'stages')}</span>{CAMPAIGN.filter((r, i) => p.visited.includes(i) && r.npcs.some(n => n.actor === selectedActor)).map(r => <div key={r.id}><span>{String(r.chapter).padStart(2, '0')}</span>{local(r.place, language)}</div>)}</div></article>}</div>}
  </div>;
}