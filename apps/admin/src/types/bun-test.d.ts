/**
 * bun:test の最小 ambient 型宣言 (#147 / #166)
 *
 * apps/admin は bun-types / @types/bun を devDependency に入れていない。
 * `bun:test` 経由のモック API を使うテストだけのために型を補うためにここで宣言する。
 * 実装は bun ランタイムが提供するため、型シグネチャは使う範囲に限定する。
 */
declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const beforeEach: (fn: () => void | Promise<void>) => void;
  export const afterEach: (fn: () => void | Promise<void>) => void;
  export interface Matchers {
    toBe: (v: unknown) => void;
    toBeUndefined: () => void;
    toBeNull: () => void;
    toEqual: (v: unknown) => void;
    toContain: (v: unknown) => void;
    toBeGreaterThanOrEqual: (v: number) => void;
    not: Omit<Matchers, "not">;
  }
  interface ExpectFn {
    (v: unknown): Matchers;
    any: (constructor: unknown) => unknown;
  }
  export const expect: ExpectFn;
  export const mock: {
    module: (name: string, factory: () => unknown) => void;
  };
}
