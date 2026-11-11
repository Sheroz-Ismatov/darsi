import type { Prisma } from '@prisma/client';

type Snapshot = Record<string, Prisma.JsonValue>;

/**
 * Fields whose value differs between two snapshots, as the `before` / `after` pair of an audit
 * record. Only changed fields are written, so the journal shows what an edit really did.
 */
export function snapshotDiff<T extends Snapshot>(
  before: T,
  after: T,
): { fields: (keyof T)[]; before: Prisma.JsonObject; after: Prisma.JsonObject } {
  const fields = (Object.keys(after) as (keyof T)[]).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  const previous: Prisma.JsonObject = {};
  const next: Prisma.JsonObject = {};
  for (const field of fields) {
    previous[field as string] = before[field] ?? null;
    next[field as string] = after[field] ?? null;
  }
  return { fields, before: previous, after: next };
}

/** `date` columns come back as midnight UTC; the API speaks `YYYY-MM-DD`. */
export const toDateString = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

export const fromDateString = (value: string | null): Date | null =>
  value ? new Date(`${value}T00:00:00.000Z`) : null;
