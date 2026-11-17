'use client';

/**
 * The reader's second translation (Phase 7, P7.2). The page is rendered with the WEBC; with the
 * Douay-Rheims setting on, `TranslatedBody` fetches the section's Douay-Rheims file and renders the
 * same body with its words (lib/drc.ts), and `TranslationSwitch` in the header switches between the
 * two and shows the Douay-Rheims's own reference. Without JavaScript, or if the file cannot be
 * loaded, the WEBC stays.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { drcVerses, loadDrc } from '@/lib/drc';
import { TRANSLATIONS } from '@/lib/translations';
import { CHANGE_EVENT, readSettings, writeSettings, type Translation } from '@/lib/store';
import type { DrcSectionFile, SectionFile } from '@/lib/types';
import { SectionBody } from './SectionBody';
import styles from './reader.module.css';

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
};

export function useTranslation(): Translation {
  return useSyncExternalStore(
    subscribe,
    () => readSettings().translation,
    () => 'webc',
  );
}

/** The section's Douay-Rheims file once the setting asks for it (null until then, or on failure). */
function useDrc(id: string, on: boolean): { file: DrcSectionFile | null; failed: boolean } {
  const [state, setState] = useState<{ id: string; file: DrcSectionFile | null; failed: boolean }>({
    id,
    file: null,
    failed: false,
  });
  useEffect(() => {
    if (!on) return;
    let alive = true;
    loadDrc(id).then(
      // A file the reader cannot use counts as not loaded: the WEBC stays.
      (file) =>
        alive &&
        setState(
          Array.isArray(file?.order) && file.units
            ? { id, file, failed: false }
            : { id, file: null, failed: true },
        ),
      () => alive && setState({ id, file: null, failed: true }),
    );
    return () => {
      alive = false;
    };
  }, [id, on]);
  return state.id === id ? state : { file: null, failed: false };
}

export type BodySection = Omit<SectionFile, 'verses'>;

export function TranslatedBody({
  section,
  threads,
  children,
}: {
  section: BodySection;
  threads?: Record<string, number>;
  /** The WEBC body, rendered on the server. */
  children: ReactNode;
}) {
  const t = useTranslation();
  const { file, failed } = useDrc(section.id, t === 'drc');
  const shown = t === 'drc' && file ? 'drc' : 'webc';
  // Switching in the middle of a reading keeps the place (owner, 2026-11-17): the verse at the
  // top of the screen as the choice changes is put back where it was once the other words are in.
  const anchor = useRef<{ id: string; top: number } | null>(null);
  useEffect(() => {
    let last = readSettings().translation;
    const onChange = () => {
      const now = readSettings().translation;
      if (now === last) return;
      last = now;
      anchor.current = topVerse();
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a || (t === 'drc' && !file && !failed)) return; // still loading: keep the place for later
    anchor.current = null;
    const fix = () => {
      const el = document.getElementById(a.id);
      const d = el ? el.getBoundingClientRect().top - a.top : 0;
      if (Math.abs(d) >= 1) window.scrollBy(0, d);
    };
    fix();
    // Hold the place for a moment while late changes settle (the header's Douay-Rheims reference
    // arrives a beat after the body), unless the reader scrolls first.
    let frame = 0;
    const until = performance.now() + 1000;
    const stop = () => {
      cancelAnimationFrame(frame);
      for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown'])
        window.removeEventListener(ev, stop);
    };
    for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown'])
      window.addEventListener(ev, stop, { passive: true });
    const hold = () => {
      fix();
      if (performance.now() < until) frame = requestAnimationFrame(hold);
      else stop();
    };
    frame = requestAnimationFrame(hold);
    return stop;
  }, [shown, t, file, failed]);
  if (shown === 'drc' && file) {
    const { verses, folds } = drcVerses(file, section.folds);
    return (
      <div data-translated="drc" data-testid="drc-body">
        <SectionBody section={{ ...section, verses, folds }} threads={threads} />
      </div>
    );
  }
  // While the Douay-Rheims loads, the WEBC stays hidden (CSS, html[data-translation="drc"]), at
  // most for a moment; if it cannot be loaded, the WEBC shows.
  return (
    <div data-translated="webc" data-failed={failed ? '' : undefined}>
      {children}
    </div>
  );
}

/** The first verse anchor at or below the top bar, and where it is on screen. */
function topVerse(): { id: string; top: number } | null {
  for (const el of document.querySelectorAll<HTMLElement>('article [id^="v-"]')) {
    const top = el.getBoundingClientRect().top;
    if (top >= 64) return { id: el.id, top };
  }
  return null;
}

export function TranslationSwitch({ id }: { id: string }) {
  const t = useTranslation();
  const { file } = useDrc(id, t === 'drc');
  return (
    <p className={styles.translation} data-testid="translation" data-pagefind-ignore="all">
      <span className={styles.translationSwitch} role="group" aria-label="Translation">
        {TRANSLATIONS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={t === x.id}
            onClick={() => writeSettings({ translation: x.id })}
            data-testid={`translation-${x.id}`}
            title={`${x.name}: ${x.note}`}
          >
            {x.short}
          </button>
        ))}
      </span>
      {t === 'drc' && file ? (
        <span className={styles.translationRef} data-testid="drc-reference">
          {' '}
          Douay-Rheims numbers this {file.reference}
        </span>
      ) : null}
    </p>
  );
}
