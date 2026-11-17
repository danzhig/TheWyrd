/**
 * The Bibles a reader can read in (owner, 2026-11-17). The WEBC is the backbone (plan, sections,
 * threads, themes, search); the others swap a page's words. One list, so a third (owner's idea: a
 * further Catholic translation) is one more entry here, with its data, and every picker offers it.
 */
import type { Translation } from './store';

export interface TranslationInfo {
  id: Translation;
  /** On the pickers' pills. */
  short: string;
  /** On the reader's edge tab, where room is tight. */
  abbr: string;
  /** In the pickers' menus. */
  name: string;
  /** One line on what it is. */
  note: string;
}

export const TRANSLATIONS: TranslationInfo[] = [
  {
    id: 'webc',
    short: 'WEBC',
    abbr: 'WEBC',
    name: 'World English Bible (Catholic)',
    note: 'modern English from the Hebrew and Greek',
  },
  {
    id: 'drc',
    short: 'Douay-Rheims',
    abbr: 'DR',
    name: 'Douay-Rheims (Challoner)',
    note: 'the traditional Catholic English, from the Latin Vulgate',
  },
];
