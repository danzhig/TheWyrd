/** Build-time access to public/data (server components only). */
import fs from 'node:fs';
import path from 'node:path';
import type {
  Book,
  Bridge,
  PlanStep,
  PublicConnection,
  PublicConnections,
  SectionFile,
  SectionIndexEntry,
  ThreadEnd,
  KeyMarks,
} from './types';

const DATA = path.join(process.cwd(), 'public/data');

export interface Manifest {
  planVersion: string;
  books: Book[];
  steps: PlanStep[];
  sections: SectionIndexEntry[];
  bridges: Bridge[];
  sources: PublicSource[];
}

/** A pinned source as published in the manifest (credited on /sources). */
export interface PublicSource {
  id: string;
  name: string;
  layer: string;
  homepage: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  usedFor: string;
  version: string;
}

let full: Manifest | null = null;
let manifest: Manifest | null = null;

/** Every section, the path's and the library's (Phase 5). */
export function getFullManifest(): Manifest {
  full ??= JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8')) as Manifest;
  return full;
}

/**
 * The path as the site uses it: the manifest without library sections, which never join the path
 * (its sequence, progress, the spiral's reading times or the timeline).
 */
export function getManifest(): Manifest {
  manifest ??= {
    ...getFullManifest(),
    sections: getFullManifest().sections.filter((s) => !s.library),
  };
  return manifest;
}

/**
 * The library in reading order: books in canonical order (as the manifest lists them), each
 * book's sections in order.
 */
export function librarySequence(): SectionIndexEntry[] {
  const m = getFullManifest();
  return m.books
    .filter((b) => b.library)
    .flatMap((b) =>
      m.sections.filter((s) => s.library && s.bookId === b.id).sort((a, z) => a.order - z.order),
    );
}

export function getSection(id: string): SectionFile {
  return JSON.parse(
    fs.readFileSync(path.join(DATA, 'sections', `${id}.json`), 'utf8'),
  ) as SectionFile;
}

/** A sub-theme a section belongs to (Phase 6): for the reader's "Themes" line and breadcrumb. */
export interface SectionTheme {
  id: string; // sub-theme id, e.g. "mercy-forgiveness"
  title: string; // "Forgiveness"
  themeTitle: string; // "Mercy and forgiveness"
}

let themesBySection: Map<string, SectionTheme[]> | null = null;
/** The sub-themes whose passages start in this section, in theme order (from public/data/themes.json). */
interface ThemesJson {
  themes: {
    title: string;
    subthemes: {
      id: string;
      title: string;
      passages: { sectionId: string }[];
      readings?: { sectionId: string; key?: string }[];
    }[];
  }[];
}
let themesJson: ThemesJson | null | undefined;
function readThemesJson(): ThemesJson | null {
  if (themesJson === undefined) {
    const file = path.join(DATA, 'themes.json');
    themesJson = fs.existsSync(file)
      ? (JSON.parse(fs.readFileSync(file, 'utf8')) as ThemesJson)
      : null;
  }
  return themesJson;
}

/** Every sub-theme a section belongs to (its readings, P6.5), linked to their constellations. */
export function getSectionThemes(sectionId: string): SectionTheme[] {
  if (!themesBySection) {
    themesBySection = new Map();
    for (const t of readThemesJson()?.themes ?? [])
      for (const s of t.subthemes) {
        const ids = new Set([
          ...(s.readings ?? []).map((r) => r.sectionId),
          ...s.passages.map((p) => p.sectionId),
        ]);
        for (const sec of ids) {
          const list = themesBySection.get(sec) ?? [];
          if (!list.some((x) => x.id === s.id))
            list.push({ id: s.id, title: s.title, themeTitle: t.title });
          themesBySection.set(sec, list);
        }
      }
  }
  return themesBySection.get(sectionId) ?? [];
}

/**
 * The section's key passages (owner, 2026-11-18): the verses each sub-theme chose here, to be
 * marked in gold however the reading is reached, with the sub-themes named at the passage's first
 * verse. A whole-chapter key is named at the chapter's first verse but not filled in.
 */
