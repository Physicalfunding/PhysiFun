# Physical Founding

## プロジェクト概要

お金ではなくスキルと時間でプロジェクトを支援するフィジカルファンディングプラットフォーム。
**現在地: 初回リリースに向けて開発中**（リーダー向け: 募集 LP・応募・審査・プロジェクト / サポート募集の準備）。次の段階は「一般公開」（サポーター向け）。詳細と実装状況は `docs/product.md`

---

## 開発ガイドライン

- 思考は英語、出力（会話・ファイル）は **日本語**
- ユーザーの指示に従い、不明点のみ質問して、それ以外は自律的に完遂する
- 既存コードを十分に読んでから変更を加える（推測で書かない）

---

## コマンド

```bash
bun install          # 依存関係インストール
bun dev              # 開発サーバー起動
bun run build        # ビルド
bun run lint         # Lint
bun run typecheck    # 型チェック
bun run test         # ユニットテスト（Vitest）
```

---

## ブランチ・コミット規約

```
ブランチ（ローカル）: type/{issue番号}-slug        ← /dev skill で自動提案
ブランチ（クラウド）: claude/<説明>-<セッションID>  ← クラウドセッションが作るブランチをそのまま使う
コミット: <種別>: <変更内容の要約>
```

| 種別 | 用途 |
|---|---|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `refactor` | リファクタ |
| `docs` | ドキュメント |
| `test` | テスト |
| `chore` | 設定・依存関係 |

---

## 禁止事項

- `infrastructure/` 以外で Supabase SDK・DB クライアント（Kysely）を直接呼ばない
- API Route Handler にビジネスロジックを書かない
- `domain/` に外部ライブラリへの依存を持ち込まない
- 不必要なファイル・関数・型を生成しない（過剰な抽象化をしない）

---

## 推奨事項

- 既存コードのパターンに合わせる（一貫性を保つ）
- エラーハンドリングは `Result` 型（`packages/domain/src/shared/result.ts`）を活用
- フォームバリデーションは Zod スキーマで定義
- セキュリティ: SQL インジェクション・XSS・認証バイパスに注意

---

## Skills（Claude 用手順書）

`.claude/skills/` 配下に、繰り返す定型作業の手順を Skill として用意している。
関連作業のときに自動でロードされる（常時読み込みの CLAUDE.md とは別レイヤー）。

| Skill | 用途 |
|---|---|
| `issue` | GitHub Issue 作成（種別・ラベル自動判定、ブランチ名提案） |
| `dev` | Issue → 実装 → 検証 → PR → レビュー → 修正の一貫開発フロー |
| `add-usecase` | application 層に UseCase を追加する（`Result` 型・Port DI・併設ユニットテスト必須の規範手順とテンプレート） |
| `plan` | クラウドで緑以外の依頼を受けたとき、実装計画を docs-repository の `plans/` に書いて PR にする |

## Agents（専門レビューエージェント）

`.claude/agents/` 配下に、品質レビュー用の専門エージェントを用意している。
`/dev` フロー内の品質レビューや、手動での `full-review` / `pre-pr-check` ワークフロー実行時に自動で呼ばれる。

| Agent | 用途 |
|---|---|
| `arch-reviewer` | アーキテクチャ境界検査（レイヤー違反・命名規則・依存方向） |
| `data-guardian` | DB スキーマ安全チェック（Prisma / Kysely 型整合・マイグレーションリスク） |
| `security-reviewer` | セキュリティ脆弱性検査（SQLi / XSS / 認証バイパス） |
| `spec-finder` | 設計資料横断検索（.docs/ / docs-repository/ を引用付きで回答） |

## Workflows（品質チェック自動化）

`.claude/workflows/` 配下に、複数エージェントを並列実行する品質チェックワークフローを用意している。

| Workflow | 用途 |
|---|---|
| `full-review` | arch-reviewer + security-reviewer + data-guardian を並列実行し、統合報告 |
| `pre-pr-check` | lint / format / typecheck / test / build + full-review を一括実行し、Go/No-go 判定 |

## Hooks（自動検査）

`.claude/hooks/` 配下。テストは `bash .claude/hooks/__tests__/run-all.sh`。

| Hook | 種類 | 用途 |
|---|---|---|
| `cloud-setup.sh` | SessionStart | クラウドのときだけ、PhysiFun に `core.hooksPath=.claude/git-hooks` を設定し、`bun install` し、docs-repository がセッションに付いているかを知らせる |
| `cloud-scope-guard.sh` | PreToolUse | クラウドのときだけ、`.claude/cloud-allowlist` 外への Edit/Write と、git hook を飛ばす操作（`--no-verify` など）を拒否する |
| `.claude/git-hooks/pre-commit`・`pre-push` | git hook | クラウドのときだけ、許可リスト外のファイルを含む commit と、それを含むコミットの push を止める（実際に commit・push される中身で判定） |

P3 で書き込み時の lint（`lint-on-edit`）を導入予定（`docs/guides/ai-harness.md`）。

---

## 実行環境ごとの自律範囲

クラウドセッションかどうかは環境変数 `CLAUDE_CODE_REMOTE`（クラウドでは `true`）で判断する。詳細は `docs/guides/ai-harness.md` 4 章。

| 区分 | ローカル | クラウド |
|---|---|---|
| 🟢 緑（`docs/`・`*.md`・テストのみ・`apps/*/src/components/`・`apps/*/public/`） | 通常フロー（push 前にユーザー承認） | PR 作成まで自動。マージはユーザー |
| 🟡 通常の機能実装 | 通常フロー | 調査・計画まで（`plan` skill） |
| 🔴 DB・認証・`.claude/`・`.github/`・実行環境 | 通常フロー | 調査・計画まで（`plan` skill） |

- クラウドで緑以外の依頼を受けたら、コードを書かずに `plan` skill で計画書を docs-repository に PR する
- 許可範囲の正は `.claude/cloud-allowlist`。`cloud-scope-guard` hook（書き込み時）と git hook（commit・push 時）が機械的に止める
- クラウドセッションは **PhysiFun 単独**で起動する（複数 repo を選ぶと repo の hooks が読み込まれず、ガードが効かない）
- 最新仕様（docs-repository）が必要になったら、Claude が Physicalfunding/docs-repository をセッションに追加する（クラウドの git 認証はセッションに付いた repo にしか効かないため、hook では clone できない）
- クラウドでは `gh pr create` が使えない。PR やコメントは `gh api`（REST）か GitHub MCP で作る

---

## 開発フロー・PR ルールの詳細

詳細は `docs/guides/dev-rule.md` を参照。

---

## ドキュメント一覧

ドキュメントの地図は **`docs/README.md`**。実装前に読むべきものは以下。

| ファイル | 内容 |
|---|---|
| `docs/product.md` | プロダクト方針・リリース計画・実装状況 |
| `docs/specs/01_system-architecture.md` | 技術スタック・ディレクトリ構成・レイヤー責務（設計の入口） |
| `docs/specs/` | ドメイン・データ・セキュリティ・主要フローの設計仕様 |
| `docs/guides/dev-rule.md` | 開発フロー・PR ルール・コーディング規約 |
| `docs/guides/db-migration.md` | DB スキーマ・マイグレーション運用ガイド（Kysely + Atlas。スキーマの正本は `atlas/schema.sql`） |
| `docs/guides/ai-harness.md` | AI 開発ハーネス設計（実行環境ごとの自律範囲・hooks・段階計画） |

> 用語: リリース段階は「初回リリース」「一般公開」と呼ぶ。古い Issue やコメントにある「Phase 1 / 2 / 3」の読み替えは `docs/product.md` を参照。
