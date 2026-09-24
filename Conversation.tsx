import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MessageCircle, X } from 'lucide-react';
import { ACTORS } from '../game/campaign';
import { jt } from '../game/journeyText';
import type { ConversationView, Language } from '../game/types';

export default function Conversation({ conversation, language, onNext, onChoice, onClose }: { conversation: ConversationView; language: Language; onNext: () => void; onChoice: (index: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const actor = ACTORS[conversation.actor];
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('.conversation-primary')?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button'); if (!buttons?.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
    };
    document.addEventListener('keydown', trap); return () => document.removeEventListener('keydown', trap);
  }, [conversation.actor, conversation.index]);
  return <motion.section ref={ref} className="conversation-panel" role="dialog" aria-modal="true" aria-label={conversation.speaker} dir={language === 'ar' ? 'rtl' : 'ltr'} initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }}>
    <div className="conversation-character"><span className="person-initial" style={{ '--person-color': `#${(actor?.color ?? 0x5f7561).toString(16).padStart(6, '0')}` } as React.CSSProperties}>{actor?.name.en.charAt(0) ?? 'Y'}</span><div><span className="eyebrow">{conversation.role}</span><h2>{conversation.speaker}</h2></div><button className="icon-button" onClick={onClose} aria-label={jt(language, 'closeTalk')}><X size={18} /></button></div>
    <motion.p className="conversation-line" key={`${conversation.actor}-${conversation.index}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} aria-live="polite">{conversation.line}</motion.p>
    {conversation.feedback && <p className="deduction-feedback" role="status"><MessageCircle size={15} />{conversation.feedback}</p>}
    {conversation.choices.length ? <div className="conversation-choices">{conversation.choices.map((choice, i) => <button className={i === 0 ? 'conversation-primary' : ''} key={choice} onClick={() => onChoice(i)}><kbd>{i + 1}</kbd><span>{choice}</span><ArrowRight size={15} /></button>)}</div> : <div className="conversation-bottom"><span>{String(conversation.index + 1).padStart(2, '0')} / {String(conversation.total).padStart(2, '0')}</span><button className="text-button" onClick={onClose}>{jt(language, 'closeTalk')}</button><button className="gold-button conversation-primary" onClick={onNext}>{jt(language, conversation.index === conversation.total - 1 ? 'finishTalk' : 'next')}<ArrowRight size={16} /></button></div>}
  </motion.section>;
}