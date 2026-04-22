/**
 * bun:test の最小 ambient 型宣言 (#147)
 *
 * apps/admin は bun-types / @types/bun を devDependency に入れていない。
 * `bun:test` 経由のモック API を使うテストだけのために型を補うためにここで宣言する。
 * 実装は bun ランタイムが提供するため、型シグネチャは使う範囲に限定する。
 */
declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const afterEach: (fn: () => void) => void;
  export const expect: (v: unknown) => {
    toBe: (v: unknown) => void;
    toBeUndefined: () => void;
  };
  export const mock: {
    module: (name: string, factory: () => unknown) => void;
  };
}
