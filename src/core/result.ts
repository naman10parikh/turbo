/**
 * Result<T,E> — the zero-dep discriminated union (energy `typescript.md` law, OPINION O-03).
 *
 * The Simplicity-First default: no `neverthrow` dependency for the CLI's own internals.
 * `try/catch` lives once, at a boundary, converting an unknown throw into a known error.
 * Every expected failure is an explicit, typed Result the caller MUST consume.
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = string> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return !r.ok;
}

/**
 * Convert a throwing async call into a Result at the boundary (the one legitimate try/catch).
 */
export async function fromPromise<T>(p: Promise<T>): Promise<Result<T, string>> {
  try {
    return ok(await p);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Convert a throwing sync call into a Result at the boundary.
 */
export function fromThrowable<T>(fn: () => T): Result<T, string> {
  try {
    return ok(fn());
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}
