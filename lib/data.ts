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
export function getSectionThemes(sectionId: string): SectionTheme[] {
  if (!themesBySection) {
    themesBySection = new Map();
    const file = path.join(DATA, 'themes.json');
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        themes: {
          title: string;
          subthemes: { id: string; title: string; passages: { sectionId: string }[] }[];
        }[];
      };
      for (const t of data.themes)
        for (const s of t.subthemes)
          for (const sec of new Set(s.passages.map((p) => p.sectionId))) {
            const list = themesBySection.get(sec) ?? [];
            if (!list.some((x) => x.id === s.id))
              list.push({ id: s.id, title: s.title, themeTitle: t.title });
            themesBySection.set(sec, list);
          }
    }
  }
  return themesBySection.get(sectionId) ?? [];
}

/** A connection seen from one of its ends: the verse here, and the passage it leads to. */
export interface SectionThread {
  connection: Omit<PublicConnection, 'ends'>;
  here: ThreadEnd;
  there: ThreadEnd;
}

let threadsBySection: Map<string, SectionThread[]> | null = null;
/**
 * The verified connections (Phase 4) with an end in this section, from
 * public/data/connections.json, in verse order. A connection shows at both of its ends.
 */
export function getSectionThreads(sectionId: string): SectionThread[] {
  if (!threadsBySection) {
    threadsBySection = new Map();
    const file = path.join(DATA, 'connections.json');
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8')) as PublicConnections;
      for (const { ends, ...connection } of data.connections)
        ends.forEach((here, i) => {
          const list = threadsBySection!.get(here.sectionId) ?? [];
          list.push({ connection, here, there: ends[1 - i]! });
          threadsBySection!.set(here.sectionId, list);
        });
      const pos = (t: SectionThread) => t.here.anchor.match(/\d+/g)!.map(Number);
      for (const list of threadsBySection.values())
        list.sort((a, b) => {
          const [ac, av] = pos(a);
          const [bc, bv] = pos(b);
          return ac! - bc! || av! - bv!;
        });
    }
  }
  return threadsBySection.get(sectionId) ?? [];
}
