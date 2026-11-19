/**
 * STEPBible TIPNR (Translators Individualised Proper Names with all References, CC BY 4.0;
 * threads plan TX1/TX2): every proper name with a unique id per person or place ("Abraham@Gen.11.26-1Pe")
 * and every verse where that one is named. Read from its "– Named", "– Greek" and similar lines
 * (tab-separated: kind, unique name, Strong's, name as translated, references), never typed.
 */
import fs from 'node:fs';

export interface TipnrIndex {
  /** "Gen.17.5" (TIPNR's book abbreviations, as TVTMS) → the unique ids named there. */
  byVerse: Map<string, Set<string>>;
  /** Unique id → the name as translated (first form seen). */
  names: Map<string, string>;
}

export function parseTipnr(text: string): TipnrIndex {
  const byVerse = new Map<string, Set<string>>();
  const names = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('– ') || line.startsWith('– Total') || line.startsWith('– Significance'))
      continue;
    const c = line.split('\t');
    const unique = (c[1] ?? '').split('|').pop()!.trim();
    if (!unique.includes('@')) continue;
    if (!names.has(unique)) names.set(unique, (c[3] ?? '').trim() || unique.split('@')[0]!);
    for (const r of (c[4] ?? '').split(/;\s*/)) {
      const m = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)[a-z]?$/.exec(r.trim());
      if (!m) continue;
      const key = `${m[1]}.${m[2]}.${m[3]}`;
      const set = byVerse.get(key) ?? new Set<string>();
      set.add(unique);
      byVerse.set(key, set);
    }
  }
  return { byVerse, names };
}

export const readTipnr = (file: string) => parseTipnr(fs.readFileSync(file, 'utf8'));
