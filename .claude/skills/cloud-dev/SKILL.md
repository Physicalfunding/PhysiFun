---
name: cloud-dev
description: >-
  クラウドセッション（CLAUDE_CODE_REMOTE=true）で Issue を開発するときに使う。
  Issue 番号を起点に、コンテキスト収集 → 区分の判定 → 実装計画（ここだけユーザーの OK を待つ）→ 実装 → 検証 →
  受け入れ要件の確認 → PR 作成（REST）→ PR の見張り → レビュー対応まで、それ以外はユーザーの返事を待たずに進める。
  🟢・🟡（.claude/cloud-allowlist の範囲）の Issue が対象。🔴が含まれるときは cloud-plan skill に切り替える。
  ローカルでは dev skill を使う。
---

# /cloud-dev — クラウドで Issue を PR まで進める

クラウドセッション（`CLAUDE_CODE_REMOTE=true`）で、🟢・🟡の Issue を実装して PR にする。
ユーザーはスマホから短い返事しかできないので、待つのは実装計画の OK だけにし、それ以外の質問・判断は PR body の「確認してほしい点」に書いて進める。マージはユーザーが行う。

ローカルでは `dev` skill を使う。PR body のテンプレート・検証が落ちたときの対処・指摘の分類など、`dev` と共通の参考情報は `dev` skill（`.claude/skills/dev/SKILL.md`）の該当手順を参照し、ここには書かない。

## 引数

```
/cloud-dev {Issue番号}
/cloud-dev          ← 番号なし
```

## 前提

| 項目 | 内容 |
|---|---|
| 許可範囲 | `.claude/cloud-allowlist`（`docs/guides/ai-harness.md` 4 章）。🔴（DB スキーマ・認証・`.claude/`・`.github/`・依存の追加・実行環境）は `cloud-scope-guard` hook と git hook が機械的に止める |
| ブランチ | セッションが用意した `claude/...` をそのまま使う |
| GitHub 操作 | `gh pr create` は使えない。Issue・PR・コメントは `gh api`（REST）か GitHub MCP で扱う |
| Docker | 使えない。infrastructure の結合テストは CI に任せる |
| ガードの位置づけ | うっかりを防ぐもので、セキュリティ境界ではない。最終防衛線はマージ前のユーザー確認 |

## フロー

### 1. 何をやるか確定

- **番号あり** → Issue を REST で読み、受け入れ要件（古い Issue では「受け入れ条件」）のチェックリストを控える。手順 8 で 1 項目ずつ確かめる

  ```bash
  gh api repos/Physicalfunding/PhysiFun/issues/{番号} --jq '.title, (.labels | map(.name)), .body'
  gh api repos/Physicalfunding/PhysiFun/issues/{番号}/comments --jq '.[] | .user.login + ": " + .body'
  ```

- **番号なし** → `issue` skill で Issue を作ってから進める（作成はユーザーの承認を得てから）

### 2. ブランチを整える

セッションが用意した `claude/...` ブランチをそのまま使い、最新の `origin/main` を取り込む。

```bash
git fetch origin main && git merge --no-edit origin/main
```

### 3. コンテキスト収集

`dev` skill の手順 3 と同じ（`CLAUDE.md`・`docs/README.md` から辿れる設計・関連コード）。
最新仕様（docs-repository）が要るときは、Physicalfunding/docs-repository をセッションに追加する（`cloud-plan` skill の手順 2 と同じ。追加できなければ、読めなかったことを手順 5 の計画に書く）。
何を読んだかを簡潔に報告する。

### 4. 区分の判定

変更予定のファイルを許可リストで機械的に判定する。

```bash
ALLOWLIST=.claude/cloud-allowlist; source .claude/hooks/lib/allowlist.sh
printf '%s\n' <変更予定のパス...> | blocked_files   # 何か出たら🔴が含まれる
```

- 何も出なければ、そのまま手順 5 へ
- 🔴が含まれていたら、手順 5 の計画で次のどちらかを提案する
  - 🔴の部分を別 Issue に切り出し、残り（🟢・🟡）だけをこの Issue で進める
  - 全体を `cloud-plan` skill に回し、計画 PR にする

### 5. 質問と実装計画（ここだけユーザーの OK を待つ）

`dev` skill の手順 5 と同じ項目（変更ファイル・手順・設計方針・受け入れ要件との対応・差分の見込み）に、以下を足してまとめて出す。

- 仕様の曖昧な点や技術的な判断が必要な点（`dev` の手順 4）
- 手順 4 の判定結果（🔴が含まれるときはその扱いの提案）
- 読めなかった仕様があればそのこと

スマホから短く返せるように、質問は「A か B か」の形にし、推奨を先に書く。
**OK が出るまで実装しない。** 修正を頼まれたら直してもう一度出す。OK が出たあとはユーザーの返事を待たずに進める。

### 6. 実装

`dev` skill の手順 6 と同じ（lint-on-edit hook の指摘をその場で直す・型チェックが通る単位で進める・論理的な単位でコミットする・UseCase は `add-usecase` skill に従う）。

途中で `cloud-scope-guard` hook に書き込みを拒否された（🔴に触る必要が出た）とき:

