import { describe, expect, it } from 'vitest';
import { TRANSLATION_IDS } from '@/lib/store';
import { TRANSLATIONS } from '@/lib/translations';

describe('translations', () => {
  it('every Bible the store accepts is described once, WEBC first (the default)', () => {
    expect(TRANSLATIONS.map((t) => t.id)).toEqual(TRANSLATION_IDS);
    expect(TRANSLATIONS[0]!.id).toBe('webc');
    for (const t of TRANSLATIONS) expect(t.short && t.abbr && t.name && t.note).toBeTruthy();
  });
});
