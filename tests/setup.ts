/**
 * Loaded by vitest before any test module.
 *
 * The IndexedDB polyfill has to be installed before `lib/db` is imported —
 * that module opens the Dexie database as a side effect. Keeping it here
 * rather than at the top of a test file means an import sorter can never
 * reorder it into uselessness.
 */
import 'fake-indexeddb/auto'
