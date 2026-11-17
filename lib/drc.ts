/**
 * The reader's Douay-Rheims text (Phase 7, P7.2), pure and unit-tested: a section's Douay-Rheims
 * file (public/data/drc/<id>.json) as verses the reader's components render. Each WEBC verse keeps
 * its place, its anchor (`v-<c>-<v>`, so links, threads and notes still land) and its folds; its
 * Douay-Rheims verses carry their own numbers. A WEBC verse with no Douay-Rheims words of its own
 * stays as an empty anchor.
 */
import type { DrcSectionFile, FoldOut, VerseOut } from './types';

export function drcVerses(
  file: DrcSectionFile,
  folds: FoldOut[] = [],
): { verses: VerseOut[]; folds: FoldOut[] } {
  const verses: VerseOut[] = [];
  const lastOf = new Map<string, string>();
  for (const u of file.order) {
    const [, c, rest] = u.split('.');
    const [v, part] = rest!.split('!');
    const anchor = `v-${c}-${v}${part ?? ''}`;
    const ds = file.units[u] ?? [];
    if (!ds.length) {
      verses.push({ ref: u, c: Number(c), v: Number(v), blocks: [], bare: true, anchor });
      lastOf.set(u, u);
      continue;
    }
    ds.forEach((d, k) => {
      const ref = k ? `${u}~${k}` : u;
      const out: VerseOut = {
        ref,
        c: d.c,
        v: d.v,
        blocks: d.blocks,
        anchor: k ? `d-${d.c}-${d.v}` : anchor,
      };
      if (d.footnotes) out.footnotes = d.footnotes;
      if (d.heading) out.heading = d.heading;
      verses.push(out);
      lastOf.set(u, ref);
    });
  }
  // A fold ends with the last Douay-Rheims verse of its last WEBC verse.
  return { verses, folds: folds.map((f) => ({ ...f, to: lastOf.get(f.to) ?? f.to })) };
}

let cache = new Map<string, Promise<DrcSectionFile>>();
/** A section's Douay-Rheims file, fetched once per visit. */
export function loadDrc(id: string): Promise<DrcSectionFile> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/data/drc/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`drc/${id}.json ${r.status}`);
      return r.json() as Promise<DrcSectionFile>;
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** For tests. */
export function resetDrcCache() {
  cache = new Map();
}