export function getSectionKeys(sectionId: string, verses: { ref: string }[]): KeyMarks {
  const at = (r: string) => {
    const [, c, v] = r.split('!')[0]!.split('.');
    return Number(c) * 1000 + Number(v ?? 0);
  };
  const marked = new Set<string>();
  const starts: KeyMarks['starts'] = {};
  for (const t of readThemesJson()?.themes ?? [])
    for (const s of t.subthemes)
      for (const r of s.readings ?? []) {
        if (r.sectionId !== sectionId || !r.key) continue;
        const [from, to = from] = r.key.split('-') as [string, string?];
        const whole = from.split('.').length === 2;
        const lo = whole ? at(from) + 1 : at(from);
        const hi = whole ? at(from) + 999 : at(to!);
        const inKey = verses.filter((v) => at(v.ref) >= lo && at(v.ref) <= hi);
        if (!inKey.length) continue;
        if (!whole) for (const v of inKey) marked.add(v.ref);
        const first = inKey[0]!.ref;
        const list = (starts[first] ??= []);
        if (!list.some((x) => x.id === s.id))
          list.push(
            whole ? { id: s.id, title: s.title, whole: true } : { id: s.id, title: s.title },
          );
      }
  return { marked: [...marked], starts };
}

/** A connection seen from one of its ends: the verse here, and the passage it leads to. */
export interface SectionThread {
  connection: Omit<PublicConnection, 'ends'>;
  here: ThreadEnd;
  there: ThreadEnd;
}

let threadsBySection: Map<string, SectionThread[]> | null = null;
/** Every published file of threads (threads plan §5): the reader shows all pairs. */
const THREAD_FILES = [
  'connections.json',
  'connections-within-ot.json',
  'connections-within-nt.json',
];
/**
 * The verified connections (Phase 4) with an end in this section, from every published threads
 * file, in verse order. A connection shows at both of its ends.
 */
export function getSectionThreads(sectionId: string): SectionThread[] {
  if (!threadsBySection) {
    threadsBySection = new Map();
    for (const out of THREAD_FILES) {
      const file = path.join(DATA, out);
      if (!fs.existsSync(file)) continue;
      const data = JSON.parse(fs.readFileSync(file, 'utf8')) as PublicConnections;
      for (const { ends, ...connection } of data.connections)
        ends.forEach((here, i) => {
          const list = threadsBySection!.get(here.sectionId) ?? [];
          list.push({ connection, here, there: ends[1 - i]! });
          threadsBySection!.set(here.sectionId, list);
        });
    }
    const pos = (t: SectionThread) => t.here.anchor.match(/\d+/g)!.map(Number);
    for (const list of threadsBySection.values())
      list.sort((a, b) => {
        const [ac, av] = pos(a);
        const [bc, bv] = pos(b);
        return ac! - bc! || av! - bv!;
      });
  }
  return threadsBySection.get(sectionId) ?? [];
}

/** Counts for the About page (Phases 4 and 6): the themes and the verified connections. */
export function getExtrasSummary(): {
  themes: number;
  subthemes: number;
  passages: number;
  connections: number;
  bookPairs: number;
} {
  const read = <T>(f: string): T | null =>
    fs.existsSync(path.join(DATA, f))
      ? (JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')) as T)
      : null;
  const t = read<{ themes: { subthemes: { passages: unknown[] }[] }[] }>('themes.json');
  const c = read<PublicConnections>('connections.json');
  const subs = (t?.themes ?? []).flatMap((x) => x.subthemes);
  return {
    themes: t?.themes.length ?? 0,
    subthemes: subs.length,
    passages: subs.reduce((n, s) => n + s.passages.length, 0),
    connections: c?.connections.length ?? 0,
    bookPairs: new Set(
      (c?.connections ?? []).map((x) => [x.ends[0].bookId, x.ends[1].bookId].sort().join('|')),
    ).size,
  };
}
