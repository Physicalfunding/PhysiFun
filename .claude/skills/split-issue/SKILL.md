---
name: split-issue
description: >-
  親 Issue を読み、PR 1 本ずつのサブ Issue に分ける案を作り、ユーザーの確認を取ってから
  サブ Issue を作成して親 Issue につなぎ、親の本文にタスク一覧を書く。
  「Issue を分解して」「サブ Issue に分けて」「親 Issue を PR 単位に分けたい」に該当する作業で使う。
---

# /split-issue — 親 Issue をサブ Issue に分解する

PR 1 本では終わらない大きさの Issue（親 Issue）を、PR 1 本ずつのサブ Issue に分ける。
分け方と本文の書き方をそろえ、親子関係の付け忘れをなくすための手順。手本は #212 と #215〜#219。

## 引数

```
/split-issue {親 Issue 番号}
/split-issue          ← 番号なし
```

## 前提

- GitHub への操作はすべて `gh api`（REST）で行う。クラウドでは `gh issue view` などが使えないことがあり、親子をつなぐ API にはサブ Issue の `id`（Issue 番号とは別の数値）が要るため
- ファイルは変更しないので、ローカルでもクラウドでも同じ手順で使える

## 手順

### 1. 親 Issue を読む

- **番号なし** → 「分解する親 Issue の番号を教えてください。親 Issue が無ければ、先に `issue` skill で作ってください」と案内して**終了する**
- **番号あり** → 本文・コメント・すでにあるサブ Issue を読む

```bash
gh api repos/Physicalfunding/PhysiFun/issues/{親} --jq '.title, (.labels | map(.name)), .body'
gh api repos/Physicalfunding/PhysiFun/issues/{親}/comments --jq '.[] | .user.login + ": " + .body'
gh api repos/Physicalfunding/PhysiFun/issues/{親}/sub_issues --jq '.[] | "#\(.number) [\(.state)] \(.title)"'
```

- すでにサブ Issue があるときは、それと重ならないように分ける
- 要件が固まっていない（「要件は別途詰める」「未定」など）ときは、分解の前に決めることを質問する。推測で分けない

### 2. コンテキストを集める

親 Issue に挙がっているドキュメント・コードと、以下を読む。何を読んだかを簡潔に報告する。

- `CLAUDE.md` — 禁止事項（レイヤー境界）・実行環境ごとの自律範囲
- `docs/README.md` から辿れる設計（`docs/specs/01_system-architecture.md` のレイヤー責務、`docs/specs/` の該当箇所、`docs/product.md`）
- `../docs-repository/` の該当する機能仕様（クラウドで付いていなければ、Physicalfunding/docs-repository をセッションに追加する。追加できなければ、読めなかったことを手順 4 で伝える）
- 既存の似た実装（`packages/`・`apps/`）。サブ Issue の「参照」に書く参考実装を選ぶ

### 3. 分解案を作る

#### 分け方

- **PR 1 本 = サブ Issue 1 本**。差分 200〜300 行程度を目安にする（レビューしながら理解できる大きさ）。超えそうなら分ける
- 分け目は基本的にレイヤー。依存の向きどおりに着手順を決める
  - domain → application → infrastructure → web（薄い API ＋ UI）/ admin
  - DB スキーマの変更（`atlas/schema.sql`・マイグレーション）は、ほかと混ぜずに 1 本にする
  - 依存し合わないものは「並行可」とする
- サブ Issue ごとに、クラウドでの扱い（`CLAUDE.md` の「実行環境ごとの自律範囲」の 🟢 / 🟡 / 🔴）を決める。緑だけで済むもの（`docs/`・`apps/*/src/components/` など）を切り出しておくと、クラウドで PR まで進められる
- 記号は着手順に `A-1`, `A-2`, … と振る。すでにサブ Issue がある親を追加で分けるときは、次のアルファベット（`B-1`, …）にする

#### 各サブ Issue に決めること

| 項目 | 書き方 |
|---|---|
| 記号 | `A-1` など |
| タイトル | `type(scope): 要約 [#親 A-1]`。例: `feat(domain): サポート募集ドメイン層（エンティティ・VO・リポジトリIF）[#212 A-1]` |
| ラベル | `type` と同じ名前（種別は `issue` skill の表に従う） |
| 依存 | 先に終わっている必要があるサブ Issue |
| スコープ（In）/ スコープ外 | 置き場所のパスまで具体的に。隣のサブ Issue との境目をスコープ外に書く |
| 受け入れ要件 | 下記 |
| 実行環境 | 🟢 / 🟡 / 🔴 |

`scope` は主に変更するレイヤー・アプリ（`domain` / `application` / `infra` / `web` / `admin` / `db` / `docs` など）。

#### 受け入れ要件の書き方

`dev` skill は PR を出す前に、受け入れ要件を 1 項目ずつ確かめる。確かめられる形で書く。

