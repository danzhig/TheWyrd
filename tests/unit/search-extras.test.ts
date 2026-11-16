/** Search beyond the text: themes and threads that match a query (owner, 2026-11-16). */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { queryWords, searchExtras, type ThemesFile } from '@/components/search/extras';
import type { PublicConnections } from '@/lib/types';

const themes = JSON.parse(fs.readFileSync('public/data/themes.json', 'utf8')) as ThemesFile;
const threads = JSON.parse(
  fs.readFileSync('public/data/connections.json', 'utf8'),
) as PublicConnections;

describe('search extras', () => {
  it('splits a query into words, ignoring case, accents and one-letter words', () => {
    expect(queryWords('  Mercy, a FORGIVENESS! ')).toEqual(['mercy', 'forgiveness']);
  });

  it('finds a sub-theme by its name, linking to it on the Vault', () => {
    const sub = themes.themes[0]!.subthemes[0]!;
    const r = searchExtras(sub.title, themes, threads);
    expect(r.themes[0]).toMatchObject({ id: sub.id, href: `/?theme=${sub.id}` });
  });

  it('finds a thread by its label or the books it joins, opening it along the thread', () => {
    const c = threads.connections.find((x) => x.id === 'gen11')!;
    const r = searchExtras("Lot's wife", themes, threads);
    expect(r.threads.map((t) => t.id)).toContain('gen11');
    const hit = r.threads.find((t) => t.id === 'gen11')!;
    expect(hit.href).toMatch(new RegExp(`\\?thread=gen11#`));
    expect(hit.ends).toContain(c.ends[1].display);
  });

  it('needs every word, and returns nothing for an empty query', () => {
    expect(searchExtras('Zarephath zzzz', themes, threads).threads).toEqual([]);
    expect(searchExtras('', themes, threads)).toEqual({ themes: [], threads: [] });
  });
});
