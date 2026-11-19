/**
 * Search beyond the text (owner, 2026-11-16): the themes and the threads (connections) whose names
 * or descriptions match a query, shown above the sections. Pure, unit-tested; the data is the
 * site's own `/data/themes.json` and `/data/connections.json`.
 */
import { TYPE_LABEL, direction, threadHref } from '@/lib/threads';
import type { PublicConnections } from '@/lib/types';

export interface ThemesFile {
  themes: {
    id: string;
    title: string;
    description: string;
    subthemes: { id: string; title: string; description: string; passages: unknown[] }[];
  }[];
}

export interface ThemeHit {
  id: string;
  title: string;
  themeTitle: string;
  description: string;
  passages: number;
  href: string;
}

export interface ThreadHit {
  id: string;
  label: string;
  type: string;
  ends: string; // "Exodus 3:2–6 ↔ Luke 20:37"
  /** The direction line (threads plan TD6): older first, then how the later takes it up. */
  older: string;
  verb: string;
  later: string;
  /** A use is claimed (solid arrow) or not (dotted); false with no order too. */
  uses: boolean;
  href: string;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The query's words (two letters or more). */
export const queryWords = (q: string) =>
  fold(q)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);

/** Every word appears in the text (as a word start, so "lamb" finds "lambs", not "flamb…"). */
function matches(words: string[], text: string): boolean {
  const t = ` ${fold(text).replace(/[^\p{L}\p{N}]+/gu, ' ')}`;
  return words.every((w) => t.includes(` ${w}`));
}

export function searchExtras(
  q: string,
  themes: ThemesFile | null,
  connections: PublicConnections | null,
  limit = 4,
): { themes: ThemeHit[]; threads: ThreadHit[] } {
  const words = queryWords(q);
  if (!words.length) return { themes: [], threads: [] };
  const themeHits: (ThemeHit & { rank: number })[] = [];
  for (const t of themes?.themes ?? [])
    for (const s of t.subthemes) {
      const inName = matches(words, `${s.title} ${t.title}`);
      if (!inName && !matches(words, `${s.title} ${t.title} ${s.description}`)) continue;
      themeHits.push({
        id: s.id,
        title: s.title,
        themeTitle: t.title,
        description: s.description,
        passages: s.passages.length,
        href: `/?theme=${s.id}`,
        rank: inName ? 0 : 1,
      });
    }
  const threadHits: (ThreadHit & { rank: number })[] = [];
  for (const c of connections?.connections ?? []) {
    const ends = `${c.ends[0].display} ↔ ${c.ends[1].display}`;
    const inName = matches(words, `${c.label} ${ends}`);
    if (!inName && !matches(words, `${c.label} ${ends} ${c.explanation} ${TYPE_LABEL[c.type]}`))
      continue;
    // Open it at the end on the path, if one is.
    const end = c.ends.find((e) => !e.library) ?? c.ends[1];
    const d = direction(c, c.ends);
    threadHits.push({
      id: c.id,
      label: c.label,
      type: TYPE_LABEL[c.type],
      ends,
      older: d.older.display,
      verb: d.verb,
      later: d.later.display,
      uses: d.known && d.uses,
      href: threadHref(c.id, end),
      rank: inName ? 0 : 1,
    });
  }
  const strip = <T extends { rank: number }>(list: T[]): Omit<T, 'rank'>[] =>
    list
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit)
      .map((x) => {
        const rest: Partial<T> = { ...x };
        delete rest.rank;
        return rest as Omit<T, 'rank'>;
      });
  return { themes: strip(themeHits), threads: strip(threadHits) };
}
