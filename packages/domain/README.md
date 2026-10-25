# @physifun/domain

PhysiFun のドメイン層。エンティティ・値オブジェクト・リポジトリインターフェース・ドメインサービスをここに集約する。

## スコープ

- `account/` — `AccountId`, `PhoneNumber`（値オブジェクトのみの最小実装）
- `admin-account/` — `AdminAccount`（運営アカウント、独立アグリゲート）
- `leader-application/` — `LeaderApplication`, `LeaderApplicationStatus`, `ProjectDraft`
- `project/` — `Project`, `ProjectPhase`, `PublishStatus`, `ProjectReviewFeedback`
- `recruitment/` — `SupportRecruitment`（集約ルート）, `RecruitmentSchedule`（子）, `TimeRange`, `ScheduleDate`, `CapacityPerHour`, `ApprovalMode`, `RecruitmentType`
- `shared/` — `Result` 型、共通値オブジェクト（`ProjectCategory` / `ProjectLocation` / `SnsLinks`）

## 禁止事項

- 外部ライブラリ（Kysely, Supabase SDK, Next.js など）への依存を持ち込まない
- 具体的なインフラ実装を参照しない（リポジトリはインターフェースのみ）

設計は `docs/specs/02_domain-model.md` を参照。

## 利用上の注意

- `package.json` の `main` / `types` は `./src/index.ts` を直接指している（Bun ワークスペース前提のソース直参照）
- そのため Node.js 直接実行からは import 不可（bun / Vitest / Next.js など TypeScript を解決できる実行環境が必要）
