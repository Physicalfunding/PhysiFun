/**
 * Result 型
 *
 * 成功値と失敗値を判別共用体で表現する。
 * `result.ok` の true/false で TypeScript の narrowing が効く。
 *
 * @example
 * ```ts
 * const r = doSomething();
 * if (r.ok) {
 *   use(r.value);
 * } else {
 *   handle(r.error);
 * }
 * ```
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * 成功値の Result を生成する。
 */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/**
 * 失敗値の Result を生成する。
 */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
