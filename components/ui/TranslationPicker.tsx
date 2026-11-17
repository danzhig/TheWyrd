'use client';

/**
 * Which Bible to read in, from anywhere (owner, 2026-11-17): on the Vault's header (set it once,
 * before opening a reading) and as a tab on the reader's edge (switch in the middle of a reading).
 * A native select, so it costs almost nothing on the Vault's first load, phones show their own
 * picker, and a third translation is one more entry in `TRANSLATIONS`. The pill shows the current
 * one; the select lies invisibly over it.
 */
import { useSyncExternalStore } from 'react';
import { CHANGE_EVENT, readSettings, writeSettings, type Translation } from '@/lib/store';
import { TRANSLATIONS } from '@/lib/translations';

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
};

export function TranslationPicker({
  className,
  testId,
  prefix,
  abbr,
}: {
  className?: string;
  testId: string;
  /** Words before the version's name on the pill ("Bible"), if any. */
  prefix?: string;
  /** The abbreviation on the pill (the reader's edge tab), not the name. */
  abbr?: boolean;
}) {
  const t = useSyncExternalStore(
    subscribe,
    () => readSettings().translation,
    (): Translation => 'webc',
  );
  const current = TRANSLATIONS.find((x) => x.id === t) ?? TRANSLATIONS[0]!;
  return (
    <span
      className={`translation-picker ${className ?? ''}`}
      data-testid={testId}
      title={`${current.name}: ${current.note}`}
    >
      <span aria-hidden="true">
        {prefix ? <span className="translation-picker-prefix">{prefix} </span> : null}
        {abbr ? current.abbr : current.short}
        <span className="translation-picker-caret"> ▾</span>
      </span>
      <select
        aria-label="Bible translation"
        value={t}
        onChange={(e) => writeSettings({ translation: e.target.value as Translation })}
        data-testid={`${testId}-select`}
      >
        {TRANSLATIONS.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}: {x.note}
          </option>
        ))}
      </select>
    </span>
  );
}
