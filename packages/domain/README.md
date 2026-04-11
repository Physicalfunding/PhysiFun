# @physifun/domain

PhysiFun のドメイン層。エンティティ・値オブジェクト・リポジトリインターフェース・ドメインサービスをここに集約する。

## スコープ

- `account/` — `Account`, `Role`
- `leader-application/` — `LeaderApplication`, `ApplicationMode`
- `project/` — `Project`, `ProjectPhase`, `PublishStatus`, `ProjectReviewFeedback`
- `recruitment/` — `Recruitment`, `RecruitmentSchedule`, `SupportTicket`
- `shared/` — `Result` 型、共通値オブジェクト

## 禁止事項

- 外部ライブラリ（Prisma, Supabase SDK, Next.js など）への依存を持ち込まない
- 具体的なインフラ実装を参照しない（リポジトリはインターフェースのみ）

詳細は `docs-repository/docs/202604_初回リリースに向けた計画/` 配下のドメインドキュメントを参照。

## 利用上の注意

- `package.json` の `main` / `types` は `./src/index.ts` を直接指している（Bun ワークスペース前提のソース直参照）
- そのため **Jest（ts-jest 経由でない場合）や Node.js 直接実行からは import 不可**
- 将来 Jest から参照する際は `moduleNameMapper` or `transform` で `@physifun/domain` を解決できるよう設定する必要あり
