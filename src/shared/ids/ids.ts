import { ulid } from "ulid";
import type { Id, IdKind } from "./ids.types.ts";

/**
 * Identifier prefixes for every entity kind exposed by the API.
 *
 * See `docs/design/conventions.md` for the rules that govern identifiers.
 */
export const ID_PREFIXES = {
  tenant: "ten",
  user: "usr",
  device: "dev",
  patient: "pat",
  appointment: "apt",
  visit: "vis",
  encounter: "enc",
  receipt: "rcp",
  payment: "pay",
  quote: "qt",
  eligibilityLookup: "elg",
  externalHerbalOrder: "xho",
  job: "job",
  event: "evt",
  offlineCommand: "cmd",
} as const;

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * Creates a new identifier for the given entity kind.
 *
 * @example Create a patient id
 * ```ts
 * import { newId } from "./ids.ts";
 *
 * const id = newId("patient"); // "pat_01J..."
 * ```
 */
export function newId<K extends IdKind>(kind: K, time?: number): Id<K> {
  return `${ID_PREFIXES[kind]}_${ulid(time)}` as Id<K>;
}

/**
 * Checks whether a value is a well-formed identifier of the given kind.
 *
 * Offline edge devices create identifiers themselves, so the server validates
 * the shape of client-supplied ids instead of trusting them.
 */
export function isId<K extends IdKind>(kind: K, value: unknown): value is Id<K> {
  if (typeof value !== "string") return false;
  const prefix = `${ID_PREFIXES[kind]}_`;
  return value.startsWith(prefix) && ULID_PATTERN.test(value.slice(prefix.length));
}
