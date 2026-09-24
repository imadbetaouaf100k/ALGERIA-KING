import { useEffect, useId, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowLeft } from 'lucide-react';
import { text } from '../game/i18n';
import type { Language } from '../game/types';

interface ModalProps {
  title: string;
  description?: string;
  eyebrow?: string;
  language: Language;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}

export default function Modal({ title, description, eyebrow = 'LIONS OF ALGERIA', language, children, onClose, className = '' }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, [tabindex="0"]');
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, []);
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`modal-shell ${className}`} dir={language === 'ar' ? 'rtl' : 'ltr'} initial={{ opacity: 0, y: 24, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.3 }}>
        <header className="modal-header">
          <div>
            <div className="eyebrow"><span className="gold-line" />{eyebrow}</div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button close-button" onClick={onClose} aria-label={text(language, 'close')}><X size={21} strokeWidth={1.5} /></button>
        </header>
        <div className="modal-content">{children}</div>
        <footer className="modal-footer"><button className="text-button" onClick={onClose}><ArrowLeft size={15} />{text(language, 'back')}</button><span>LIONS OF ALGERIA <i /> JOURNEY 0.2</span><kbd>ESC</kbd></footer>
      </motion.div>
    </motion.div>
  );
}