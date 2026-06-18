---
name: verify-and-pr
description: >-
  PhysiFun でコミット / PR の前にローカル検証（lint・format・typecheck・test・build を CI と一致させる）を行い、
  dev-rule の承認 → コミット → push → PR → CodeRabbit フローを実行するときに使う。
  「PR を作る」「コミットしたい」「CI を通したい」「リリース前チェック」「検証して」に該当する作業で参照すること。
---

# PR 前のローカル検証と承認フロー

## 考え方：検証が「終了条件」

**テスト・型・lint が通らない＝作業は完了していない。** 自分（または自走ループ）が「できた」と言える基準は、
CI と同じチェックがローカルで green になること。緑になって初めて人間の承認に進む。CI と乖離した手元 OK は信用しない。

## ローカル検証コマンド（CI と同じ順序）

`.github/workflows/ci.yml` のジョブ構成と一致させる。リポジトリのルートで実行する。

```bash
bun install --frozen-lockfile     # ロックファイル固定でインストール

bun run lint                      # ESLint（apps/web）           … ci: lint
bun run format:check              # Prettier チェック（自動修正はしない）… ci: format
bun run typecheck                 # 全パッケージ tsc --noEmit     … ci: typecheck
bun test apps packages            # ユニットテスト（jest/bun, e2e 除外）… ci: test
bun run build                     # web ビルド                    … ci: build
```

### Docker がある環境のみ（infrastructure 結合テスト）
```bash
bun --filter @physifun/infrastructure test   # Testcontainers + vitest … ci: test-infrastructure
```
> Testcontainers が PostgreSQL を起動するため **Docker が必要**。ローカルに Docker が無い場合はここだけ CI に委ねてよいが、その旨を PR / 報告に明記する。インフラ層（Prisma リポジトリ等）を変更したときは特に CI 結果を確認すること。

### よく使う絞り込み
```bash
bun test packages/application/src/<context>/__tests__/<Name>.test.ts   # 1 ファイルだけ
bun run typecheck                                                      # 型だけ先に確認
```

## 失敗したときの対応

| 失敗 | 対応 |
|---|---|
| `format:check` が落ちる | `bun run format`（`--write`）で自動整形 → 差分をコミット |
| `lint` が落ちる | 指摘箇所を修正。安易な `eslint-disable` は付けない |
| `typecheck` が落ちる | 型を直す。`any` / 非 null 断言での握りつぶし禁止 |
| `test` が落ちる | **実装かテストのどちらが正しいかを判断**してから直す。テストを通すためだけに期待値を緩めない |
| `build` が落ちる | サーバー / クライアント境界・env 参照位置を確認 |

すべて green になるまでコミットへ進まない。

## コミット規約

```
<種別>: <変更内容の要約>
```
種別: `feat` / `fix` / `refactor` / `docs` / `test` / `chore`（詳細は CLAUDE.md）

例:
```
feat: プロジェクト下書き作成ユースケースを追加
test: SubmitLeaderApplication のレート制限ケースを追加
```

## 承認 → push → PR フロー（.docs/dev-rule.md 準拠）

```
実装
  ↓ 上記ローカル検証（lint・format・typecheck・test・build）→ 失敗時は修正
  ↓ ★ユーザー（エンジニア）に承認を求める★   ← push 前に必須
  ↓ コミット → push（develop ブランチへ）
  ↓ PR 作成（下記テンプレ、関連 Issue を Closes で紐づけ）
  ↓ CodeRabbit 自動レビュー → 指摘を修正（コミット → push で再レビュー）
  ↓ 人間レビュー・承認
マージ
```

- **push / PR 作成はユーザー承認後に行う。勝手に push しない。**
- ブランチは `claude/<説明>-<セッションID>`。`main` へ直接コミットしない。
- PR は対応する Issue を紐づける。

### PR 本文テンプレ
```markdown
## 概要
<!-- 何をしたか（1〜3行） -->

## 変更内容
<!-- 変更したファイル・機能の箇条書き -->

## 確認方法
<!-- 動作確認の手順（実行したローカル検証コマンドと結果） -->

## 関連 Issue
<!-- Closes #番号 -->
```

## 完了条件
- [ ] ローカルで lint / format:check / typecheck / test / build が green
- [ ] （インフラ変更時）infrastructure 結合テストをローカル or CI で確認
- [ ] コミットメッセージが規約準拠
- [ ] ユーザー承認を得てから push / PR 作成
- [ ] PR に関連 Issue を紐づけ、CodeRabbit 指摘を解消