1. 🔴の部分は `cloud-plan` skill で計画 PR にする
2. 残り（🟢・🟡）だけで Issue として成り立つなら、その範囲で手順 7 以降を進め、PR body の「確認してほしい点」に🔴を外したことと計画 PR の URL を書く
3. 成り立たなければ、ここまでの変更を commit せずに止め、計画 PR の URL と理由を報告して終わる

### 7. 検証（CI と同じ順序）

```bash
bun install --frozen-lockfile
bun run check       # lint → format:check → typecheck → test
bun run build
```

Docker が無いので infrastructure の結合テスト（`bun --filter @physifun/infrastructure test`）は CI に任せ、PR body の「確認方法」にそう書く。
失敗したときの対処は `dev` skill の手順 7 の表に従う。すべて green になるまで次に進まない。

### 8. 受け入れ要件の確認

手順 1 で控えた受け入れ要件を 1 項目ずつ確かめ、満たしているかと根拠（テスト名・コマンドの結果・変更したファイル）を書き出す（`dev` skill の手順 8 と同じ）。

- 満たしていない項目は手順 6 に戻って実装する（直したら手順 7 も通し直す）
- 満たせない項目（別 Issue に回す、など）は、ユーザーの返事を待たずに理由を PR body の「確認してほしい点」に書いて進める

### 9. 品質レビュー（自動）

Workflow ツールで `full-review` ワークフローを実行する（`dev` skill の手順 9 と同じ）。「要修正」は直して手順 7 を通し直す。「注意」は PR body に書いてユーザーの判断に委ねる。

### 10. PR 作成（承認は待たない）

1. `git status`・`git log origin/main..HEAD`・`git diff origin/main...HEAD --stat` でコミット忘れと変更の全体像を確かめる
2. PR body を `dev` skill の手順 10 のテンプレートで組み立てる。「確認してほしい点」には、ローカルならユーザーに聞いていたはずの質問・判断（手順 5 以降に出たもの、満たせない受け入れ要件、full-review の「注意」、🔴を外したこと）を書く。body は `/tmp/cloud-dev-{番号}-pr.md` に書いてから渡す（改行やバッククォートを崩さないため）
3. push して REST で PR を作る。タイトルは Issue のタイトルをそのまま使う

   ```bash
   git push -u origin HEAD
   gh api repos/Physicalfunding/PhysiFun/pulls \
     -f title="タイトル" -f head="$(git branch --show-current)" -f base=main \
     -F body=@/tmp/cloud-dev-{番号}-pr.md --jq '"\(.number) \(.html_url)"'
   ```

   GitHub MCP が使えるならそれで作ってもよい。push が git hook に止められたら🔴のファイルが混ざっているので、手順 6 の「拒否されたとき」に戻る

### 11. PR を見張る

PR のアクティビティを購読し（`subscribe_pr_activity`）、CI の失敗やレビューコメントが届いたら対応する。

- CI が落ちたら、ログを読んで直し、手順 7 を通して push する。直せなければ PR にコメントで理由を残す
- 購読が使えないときは、push の後に CI の結果を一度確かめる

  ```bash
  gh api repos/Physicalfunding/PhysiFun/commits/$(git rev-parse HEAD)/check-runs --jq '.check_runs[] | .name + ": " + (.conclusion // .status)'
  ```

### 12. 独立レビューと指摘への対応

1. `dev` skill の手順 13 と同じく、Agent tool でレビューをバックグラウンドで起動する（PR 番号と Issue 番号を渡し、実装者のコンテキストは引き継がない。受け入れ要件も別の目で確かめさせる）
2. 完了したら `dev` skill の手順 14 のコマンド（REST）で PR のコメント・レビューを取得する
3. 各指摘を `dev` skill の手順 15 の表（修正する / 見送る / 要確認）で分類する。分類の合意は待たない
   - **修正する** → 直して手順 7 を通し、`fix: レビュー指摘対応` でコミットして push する
   - **見送る**・**要確認** → 理由（要確認は判断してほしい点）を PR にコメントで残す

   ```bash
   gh api repos/Physicalfunding/PhysiFun/issues/{PR番号}/comments -F body=@/tmp/cloud-dev-{番号}-review.md --jq .html_url
   ```

   CodeRabbit の自動レビューが走る場合は、その指摘も同様に扱う

### 13. 報告

PR の URL と「確認してほしい点」（PR body に書いた内容の要約）を伝える。マージはユーザーが行う。

## 注意事項

- ユーザーの返事を待つのは手順 5 だけ。それ以外で聞きたくなったことは PR body の「確認してほしい点」か PR コメントに書いて進める
- `.claude/`・`CLAUDE.md`・`.github/`・DB スキーマ（`packages/infrastructure/atlas/`）・認証・依存の追加（`package.json`）は🔴。hook に止められる前に手順 4 で判定し、触らない計画にする。許可範囲を広げる変更はローカルで行う
- git hook を飛ばす操作（`--no-verify`・`commit -n`・`core.hooksPath` の変更）は `cloud-scope-guard` hook が拒否する。止められたら回避せず、手順 6 の「拒否されたとき」に従う
- クラウドからはリモートブランチを削除できず、fast-forward でない push も拒否される。履歴の書き換えはしない
- Stop hook（`verify-on-stop`）も `bun run check` を自動で実行するが、それに頼らず手順 7 で明示的に通す
