import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('CI', () => {
  it("every job's Playwright image matches the pinned @playwright/test", () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const pinned =
      pkg.devDependencies?.['@playwright/test'] ?? pkg.dependencies?.['@playwright/test'];
    const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    const images = [...ci.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/g)].map((m) => m[1]);
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) expect(image).toBe(pinned);
  });
});
