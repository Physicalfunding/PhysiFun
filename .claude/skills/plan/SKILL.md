---
name: plan
description: >-
  クラウドセッションで、コード変更を伴う依頼（緑以外）を受けたときに使う。
  調査して docs-repository の plans/ に実装計画を書き、docs-repository に PR を出す。
  「クラウドで実装して」と頼まれたが変更先が .claude/cloud-allowlist の外にあるとき、
  または cloud-scope-guard hook に書き込みを拒否されたときに参照すること。
---

# /plan — クラウドで実装計画を PR にする

クラウドセッション（`CLAUDE_CODE_REMOTE=true`）では、緑以外のパスを変更できない（`docs/guides/ai-harness.md` 4 章）。
その代わりに実装計画を書いて docs-repository に PR し、帰宅後にローカルの `/dev` で実装する。

## 引数

```
/plan {Issue番号}
/plan              ← 番号なし
```

## 手順

### 1. Issue を確定する

- 番号あり → `gh issue view {番号}` で要件を把握する
- 番号なし → `issue` skill で Issue を作る（ユーザーの承認を得てから）

### 2. コンテキストを集める

- `CLAUDE.md`（禁止事項・自律範囲）
- `docs/README.md` から辿れる設計（`docs/specs/01_system-architecture.md` など）
- `../docs-repository/docs/` の該当仕様
  - `../docs-repository` が無いとき（SessionStart の clone 失敗）は、その旨を計画書の冒頭と最終報告に書く
- 関連する既存コード（`apps/`、`packages/`）

### 3. 計画書を書く

`../docs-repository/plans/YYYY-MM-DD-{Issue番号}-{slug}.md`（日付は `date +%F`、slug は英語 kebab-case）

```markdown
# 実装計画: PhysiFun#{番号} {Issue タイトル}

> **Objective:** （何を実現するか 1〜2 文）
> **Issue:** Physicalfunding/PhysiFun#{番号}
> **ブランチ案:** `type/{番号}-slug`

## 依存グラフ

（Step 間の依存を図で。並列可能な Step を明記）

## Step 1: （名前）

### コンテキスト
（関連ファイル・既存パターン・参照した仕様）

### 変更ファイル
- Create / Modify: `exact/path`

### 完了条件
- （テスト名と確認方法）

## 判断が必要な点
（ユーザーに確認したいこと。なければ省略）
```

- CLAUDE.md の禁止事項（レイヤー境界など）に沿った計画にする
- UseCase を追加するなら `add-usecase` skill の規範に合わせる

### 4. docs-repository に PR を出す

```bash
cd ../docs-repository
git switch -c claude/plan-{番号}-{slug}
git add plans/
git commit -m "docs: 実装計画 PhysiFun#{番号} {Issue タイトル}"
git push -u origin HEAD
gh pr create --repo Physicalfunding/docs-repository --base main \
  --title "docs: 実装計画 PhysiFun#{番号} {Issue タイトル}" --body "<Objective と Step の要約>"
```

push または PR 作成ができないときは、計画書の本文を PhysiFun の Issue にコメントする（`gh issue comment {番号} --body-file <計画書>`）。

### 5. 報告する

- 計画 PR の URL を PhysiFun の Issue にコメントする（`gh issue comment {番号} --body "実装計画: <URL>"`）
- ユーザーに、PR の URL・判断が必要な点・「帰宅後にローカルで `/dev {番号}` で実装」を伝える

## 注意事項

- このスキルの間は PhysiFun のコードを変更しない（`cloud-scope-guard` hook にも拒否される）
- 緑のパス（`docs/` など）だけで完結する依頼なら、このスキルは使わず通常どおり PR まで進めてよい
