# @physifun/application

PhysiFun のアプリケーション層（UseCase）。トランザクション境界・状態遷移・Outbox 書き込みをここで調停する。

## スコープ

`src/<context>/` に `XxxUseCase.ts` と、UseCase が依存する Port IF（`ports/`）を置く。

- `account/` — アクティベート・期限切れ PENDING アカウントの削除
- `leader-application/` — 応募送信・承認・却下
- `project/` — 作成・編集・公開申請・取り下げ・非公開化・運営審査
- `outbox/` — 運営アプリ向けの Outbox 参照 Port
- `shared/` — 層をまたいで使う型

> `recruitment/`（サポート募集）は未作成。#212 で追加予定。UseCase の追加手順は `.claude/skills/add-usecase/SKILL.md` を参照。

## 依存方針

- `@physifun/domain` の Entity / Repository インターフェースと、自身の `ports/` に依存する
- `@physifun/infrastructure` の実装クラスには依存しない（DI で受け取る）
- Next.js / Kysely / Supabase SDK を直接参照しない

レイヤー責務は `docs/specs/01_system-architecture.md` §4 を参照。

## 利用上の注意

- `package.json` の `main` / `types` は `./src/index.ts` を直接指している（Bun ワークスペース前提のソース直参照）
- Node.js 直接実行から import する際は TypeScript を解決できる実行環境（bun / Vitest / Next.js など）が必要
