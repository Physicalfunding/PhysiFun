---
name: cloud-plan
description: >-
  クラウドセッション（CLAUDE_CODE_REMOTE=true）で、🔴（.claude/cloud-allowlist で拒否: Docker が要る DB スキーマ・マイグレーション・kysely の型、
  .github/、ガード（許可リスト・hooks・git hooks・settings・.git/））の変更を伴う依頼を受けたときに使う。
  調査して docs-repository の plans/ に実装計画を書き、docs-repository に PR を出す。
  変更先が許可リストで拒否されるとき、または cloud-scope-guard hook に書き込みを拒否されたときに参照すること。
  🟢・🟡だけで済む依頼は cloud-dev skill で PR まで進める。
---

# /cloud-plan — クラウドで🔴の実装計画を PR にする

クラウドセッション（`CLAUDE_CODE_REMOTE=true`）では、🔴のパス（`.claude/cloud-allowlist` で拒否。Docker が要る `packages/infrastructure/atlas/`・kysely の `types.ts`、`.github/`、許可リスト・`.claude/hooks/`・`.claude/git-hooks/`・`.claude/settings*.json`・`.git/`）を変更できない（`docs/guides/ai-harness.md` 4 章）。
その代わりに実装計画を書いて docs-repository に PR し、帰宅後にローカルの `/dev` で実装する。
🟢・🟡だけで済む依頼はこのスキルではなく `cloud-dev` skill で PR まで進める。

## 引数

```
/cloud-plan {Issue番号}
/cloud-plan        ← 番号なし
```

## 手順

### 1. Issue を確定する

- 番号あり → `gh api repos/Physicalfunding/PhysiFun/issues/{番号} --jq '.title, .body'` で要件を把握する（クラウドでは GraphQL 系の gh コマンドが使えないことがあるため REST を使う）
- 番号なし → `issue` skill で Issue を作る（ユーザーの承認を得てから）

### 2. docs-repository をセッションに追加する

クラウドの git 認証はセッションに付いた repo にしか効かないため、docs-repository は起動時には無い（SessionStart の出力に「付いていない」と出る）。

1. Physicalfunding/docs-repository をセッションに追加する（クラウドの repo 追加機能を使う）
2. 置かれた場所を確かめて、以降はそのパスを `$DOCS` として使う

```bash
DOCS=$(ls -d ../docs-repository 2>/dev/null || find / -maxdepth 4 -type d -name docs-repository -not -path '*/node_modules/*' 2>/dev/null | head -1)
git -C "$DOCS" remote -v   # Physicalfunding/docs-repository であることを確認
```

追加できないときは `DOCS` を使わず、計画書を `/tmp/plan-{番号}.md` に書いて手順 5 の Issue コメントで残す。最新仕様を読めなかったことを計画書の冒頭に書く。

### 3. コンテキストを集める

- `CLAUDE.md`（禁止事項・自律範囲）
- `docs/README.md` から辿れる設計（`docs/specs/01_system-architecture.md` など）
- `$DOCS/docs/` の該当仕様
- 関連する既存コード（`apps/`、`packages/`）

### 4. 計画書を書く

`$DOCS/plans/YYYY-MM-DD-{Issue番号}-{slug}.md`（日付は `date +%F`、slug は英語 kebab-case）

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

### 5. docs-repository に PR を出す

クラウドでは `gh pr create` が使えないため、PR とコメントは `gh api`（REST）で作る。ブランチは `claude/` で始める（クラウドからの push は `claude/` ブランチで確認済み）。

```bash
cd "$DOCS"
git switch -c claude/plan-{番号}-{slug}
git add plans/
git commit -m "docs: 実装計画 PhysiFun#{番号} {Issue タイトル}"
git push -u origin HEAD
gh api repos/Physicalfunding/docs-repository/pulls \
  -f title="docs: 実装計画 PhysiFun#{番号} {Issue タイトル}" \
  -f head="claude/plan-{番号}-{slug}" -f base=main \
  -f body="<Objective と Step の要約>" --jq .html_url
```

push または PR 作成ができないときは、計画書の本文を PhysiFun の Issue にコメントする：

```bash
gh api repos/Physicalfunding/PhysiFun/issues/{番号}/comments -F body=@<計画書のパス> --jq .html_url
```

### 6. 報告する

- 計画 PR の URL を PhysiFun の Issue にコメントする（`gh api repos/Physicalfunding/PhysiFun/issues/{番号}/comments -f body="実装計画: <URL>"`）
- ユーザーに、PR の URL・判断が必要な点・「帰宅後にローカルで `/dev {番号}` で実装」を伝える

## 注意事項

- このスキルの間は PhysiFun のコードを変更しない（🔴は `cloud-scope-guard` hook にも拒否される）
- 🟢・🟡（許可リストの範囲）だけで完結する依頼なら、このスキルは使わず `cloud-dev` skill で PR まで進める
- 🔴と🟢・🟡が混ざる Issue は、🔴の部分だけをこのスキルで計画 PR にし、残りは `cloud-dev` skill で進められないか検討する（`cloud-dev` の手順 4・6）
