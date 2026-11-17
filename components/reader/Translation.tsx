'use client';

/**
 * The reader's second translation (Phase 7, P7.2). The page is rendered with the WEBC; with the
 * Douay-Rheims setting on, `TranslatedBody` fetches the section's Douay-Rheims file and renders the
 * same body with its words (lib/drc.ts), and `TranslationSwitch` in the header switches between the
 * two and shows the Douay-Rheims's own reference. Without JavaScript, or if the file cannot be
 * loaded, the WEBC stays.
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { drcVerses, loadDrc } from '@/lib/drc';
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
  if (t === 'drc' && file) {
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

export function TranslationSwitch({ id }: { id: string }) {
  const t = useTranslation();
  const { file } = useDrc(id, t === 'drc');
  return (
    <p className={styles.translation} data-testid="translation" data-pagefind-ignore="all">
      <span className={styles.translationSwitch} role="group" aria-label="Translation">
        {(['webc', 'drc'] as const).map((x) => (
          <button
            key={x}
            type="button"
            aria-pressed={t === x}
            onClick={() => writeSettings({ translation: x })}
            data-testid={`translation-${x}`}
            title={
              x === 'webc'
                ? 'World English Bible Catholic Edition: modern English from the Hebrew and Greek'
                : 'Douay-Rheims (Challoner): the traditional Catholic English, from the Latin Vulgate'
            }
          >
            {x === 'webc' ? 'WEBC' : 'Douay-Rheims'}
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
