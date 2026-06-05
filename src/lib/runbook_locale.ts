/**
 * Locale-aware preset runbook utilities.
 *
 * Handles mapping between base (English) runbooks and their locale-specific
 * variants. Locale variants are identified by filename pattern:
 *   <name>.<locale>.atrb
 *
 * With the new system (no runtime translation), each locale's runbook is a
 * separate .atrb file. This module provides the glue to show the right file
 * for the current locale.
 */

const LOCALE_FILE_RE = /\.([a-z]{2}(-[A-Z]{2})?)\.atrb$/;

export function getRunbookLocaleFromPath(path: string): string | null {
  const match = path.match(LOCALE_FILE_RE);
  return match ? match[1] : null;
}

function getBasePath(path: string): string {
  const locale = getRunbookLocaleFromPath(path);
  if (!locale) return path;
  return path.replace(`.${locale}.atrb`, ".atrb");
}

interface RunbookEntry {
  id: string;
  path: string;
  name: string;
}

type RunbookRecord<T extends RunbookEntry> = Record<string, T | undefined>;

/**
 * Filter runbooks to show only the current locale's variants.
 * For each set of locale variants sharing the same base path, keeps the
 * matching locale variant, or the base (English) if none matches.
 */
export function filterRunbooksByLocale<T extends RunbookEntry>(
  runbooks: RunbookRecord<T>,
  locale: string,
): RunbookRecord<T> {
  const entries = Object.entries(runbooks).filter(
    (entry): entry is [string, T] => entry[1] !== undefined,
  );
  const groups = new Map<string, Array<{ id: string; entry: T }>>();

  for (const [, rb] of entries) {
    const base = getBasePath(rb.path);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push({ id: rb.id, entry: rb });
  }

  const filtered: RunbookRecord<T> = {};

  for (const [, variants] of groups) {
    const match = variants.find((v) => getRunbookLocaleFromPath(v.entry.path) === locale);
    const keep = match ?? variants.find((v) => !getRunbookLocaleFromPath(v.entry.path)) ?? variants[0];
    if (keep) {
      filtered[keep.id] = keep.entry;
    }
  }

  return filtered;
}

/**
 * Resolve a runbook ID to the locale-appropriate variant.
 * Given any runbook ID and a locale, returns the ID of that runbook's
 * locale-specific version (or the original if no variant exists).
 */
export function resolveLocaleRunbookId<T extends RunbookEntry>(
  runbooks: RunbookRecord<T>,
  runbookId: string,
  locale: string,
): string {
  const rb = runbooks[runbookId];
  if (!rb) return runbookId;

  const base = getBasePath(rb.path);

  for (const [, other] of Object.entries(runbooks)) {
    if (!other) continue;
    if (getBasePath(other.path) === base) {
      if (getRunbookLocaleFromPath(other.path) === locale) {
        return other.id;
      }
    }
  }

  const baseRb = Object.values(runbooks).find(
    (r): r is T => !!r && getBasePath(r!.path) === base && !getRunbookLocaleFromPath(r!.path),
  );
  if (baseRb) return baseRb.id;

  return runbookId;
}
