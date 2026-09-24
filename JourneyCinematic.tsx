import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Compass, SkipForward } from 'lucide-react';
import { CAMPAIGN, EPILOGUE, local } from '../game/campaign';
import { jt } from '../game/journeyText';
import type { Language } from '../game/types';
import { LionMark } from './Brand';

export default function JourneyCinematic({ language, from = 0, to = 0, mode, onDone, onEnter }: { language: Language; from?: number; to?: number; mode: 'arrival' | 'travel' | 'ending'; onDone: () => void; onEnter?: () => void }) {
  const [page, setPage] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const ending = mode === 'ending';
  const region = CAMPAIGN[to];
  const image = ending ? EPILOGUE[page].image : region.image;
  useEffect(() => {
    container.current?.querySelector<HTMLButtonElement>('.cinematic-main-action')?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = container.current?.querySelectorAll<HTMLButtonElement>('button'); if (!items?.length) return;
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === items[items.length - 1]) { e.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', trap); return () => document.removeEventListener('keydown', trap);
  }, []);
  const next = () => { if (ending && page < EPILOGUE.length - 1) setPage(p => p + 1); else if (mode === 'arrival' && onEnter) onEnter(); else onDone(); };
  return <motion.div ref={container} className="journey-cinematic" role="dialog" aria-modal="true" aria-label={jt(language, ending ? 'ending' : 'transition')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }} dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <AnimatePresence mode="sync"><motion.img key={image} src={image} alt="" className="journey-cinematic-image" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ opacity: { duration: 0.6 }, scale: { duration: 14, ease: 'linear' } }} /></AnimatePresence>
    <div className="journey-cinematic-shade" /><header><div><LionMark size={37} /><span>LIONS OF ALGERIA<small>{jt(language, ending ? 'ending' : 'transition')}</small></span></div><span>{ending ? `${page + 1} / ${EPILOGUE.length}` : `${jt(language, 'day')} ${String(region.day).padStart(2, '0')}`}</span></header>
    <AnimatePresence mode="wait"><motion.div className="journey-cinematic-copy" key={page} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onAnimationComplete={() => container.current?.querySelector<HTMLButtonElement>('.cinematic-main-action')?.focus({ preventScroll: true })}>
      <div className="eyebrow"><span className="gold-line" />{ending ? jt(language, 'done') : `${jt(language, 'chapter')} ${String(region.chapter).padStart(2, '0')}${region.part ? ` / ${region.part}` : ''}`}</div>
      <h2>{ending ? local(EPILOGUE[page].title, language) : local(region.title, language)}</h2>
      {!ending && <div className="cinematic-place"><Compass size={15} />{local(region.place, language)}<span />{local(region.country, language)}</div>}
      {mode === 'travel' && <p className="journey-previous-page">{local(CAMPAIGN[from].outro, language)}</p>}
      <p>{ending ? local(EPILOGUE[page].body, language) : local(region.intro, language)}</p>
      <button className="gold-button cinematic-main-action" onClick={next}>{jt(language, ending ? page === EPILOGUE.length - 1 ? 'journeySummary' : 'nextScene' : mode === 'arrival' ? 'enterRegion' : 'nextRegion')}<ArrowRight size={18} /></button>
    </motion.div></AnimatePresence>
    <footer>{ending ? <div className="epilogue-progress">{EPILOGUE.map((_, i) => <button aria-label={`${i + 1}`} className={i === page ? 'active' : ''} key={i} onClick={() => setPage(i)} />)}</div> : <div className="cinematic-route"><span>{mode === 'arrival' ? jt(language, 'begin') : local(CAMPAIGN[from].place, language)}</span><div><i /></div><strong>{local(region.place, language)}</strong></div>}<button className="text-button" onClick={onDone}>{jt(language, 'skip')}<SkipForward size={15} /></button></footer>
  </motion.div>;
}