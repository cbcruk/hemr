import type { ID_PREFIXES } from './ids.ts'

/** Name of an entity kind that has a prefixed identifier. */
export type IdKind = keyof typeof ID_PREFIXES

/** Prefix string used for a given entity kind, such as `pat` for patients. */
export type IdPrefix<K extends IdKind = IdKind> = (typeof ID_PREFIXES)[K]

/**
 * Opaque identifier of an entity of kind `K`, formatted as `<prefix>_<ULID>`.
 *
 * The brand keeps a patient id from being passed where a visit id is expected.
 */
export type Id<K extends IdKind> = `${IdPrefix<K>}_${string}` & { readonly __kind: K }
