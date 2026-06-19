---
name: add-usecase
description: >-
  PhysiFun の application 層（packages/application）に UseCase を新規追加・変更するときに使う。
  Result 型エラー・ポート DI・併設ユニットテスト（必須）の規範手順とテンプレートを提供する。
  「ユースケース / UseCase を追加」「ビジネスロジックを足す」「application 層の実装」に該当する作業で参照すること。
---

# UseCase 追加手順（application 層）

PhysiFun の application 層に新しいユースケースを追加するときの規範手順。
規範実装は `packages/application/src/project/CreateProjectDraftUseCase.ts` を参照（最もシンプルで真似しやすい）。

## 大原則（守らないと CI / レビューで弾かれる）

- **UseCase は `Result<Output, Error>` を返す。例外を投げて制御フローに使わない**（`@physifun/domain` の `ok` / `err`）。
- **外部ライブラリ（Prisma / Supabase）に直接依存しない**。インフラはすべて **Port インターフェース**経由で注入する。
- **エラーは判別共用体**（`type` フィールド付き）。HTTP ステータスへの変換は呼び出し側（Route Handler）の責務。
- **ユニットテストは必須**。テストが無い／落ちる UseCase は「未完了」。これがループ／PR の終了条件（→ `verify-and-pr` skill）。
- ビジネスロジックを Route Handler や infrastructure に書かない。ロジックの置き場は UseCase とドメイン。

## ファイル配置・命名

`<context>` は `project` / `leader-application` / `account` などのドメイン文脈。

| 種別 | パス | 命名 |
|---|---|---|
| UseCase | `packages/application/src/<context>/<Verb><Noun>UseCase.ts` | `動詞+名詞+UseCase` |
| Port | `packages/application/src/<context>/ports/<Verb><Noun>Port.ts` | `名詞+Port` |
| テスト | `packages/application/src/<context>/__tests__/<Verb><Noun>UseCase.test.ts` | UseCase 名と一致 |
| 公開 | `packages/application/src/index.ts` に re-export | — |

## 手順

1. **Port を定義** — UseCase が必要とするデータ取得・永続化メソッドだけを `ports/` に宣言する。永続化は `Promise<void>`、取得は `Promise<T | null>` / `Promise<T[]>`。複数操作を不可分にしたい場合は `executeInTransaction(...)` のように 1 メソッドへまとめ、インフラ側で同一トランザクションにさせる。
2. **UseCase を実装** — 下のテンプレに沿う。入力検証 → ドメイン VO 生成（`.from()` / `.create()` の `Result` を必ず分岐）→ ドメイン操作 → Port で永続化 → `ok(output)`。
3. **テストを書く**（必須） — `__tests__/` にインメモリ Port 実装を置き、ハッピーパス + 全エラーケースを網羅。**早期 return のエラーでは Port が呼ばれていないこと**も検証する。
4. **index.ts に re-export** — UseCase 本体・Input/Output/Error 型・Port 型を公開する（他パッケージは `@physifun/application` から import する）。
5. **検証** — `verify-and-pr` skill の手順でローカル検証を通す。

## UseCase テンプレート

```ts
import { type Result, err, ok, /* 使うドメイン型 */ } from "@physifun/domain";
import type { DoSomethingPort } from "./ports/DoSomethingPort";

// ==================== 出力 DTO ====================
export interface DoSomethingOutput {
  readonly someId: string;
}

// ==================== エラー型（判別共用体） ====================
export type DoSomethingError =
  | { readonly type: "INVALID_INPUT" }
  | { readonly type: "NOT_FOUND" }
  | { readonly type: "DOMAIN_ERROR"; readonly domainError: SomeDomainError };

// ==================== 入力 DTO ====================
export interface DoSomethingInput {
  readonly accountId: string;
  // ...
}

// ==================== ユースケース ====================
/**
 * 〜するユースケース
 *
 * 処理フロー:
 * 1. 入力バリデーション（ドメイン VO 生成）
 * 2. 取得・存在チェック
 * 3. ドメイン操作
 * 4. 永続化
 */
export class DoSomethingUseCase {
  constructor(private readonly port: DoSomethingPort) {}

  async execute(
    input: DoSomethingInput
  ): Promise<Result<DoSomethingOutput, DoSomethingError>> {
    // 1. 入力バリデーション（VO の Result を必ず分岐）
    const idResult = AccountId.from(input.accountId);
    if (!idResult.ok) return err({ type: "INVALID_INPUT" });

    // 2. 取得・存在チェック
    const entity = await this.port.findById(input.accountId);
    if (!entity) return err({ type: "NOT_FOUND" });

    // 3. ドメイン操作（失敗は DOMAIN_ERROR に包む）
    const domainResult = SomeAggregate.doSomething(/* ... */);
    if (!domainResult.ok) {
      return err({ type: "DOMAIN_ERROR", domainError: domainResult.error });
    }

    // 4. 永続化 → 結果返却
    await this.port.save(domainResult.value);
    return ok({ someId: domainResult.value.id.toString() });
  }
}
```

## テストテンプレート（必須）

```ts
import { describe, it, expect, beforeEach } from "@jest/globals";
import { DoSomethingUseCase, type DoSomethingError } from "../DoSomethingUseCase";
import type { DoSomethingPort } from "../ports/DoSomethingPort";

// インメモリ Port 実装（呼び出しを記録して検証に使う）
class InMemoryDoSomethingPort implements DoSomethingPort {
  saved: SomeAggregate[] = [];
  async findById(id: string) { /* ... */ }
  async save(entity: SomeAggregate) { this.saved.push(entity); }
}

describe("DoSomethingUseCase", () => {
  let port: InMemoryDoSomethingPort;
  let useCase: DoSomethingUseCase;

  beforeEach(() => {
    port = new InMemoryDoSomethingPort();
    useCase = new DoSomethingUseCase(port);
  });

  it("正常系: 成功すると id が返る", async () => {
    const result = await useCase.execute({ accountId: VALID_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;            // narrowing イディオム
    expect(result.value.someId).toBeDefined();
    expect(port.saved).toHaveLength(1);
  });

  it("異常系: 不正入力で INVALID_INPUT、かつ save は呼ばれない", async () => {
    const result = await useCase.execute({ accountId: "not-a-uuid" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_INPUT");
    expect(port.saved).toHaveLength(0);   // 副作用が無いことを必ず確認
  });

  // … NOT_FOUND / DOMAIN_ERROR など全 type を網羅する
});
```

### テストの要点
- `@jest/globals` を import（CI は `bun test apps packages` で実行されるが jest 互換 API を使う）。
- AAA（Arrange / Act / Assert）。`expect(result.ok).toBe(...)` の直後に `if (!result.ok) return;` で型を絞る。
- 成功系では Port に正しい値が渡ったか（`port.saved[0]` の中身）まで検証する。
- 早期 return のエラーケースでは **副作用メソッドが呼ばれていないこと** をアサートする。

### このテストだけ素早く回す
```bash
bun test packages/application/src/<context>/__tests__/<Name>UseCase.test.ts
```

## 完了条件
- [ ] Port / UseCase / テストの 3 ファイルが揃っている
- [ ] `index.ts` に re-export 済み
- [ ] 上記テストが green、全エラー type を網羅
- [ ] `verify-and-pr` skill のローカル検証（typecheck / lint / test）を通過
