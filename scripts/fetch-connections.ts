/**
 * pnpm connections:fetch — download and verify the Phase 4 sources (sources/manifest.json, pipeline
 * "connections"): OpenBible.info's cross-references. `pnpm content:build` and CI never fetch them.
 */
import { fetchPipeline } from './fetch-terms';

fetchPipeline('connections').catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
});
