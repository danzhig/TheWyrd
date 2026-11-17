/** The Testaments filter (owner, 2026-11-17): how visible a book's stars are while it fades. */
import { describe, expect, it } from 'vitest';
import { starVisibility } from '@/components/vault/starfield';
import { readSettings, writeSettings } from '@/lib/store';

const isOt = (id: string) => id === 'Gen';

describe('the Testaments filter', () => {
  it('fades a hidden book out and back in, and leaves the others alone', () => {
    expect(starVisibility(undefined, 'Gen')).toBe(1);
    expect(starVisibility({ prev: null, next: isOt, t: 0 }, 'Gen')).toBe(1);
    expect(starVisibility({ prev: null, next: isOt, t: 0.5 }, 'Gen')).toBe(0.5);
    expect(starVisibility({ prev: null, next: isOt, t: 1 }, 'Gen')).toBe(0);
    expect(starVisibility({ prev: isOt, next: null, t: 1 }, 'Gen')).toBe(1);
    expect(starVisibility({ prev: null, next: isOt, t: 0.5 }, 'Luke')).toBe(1);
  });

  it('is a setting, both by default, and ignores unknown values', () => {
    expect(readSettings().testaments).toBe('both');
    writeSettings({ testaments: 'nt' });
    expect(readSettings().testaments).toBe('nt');
    writeSettings({ testaments: 'none' as never });
    expect(readSettings().testaments).toBe('both');
  });
});
