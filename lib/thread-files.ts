/**
 * Every published file of threads under `public/data` (threads plan §5, TX7), in the order they
 * are read: the first 170 (Old ↔ New), the threads inside each Testament, and the library's own
 * Old ↔ New threads. The build writes them from `CONNECTION_FILES` (scripts/connections/schema.ts,
 * a unit test keeps the two lists equal); the reader, the Vault, search and /path read them all.
 * A file missing at run time counts as empty, except the first.
 */
export const THREAD_FILES = [
  'connections.json',
  'connections-within-ot.json',
  'connections-within-nt.json',
  'connections-library-ot-nt.json',
] as const;