- 1 項目に 1 つの条件。何で確かめるか（テスト・コマンド・画面での操作）が分かるように書く
  - 良い例: 「他人のプロジェクトの募集 API は 403 になる」「日付の重複が専用の例外に変わる（integration test で確認）」
  - 悪い例: 「きちんと動く」「使いやすい」
- 最後に「`bun run check` が緑」を入れる（infrastructure を触るなら integration test も）
- 親 Issue の受け入れ要件の各項目が、どれかのサブ Issue の受け入れ要件で満たされるようにする。どこにも対応しない項目が残ったら、サブ Issue を足すか、親に残す理由を手順 4 で伝える

### 4. ユーザーに確認する

作成前に以下を見せて確認を取る。**確認が取れるまで Issue を作らない。**

1. 分解の一覧表（記号・タイトル・ラベル・依存・実行環境）と着手順（例: A-1 → A-2 → A-3 → (A-4 / A-5 は並行可)）
2. 親の受け入れ要件とサブ Issue の対応表
3. 各サブ Issue の本文（手順 5 のテンプレート）
4. 親 Issue の本文の変更点（手順 6）

修正を頼まれたら直して、もう一度見せる。

### 5. サブ Issue を作る

着手順に 1 本ずつ作る。本文のテンプレート：

```markdown
親 Issue: #{親} のタスク **{記号}**（PR 1 本）。

## 概要
（この PR で何をするか 1〜3 文）

## 背景
（なぜこの単位か。前のサブ Issue との関係、合わせる既存パターン）

## 依存
- **#{番号}（{記号}）の完了が前提**（理由）

## スコープ（In）
- （作る・変えるもの。置き場所のパスまで）

## スコープ外
- （やらないこと。担当するサブ Issue の番号を添える）

## 注意
- （守ること・ハマりどころ）

## 受け入れ要件
- [ ] （手順 3 の書き方で）
- [ ] `bun run check` が緑

## 参照
- 参考実装: `path/to/similar/`
- 仕様: `docs/specs/...`
```

- 最初に着手するものは「依存」を省く。「注意」「参照」は書くことが無ければ省く
- ユーザーストーリーは親 Issue にあるので、サブ Issue には書かない
- 依存先の番号は、先に作ったサブ Issue の番号で埋める

本文は一時ファイルに書いてから渡す（改行やバッククォートを崩さないため）。

```bash
body=$(mktemp)
cat > "$body" <<'EOF'
（本文）
EOF
gh api repos/Physicalfunding/PhysiFun/issues \
  -f title="feat(domain): ... [#{親} A-1]" -f "labels[]=feat" -F body=@"$body" \
  --jq '"\(.number) \(.id) \(.html_url)"'
```

出力の番号と `id`（手順 6 で使う）を、記号ごとに控えながら進める。ラベルが未作成なら `gh label create` で先に作る（`issue` skill と同じ）。

### 6. 親 Issue につなぎ、本文を更新する

1. サブ Issue を親につなぐ（着手順に。`id` は手順 5 で控えた値）

   ```bash
   gh api repos/Physicalfunding/PhysiFun/issues/{親}/sub_issues -X POST -F sub_issue_id={id} --jq '.number'
   ```

2. 親 Issue の本文に「タスク」節を書く。すでにあれば置き換え、無ければ「受け入れ要件」の前に入れる。親の受け入れ要件に「サブ Issue に分ける」があればチェックを付ける

   ```markdown
   ## タスク（1 つが PR 1 本）

   - [ ] #{番号} **A-1 {短い名前}**（{一言}）
   - [ ] #{番号} **A-2 {短い名前}**（{一言}）

   順番は A-1 → A-2 → (A-3 / A-4 は並行可)
   ```

   緑以外のサブ Issue があれば、「実行環境の注意」として「クラウドでは `cloud-plan` skill で計画まで」と添える（#212 と同じ）。

   ```bash
   parent=$(mktemp)
   gh api repos/Physicalfunding/PhysiFun/issues/{親} --jq .body > "$parent"
   # $parent を編集する
   gh api repos/Physicalfunding/PhysiFun/issues/{親} -X PATCH -F body=@"$parent" --jq .html_url
   ```

3. 親のタイトルが `[親] ` で始まっていなければ付ける（同じ PATCH に `-f title="[親] ..."` を足す）

### 7. 結果を報告する

- 作ったサブ Issue の一覧（記号・番号・タイトル・URL）と着手順
- 親 Issue の URL（`gh api .../sub_issues` で、すべてつながっていることを確かめてから）
- 「`/dev {最初のサブ Issue の番号}` で着手できます」と案内する

## 注意事項

- 途中で失敗したら、手順 5 の控えと `gh api .../sub_issues` の一覧を突き合わせて、終わったところの続きから再開する。同じサブ Issue を二重に作らない
- 親 Issue は close しない。すべてのサブ Issue が終わり、親の受け入れ要件を満たしたらユーザーが閉じる
