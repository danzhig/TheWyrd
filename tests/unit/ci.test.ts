import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('CI', () => {
  it("the browsers job's Playwright image matches the pinned @playwright/test", () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const pinned =
      pkg.devDependencies?.['@playwright/test'] ?? pkg.dependencies?.['@playwright/test'];
    const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    const image = /mcr\.microsoft\.com\/playwright:v([\d.]+)-/.exec(ci)?.[1];
    expect(image).toBe(pinned);
  });
});
