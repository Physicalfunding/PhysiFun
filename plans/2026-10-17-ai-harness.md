# AI 開発ハーネス改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/guides/ai-harness.md` の P0〜P4 を実装し、Claude の品質・安全を hook・ESLint・CI で担保する。

**Architecture:** 段階ごとに 1 Issue・1 ブランチ・1 PR。各段階のブランチは `main` から切る（前段の PR が未マージなら前段のブランチから切る）。ルールの正は 1 か所に置く（境界ルール＝ESLint、検証＝`bun run check`、クラウド許可範囲＝`.claude/cloud-allowlist`）。hook は bash＋jq の小さなスクリプトで、stdin の JSON を読み、Claude Code の公式出力形式（PreToolUse の `permissionDecision`、Stop の `decision: "block"`、exit 2＋stderr）で返す。

**Tech Stack:** Claude Code 2.1.233（hooks / skills / agents / workflows）、bash、jq、Bun workspaces、ESLint 9（flat config）、typescript-eslint、Prettier 3、GitHub Actions

**Spec:** `docs/guides/ai-harness.md`

## Global Constraints

- 会話・ファイル・コミットメッセージは日本語。コミットは `<種別>: <要約>`、末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- 段階ごとに Issue を作り `chore/{番号}-{slug}` ブランチで作業する。**push・PR 作成はユーザー承認後**
- hook の入力は stdin の JSON（`jq -r '.tool_input.file_path'` など）。`args` と `if` は使わない
- hook の `timeout` は**秒単位**
- PostToolUse で Claude に伝えるときは exit 2＋stderr。stdout（exit 0）は Claude に届かない
- hook スクリプトは `#!/usr/bin/env bash`、jq を使う（ローカル `/usr/bin/jq`、クラウドにも導入済み）
- `git` でパスを取るときは必ず `git -c core.quotePath=false`（docs に日本語ファイル名があるため）
- 新しい依存はルートの `eslint` と `typescript-eslint` のみ（P3）。apps と同じメジャー（eslint `^9`）にする
- クラウド判定は `CLAUDE_CODE_REMOTE == "true"` のみ
- クラウドの許可パターン・常に拒否のパターンは spec 4 章の値をそのまま使う

## Review Focus

1. **repo 外・`..` を含むパス**：`file_path` が repo 外（例 `/tmp/x`）なら許可、`..` を含むなら拒否 → Task 5 のテスト `outside_repo_allowed` / `dotdot_denied`
2. **連結コマンド・`-am`**：`git add -A && git commit -m x`、`git commit -am x` も commit ゲートにかかる → Task 6 のテスト `chained_commit_checked` / `commit_am_checked`
3. **日本語ファイル名**：`docs/仕様.md` が緑として許可され、git の出力が八進エスケープにならない → Task 6 のテスト `japanese_path_allowed`
4. **git の状態が普通でない**：git repo でない・HEAD が無いとき、Stop hook は何もせず exit 0（永久に差し戻さない） → Task 14 のテスト `not_git_repo_noop`
5. **ESLint が無視するファイル**：`.next/` 配下や削除済みファイルに lint-on-edit が走っても exit 0 → Task 13 のテスト `ignored_file_noop` / `missing_file_noop`

---

## ファイル構成

| パス | 段階 | 責務 |
|---|---|---|
| `.claude/settings.json` | P0〜P4 | 許可・hook 登録・`additionalDirectories` |
| `.claude/cloud-allowlist` | P1 | クラウドで書き込みを許可するパターン（spec 4 章） |
| `.claude/hooks/cloud-scope-guard.sh` | P1 | PreToolUse：クラウドで緑以外の書き込み・commit・push を拒否 |
| `.claude/hooks/cloud-setup.sh` | P1 | SessionStart：クラウドで docs-repository を clone、`bun install` |
| `.claude/skills/plan/SKILL.md` | P1 | クラウドで黄・赤の依頼を計画書 PR にする手順 |
| `.claude/hooks/lint-on-edit.sh` | P3 | PostToolUse：書いた .ts/.tsx に Prettier＋ESLint |
| `.claude/hooks/verify-on-stop.sh` | P4 | Stop：`bun run check` が通るまで終了を差し戻す |
| `.claude/hooks/__tests__/lib.sh` | P1 | hook テスト用の最小アサート関数 |
| `.claude/hooks/__tests__/*.test.sh` | P1・P3・P4 | 各 hook のテスト |
| `.claude/hooks/__tests__/run-all.sh` | P1 | 全 hook テストの実行 |
| `eslint.config.mjs`（ルート） | P3 | packages/ の境界ルール |
| `apps/{web,admin}/eslint.config.mjs` | P3 | apps の境界ルール＋ラチェット例外 |
| `package.json`（ルート） | P2・P3 | `check` / `test` / `lint` |

### hook テストの共通インターフェース（Task 5 で作る）

`.claude/hooks/__tests__/lib.sh`:
- `run_hook <script_path> <json>` → グローバル変数 `OUT`（stdout）、`ERR`（stderr）、`CODE`（終了コード）を設定
- `assert_eq <name> <expected> <actual>` → 不一致なら `FAIL: <name>` を出して失敗数を加算
- `finish` → 失敗数が 0 なら `ok` を出して exit 0、それ以外は exit 1
- `edit <tool_name> <file_path>` → `{"tool_name":...,"tool_input":{"file_path":...}}` を出力
- `bash_cmd <command>` → `{"tool_name":"Bash","tool_input":{"command":...}}` を出力
- `stop <true|false>` → `{"stop_hook_active":...}` を出力

`.claude/hooks/__tests__/run-all.sh`：同ディレクトリの `*.test.sh` を順に実行し、1 つでも失敗したら exit 1。

---

## P0：土台・すぐ効く改善（PR 1）

### Task 1: Issue とブランチを作り、ハーネスの変更を移す

**Files:** 変更なし（git 操作のみ）

- [ ] **Step 1: Issue を作る（ユーザーに本文を見せて承認を得てから）**

```bash
gh issue create --title "chore: Claude ハーネスの土台整備" --label chore --body "<docs/guides/ai-harness.md の P0 を要約。完了条件を箇条書き>"
```

- [ ] **Step 2: 未コミットのハーネス変更を退避する**

```bash
git stash push -u -m "ai-harness" -- .claude CLAUDE.md docs/guides/ai-harness.md plans/2026-10-17-ai-harness.md
```

- [ ] **Step 3: main から新ブランチを切って戻す**

```bash
git switch main && git pull
git switch -c chore/{番号}-claude-harness-foundation
git stash pop
```

- [ ] **Step 4: 確認**

Run: `git status --short`
Expected: `.claude/` 配下、`CLAUDE.md`、`docs/guides/ai-harness.md`、`plans/2026-10-17-ai-harness.md` だけが変更として出る。`git switch feat/228-atlas-baseline && git status --short` で何も出ない（確認後 chore ブランチに戻る）。

### Task 2: `.claude/` を一本化し、settings を整える

**Files:**
- Delete: `~/github/PhysiFun/.claude/`（git 管理外）
- Modify: `.claude/settings.local.json`、`.claude/settings.json`、`CLAUDE.md`

- [ ] **Step 1: 親ディレクトリのコピーとの差分を確認する**

Run: `diff -r ~/github/PhysiFun/.claude ~/github/PhysiFun/PhysiFun/.claude`
Expected: `settings.local.json` の 2 行（`Bash(atlas version *)`、`Bash(docker run *)`）だけが違う。それ以外の差分が出たら止めてユーザーに報告する。

- [ ] **Step 2: 2 行を repo の `.claude/settings.local.json` の `permissions.allow` に追加する**

- [ ] **Step 3: ユーザーに削除の承認を得てから、親ディレクトリのコピーを削除する**

Run: `rm -r ~/github/PhysiFun/.claude`

- [ ] **Step 4: `.claude/settings.json` を変更する**

- `permissions.additionalDirectories: ["../docs-repository"]` を追加
- `hooks.PostToolUse` の arch-guard 登録を削除（`hooks` が空になるなら `hooks` キーごと削除）。`arch-guard.sh` 本体は P3 まで残す

- [ ] **Step 5: settings が読み込まれることを確認する**

Run: `jq . .claude/settings.json >/dev/null && echo valid`
Expected: `valid`
Run: `claude -p "何もせず ok とだけ返して" --debug 2>&1 | grep -i -E "settings.*(invalid|error)"`
Expected: 何も出ない

- [ ] **Step 6: CLAUDE.md を更新する**

- 「ドキュメント一覧」に `| docs/guides/ai-harness.md | AI 開発ハーネス設計（自律範囲・hooks・段階計画） |` を追加
- 「Hooks」節の `arch-guard.sh` の行を削除し、「P3 で lint-on-edit を導入予定（`docs/guides/ai-harness.md`）」と 1 行書く
- 「推奨事項」の Result 型のパスを `packages/domain/src/shared/result.ts` に直す

- [ ] **Step 7: コミット**

```bash
git add .claude CLAUDE.md docs/guides/ai-harness.md plans/2026-10-17-ai-harness.md
git commit -m "chore: Claude ハーネス一式と設計書を追加し settings を整理"
```

### Task 3: auto モードと起動ディレクトリ（repo の外）、PR

**Files:** Modify: `~/.claude/settings.json`（コミットしない）

- [ ] **Step 1: `~/.claude/settings.json` に `permissions.defaultMode: "auto"` を追加する**（既存の `permissions` があればマージ。ユーザーに差分を見せて承認を得る）

- [ ] **Step 2: 確認**

Run: `jq '.permissions.defaultMode' ~/.claude/settings.json`
Expected: `"auto"`

- [ ] **Step 3: ユーザーに案内する**：Desktop の新規セッションのフォルダを `~/github/PhysiFun/PhysiFun` にする。モード選択はフォルダごとに記憶されるので、そのフォルダで一度 auto を選ぶ。

- [ ] **Step 4: 完了条件を確認する**：`PhysiFun/PhysiFun` で起動した新しいセッションで、CLAUDE.md と skills（`dev` / `issue` / `add-usecase`）が読み込まれ、ファイル編集で確認が出ない（ユーザーに見てもらう）

- [ ] **Step 5: ユーザー承認後に push と PR 作成**（`dev` skill の PR テンプレート、`Closes #{番号}`）

---

## P1：クラウドのガード（PR 2）

最初にスパイク（Task 4）で docs-repository の clone と `bun install` を確かめる。**失敗したら Task 5 以降に進まず、ユーザーに報告して spec の代替案（GitHub 側ガード）で計画を作り直す。**

### Task 4: SessionStart の cloud-setup.sh とスパイク

**Files:**
- Create: `.claude/hooks/cloud-setup.sh`
- Modify: `.claude/settings.json`

**Interfaces:**
- Produces: SessionStart hook。stdout は Claude の文脈に入る（SessionStart は例外的に stdout が届く）

- [ ] **Step 1: Issue `chore: クラウドセッションのガード` とブランチ `chore/{番号}-cloud-guard` を作る**（Task 1 と同じ手順、main から）

- [ ] **Step 2: `.claude/hooks/cloud-setup.sh` を書く**

- `CLAUDE_CODE_REMOTE != "true"` なら exit 0
- `$CLAUDE_PROJECT_DIR/../docs-repository` が無ければ `git clone --depth 1 https://github.com/Physicalfunding/docs-repository.git "$CLAUDE_PROJECT_DIR/../docs-repository"`
- `bun install --frozen-lockfile`（`$CLAUDE_PROJECT_DIR` で実行）
- 結果を stdout に 1 行ずつ出す：`docs-repository: ok|failed`、`bun install: ok|failed`。失敗しても exit 0（セッションは止めない）

- [ ] **Step 3: settings.json に登録する**

```json
"SessionStart": [{ "matcher": "startup|resume", "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/cloud-setup.sh", "timeout": 300 }] }]
```

- [ ] **Step 4: ローカルで何もしないことを確認**

Run: `CLAUDE_PROJECT_DIR=$PWD bash .claude/hooks/cloud-setup.sh; echo "exit=$?"`
Expected: 出力なし、`exit=0`

- [ ] **Step 5: コミットし、ユーザー承認後にブランチを push する**

- [ ] **Step 6: スパイク — ユーザーに Claude GitHub App を docs-repository にもインストールしてもらい、PhysiFun 単独・このブランチでクラウドセッションを起動する**

Run: `claude --cloud "cloud-setup の出力を報告し、ls ../docs-repository/docs と bun run typecheck の結果を返して"`
Expected: `docs-repository: ok`、`bun install: ok`、`ls` に `mvp requirements ...`、typecheck 成功。どれか失敗なら止めてユーザーに報告する。

### Task 5: cloud-scope-guard.sh — 書き込みの判定

**Files:**
- Create: `.claude/cloud-allowlist`、`.claude/hooks/cloud-scope-guard.sh`、`.claude/hooks/__tests__/lib.sh`、`.claude/hooks/__tests__/run-all.sh`、`.claude/hooks/__tests__/cloud-scope-guard.test.sh`

**Interfaces:**
- Consumes: なし
- Produces:
  - `.claude/cloud-allowlist`：1 行 1 パターン（spec 4 章。`.docs/*` は削除済み）。`!` で始まる行は常に拒否、`#` 始まりと空行は無視。中身は spec 4 章の緑と常に拒否の行
  - `cloud-scope-guard.sh`：stdin に PreToolUse の JSON。拒否時は stdout に `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"<理由>"}}` を出して exit 0。許可時は何も出さず exit 0
  - 拒否理由の文言（固定）：`クラウドセッションでは <path> を編集できません（docs/guides/ai-harness.md 4 章）。plan skill で計画書を plans/ に書き、PR にしてください。`
  - スクリプト内の関数 `is_allowed <relpath>`：常に拒否に当たれば 1、緑に当たれば 0、どれでもなければ 1

- [ ] **Step 1: lib.sh と run-all.sh を書く**（上の「hook テストの共通インターフェース」どおり）

- [ ] **Step 2: 失敗するテストを書く**（`CLAUDE_CODE_REMOTE=true`、`CLAUDE_PROJECT_DIR=/repo` を設定して `run_hook`）

```bash
deny='"permissionDecision":"deny"'

run_hook "$G" "$(edit Edit /repo/docs/specs/README.md)";      assert_eq green_docs "" "$OUT"
run_hook "$G" "$(edit Write /repo/apps/web/src/components/Button.tsx)"; assert_eq green_component "" "$OUT"
run_hook "$G" "$(edit Edit /repo/packages/domain/src/project/__tests__/a.test.ts)"; assert_eq green_test "" "$OUT"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/atlas/schema.sql)"; assert_eq red_atlas 1 "$(grep -c "$deny" <<<"$OUT")"
run_hook "$G" "$(edit Edit /repo/packages/application/src/project/CreateProjectDraftUseCase.ts)"; assert_eq yellow_usecase 1 "$(grep -c "$deny" <<<"$OUT")"
run_hook "$G" "$(edit Edit /repo/CLAUDE.md)";                   assert_eq claude_md_denied 1 "$(grep -c "$deny" <<<"$OUT")"
run_hook "$G" "$(edit Edit /repo/.claude/skills/dev/SKILL.md)"; assert_eq dotclaude_md_denied 1 "$(grep -c "$deny" <<<"$OUT")"
run_hook "$G" "$(edit Write /repo/.claude/cloud-allowlist)";    assert_eq allowlist_denied 1 "$(grep -c "$deny" <<<"$OUT")"
run_hook "$G" "$(edit Edit /tmp/scratch.txt)";                  assert_eq outside_repo_allowed "" "$OUT"
run_hook "$G" "$(edit Edit /repo/docs/../packages/domain/src/a.ts)"; assert_eq dotdot_denied 1 "$(grep -c "$deny" <<<"$OUT")"
CLAUDE_CODE_REMOTE= run_hook "$G" "$(edit Edit /repo/packages/infrastructure/atlas/schema.sql)"; assert_eq local_noop "" "$OUT"
```

- [ ] **Step 3: 実行して失敗を確認**

Run: `bash .claude/hooks/__tests__/cloud-scope-guard.test.sh`
Expected: FAIL（スクリプトが無い）

- [ ] **Step 4: `cloud-scope-guard.sh` の Edit/Write/NotebookEdit 部分を実装する**

`tool_input.file_path`（NotebookEdit は `notebook_path`）を `$CLAUDE_PROJECT_DIR/` を剥がして相対化する。`..` を含めば拒否。repo 外なら許可。`is_allowed` は allowlist の各行を `[[ "$rel" == $pattern ]]` で評価する（常に拒否を先に評価）。

- [ ] **Step 5: テストが通ることを確認**

Run: `bash .claude/hooks/__tests__/cloud-scope-guard.test.sh`
Expected: `ok`

- [ ] **Step 6: コミット**

### Task 6: cloud-scope-guard.sh — commit・push・PR ゲート

**Files:**
- Modify: `.claude/hooks/cloud-scope-guard.sh`、`.claude/hooks/__tests__/cloud-scope-guard.test.sh`、`.claude/settings.json`

**Interfaces:**
- Consumes: Task 5 の `is_allowed`、拒否 JSON の形式
- Produces: `tool_name == "Bash"` の判定。拒否理由の文言：`クラウドセッションでは次のファイルを commit/push できません: <path,...>（docs/guides/ai-harness.md 4 章）。変更を取り消し、plan skill で計画書を PR にしてください。` 差分を計算できないとき：`origin/main との差分を計算できないため push を止めました。git fetch origin main を実行してから再試行してください。`

- [ ] **Step 1: 失敗するテストを追加する**（テスト内で `mktemp -d` に git repo を作り、`origin` として bare repo をぶら下げて `main` を push しておく。`CLAUDE_PROJECT_DIR` をその repo にする）

```bash
# docs/仕様.md だけを変更・stage
run_hook "$G" "$(bash_cmd 'git commit -m x')";                    assert_eq japanese_path_allowed "" "$OUT"
# packages/domain/src/a.ts を変更・stage
run_hook "$G" "$(bash_cmd 'git commit -m x')";                    assert_eq red_commit_denied 1 "$(grep -c "$deny" <<<"$OUT")"
run_hook "$G" "$(bash_cmd 'git add -A && git commit -m x')";      assert_eq chained_commit_checked 1 "$(grep -c "$deny" <<<"$OUT")"
# packages/domain/src/a.ts を unstaged で変更
run_hook "$G" "$(bash_cmd 'git commit -am x')";                   assert_eq commit_am_checked 1 "$(grep -c "$deny" <<<"$OUT")"
# 緑だけのコミットを積んだ状態
run_hook "$G" "$(bash_cmd 'git push -u origin HEAD')";            assert_eq green_push_allowed "" "$OUT"
run_hook "$G" "$(bash_cmd 'gh pr create --title t --body b')";    assert_eq green_pr_allowed "" "$OUT"
# 赤を含むコミットを積んだ状態
run_hook "$G" "$(bash_cmd 'git push')";                           assert_eq red_push_denied 1 "$(grep -c "$deny" <<<"$OUT")"
# origin を削除した状態
run_hook "$G" "$(bash_cmd 'git push')";                           assert_eq no_origin_denied 1 "$(grep -c 'git fetch origin main' <<<"$OUT")"
run_hook "$G" "$(bash_cmd 'git status')";                         assert_eq other_bash_noop "" "$OUT"
```

- [ ] **Step 2: 実行して失敗を確認**（Expected: 上の新規テストが FAIL）

- [ ] **Step 3: Bash 部分を実装する**

`command` に `git commit` を含む → `git -c core.quotePath=false diff --name-only HEAD`（staged と unstaged の両方）。`git push` または `gh pr create` を含む → `git -c core.quotePath=false diff --name-only origin/main...HEAD`（失敗したら差分計算不可の拒否）。各パスを `is_allowed` にかけ、外れたものを列挙して拒否する。

- [ ] **Step 4: テストが通ることを確認**（`bash .claude/hooks/__tests__/run-all.sh` → `ok`）

- [ ] **Step 5: settings.json に登録する**

```json
"PreToolUse": [{ "matcher": "Edit|Write|NotebookEdit|Bash", "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/cloud-scope-guard.sh", "timeout": 30 }] }]
```

- [ ] **Step 6: コミット**

### Task 7: CLAUDE.md の自律範囲と plan skill、クラウドでの確認、PR

**Files:**
- Modify: `CLAUDE.md`
- Create: `.claude/skills/plan/SKILL.md`

**Interfaces:**
- Produces: skill 名 `plan`（P4 の `dev` skill から参照する）。出力ファイル `plans/{Issue番号}-{slug}.md`

- [ ] **Step 1: CLAUDE.md に「実行環境ごとの自律範囲」節を追加する** — spec 4 章の表をそのまま載せ、「クラウドかどうかは環境変数 `CLAUDE_CODE_REMOTE` で判断する」「黄・赤をクラウドで頼まれたら `plan` skill を使う」「クラウドは PhysiFun 単独で起動する」を書く。Hooks 節に cloud-scope-guard と cloud-setup を追加する。

- [ ] **Step 2: `.claude/skills/plan/SKILL.md` を書く**

- frontmatter：`name: plan`、`description` は「クラウドセッションで、コード変更を伴う依頼（緑以外）を受けたときに使う。調査して plans/ に実装計画を書き、PR にする。」
- 手順：Issue を確認（無ければ `issue` skill で作る）→ CLAUDE.md・`docs/`・`../docs-repository/` と関連コードを読む → `plans/{Issue番号}-{slug}.md` を既存 `plans/sp3-66-admin-applications-list-detail.md` の構成（Objective／Branch／依存グラフ／Step ごとのコンテキスト・変更ファイル・完了条件）で書く → クラウドが用意したセッションのブランチ（`claude/...`）のまま commit・push・PR（タイトル `docs: 実装計画 #{番号} <Issue タイトル>`）→ PR URL と「帰宅後に `/dev {番号}` で実装」を報告
- `../docs-repository` が無いときは、その旨を計画書の冒頭と報告に明記する

- [ ] **Step 3: コミットし、ユーザー承認後に push する**

- [ ] **Step 4: クラウドで完了条件を確認する**（PhysiFun 単独・このブランチ）

Run: `claude --cloud "packages/infrastructure/atlas/schema.sql の末尾にコメントを 1 行足して commit して"`
Expected: 編集が拒否され、Claude が plan skill を案内する
Run: `claude --cloud "docs/specs/README.md の末尾に空行を足して PR を作って"`
Expected: PR まで作られる（確認後、その PR は閉じる）

- [ ] **Step 5: ユーザー承認後に PR 作成**

---

## P2：修理（PR 3）

### Task 8: agents を読み込まれるようにする

**Files:** Modify: `.claude/agents/{arch-reviewer,data-guardian,security-reviewer,spec-finder}.md`

- [ ] **Step 1: Issue `chore: ハーネスの修理（agents・workflow・check）` とブランチを作る**

- [ ] **Step 2: 4 ファイルの frontmatter に `name: <ファイル名から .md を除いたもの>` を追加し、`tools` から `"Agent"` を削除する**

- [ ] **Step 3: `spec-finder.md` の `docs-repository/` を `../docs-repository/` に置換する**

- [ ] **Step 4: 確認**

Run: `claude -p "利用できる subagent の名前を 1 行ずつ列挙して" 2>&1 | grep -c -E "arch-reviewer|data-guardian|security-reviewer|spec-finder"`
Expected: `4` 以上（出ない場合は `claude --debug` のログで agent の読み込みエラーを確認）

- [ ] **Step 5: コミット**

### Task 9: full-review のプロンプト重複を解消する

**Files:** Modify: `.claude/workflows/full-review.js`

- [ ] **Step 1: 3 つのレビューの `agent()` プロンプトを「`.claude/agents/<name>.md` を読み、その指示に従って次のファイルをレビューしてください」＋対象ファイル一覧＋出力形式だけに置き換える**（検査項目の重複記述を削除）。`meta` と `phase()` は変えない

- [ ] **Step 2: 確認** — 小さな差分（例：`packages/domain` の任意ファイルにコメント 1 行）を作り、Claude に「`/full-review` を実行して」と頼む。Expected: 3 フェーズが完走し「判定: PASS / 要修正」を含む統合レポートが返る。差分は戻す

- [ ] **Step 3: コミット**

### Task 10: `bun run check` と古い記述の掃除、PR

**Files:**
- Modify: `package.json`、`.claude/skills/{add-usecase,dev}/SKILL.md`、`.claude/agents/*.md`、`.claude/workflows/full-review.js`、`CLAUDE.md`

**Interfaces:**
- Produces: `bun run check`（P3 の lint 拡張、P4 の Stop hook が使う）。中身は `bun run lint && bun run format:check && bun run typecheck && bun run test`

- [ ] **Step 1: `package.json` の scripts を変更する**

- `"lint": "bun --filter '@physifun/{web,admin}' lint"`
- `"check": "bun run lint && bun run format:check && bun run typecheck && bun run test"`

- [ ] **Step 2: 確認**

Run: `bun run check; echo "exit=$?"`
Expected: `exit=0`。所要時間を記録し、30 秒程度を大きく超えるなら ledger に記録して P4 の Stop hook の対象を変更のあるパッケージに絞る

- [ ] **Step 3: 古い参照を置き換える**

- `add-usecase/SKILL.md` の `verify-and-pr` 3 か所 → `bun run check`（「`dev` skill の手順 7」）
- `dev/SKILL.md` 手順 7 のコマンド列 → `bun run check`＋（Docker があれば）infra 結合テスト。description の「旧 verify-and-pr skill の検証フローを内包している。」を削除
- CLAUDE.md の「コマンド」に `bun run check   # CI と同じ検証（lint/format/typecheck/test）` を追加
- `.claude/` 内の `.docs/` 参照を置き換える：`.docs/structure.md`・`.docs/tech.md` → `docs/specs/01_system-architecture.md`、`.docs/product.md` → `docs/product.md`、`.docs/dev-rule.md` → `docs/guides/dev-rule.md`、`.docs/db-migration-kysely-atlas.md` → `docs/guides/db-migration.md`、`.docs/admin-role-setup.md` → `docs/guides/admin-setup.md`、`.docs/requirements.md`・`.docs/design.md` の行は削除
- `data-guardian.md` と `full-review.js` の Prisma 前提（`schema.prisma`、手書き Kysely 型）を、スキーマの正本 `packages/infrastructure/atlas/schema.sql` と kysely-codegen 生成型に直す

- [ ] **Step 4: 確認**

Run: `grep -rn -E 'verify-and-pr|\.docs/|schema\.prisma' .claude CLAUDE.md | wc -l`
Expected: `0`

- [ ] **Step 5: コミットし、ユーザー承認後に push・PR**

---

## P3：ルールを CI に移す（PR 4）

### Task 11: packages/ の境界ルール

**Files:**
- Create: `eslint.config.mjs`（ルート）
- Modify: `package.json`（devDependencies と `lint`）、`bun.lock`

**Interfaces:**
- Produces: ルートの ESLint 設定（対象は `packages/**/*.{ts,tsx}`）。ルール ID は `@typescript-eslint/no-restricted-imports` と `no-restricted-properties`

- [ ] **Step 1: Issue `chore: アーキテクチャ境界ルールを ESLint に移す` とブランチを作る**

- [ ] **Step 2: 依存を追加する**

Run: `bun add -d eslint@^9 typescript-eslint`

- [ ] **Step 3: 失敗するプローブを確認する**（設定前なので「ルールが効いていない」ことを確認）

Run: `echo "import { z } from 'zod';" | bunx eslint --stdin --stdin-filename packages/domain/src/probe.ts; echo "exit=$?"`
Expected: `exit=0` か設定ファイル無しのエラー（＝まだ止まらない）

- [ ] **Step 4: ルート `eslint.config.mjs` を書く**

typescript-eslint の parser を `packages/**/*.{ts,tsx}` に適用し、spec P3 の表どおりに 3 つのブロックを置く（`allowTypeImports: true`）。
- 全 packages（infrastructure を除く）：`@supabase/*`、`@prisma/*`、`kysely`、`pg`
- `packages/domain/**`：上に加えて `next`、`next/*`、`react`、`zod`、`bcrypt*`、`jose`、`resend`、`@physifun/application`、`@physifun/infrastructure`
- `packages/application/**`：`@physifun/infrastructure`
- `packages/{domain,application}/**`：`no-restricted-properties` で `process.env`
- テストファイル（`**/__tests__/**`、`*.test.ts`、`*.vitest.ts`）は境界ルールの対象外

- [ ] **Step 5: プローブで効いていることを確認する**

```bash
p() { echo "$1" | bunx eslint --stdin --stdin-filename "$2" >/dev/null 2>&1; echo $?; }
p "import { z } from 'zod';"                       packages/domain/src/probe.ts          # 期待: 1
p "import type { Kysely } from 'kysely';"          packages/application/src/probe.ts     # 期待: 0（型 import は許可）
p "import { db } from '@physifun/infrastructure';" packages/application/src/probe.ts     # 期待: 1
p "const x = process.env.FOO;"                     packages/domain/src/probe.ts          # 期待: 1
p "import { Kysely } from 'kysely';"               packages/infrastructure/src/probe.ts  # 期待: 0
```

- [ ] **Step 6: `lint` に packages を加える**：`"lint": "bun --filter '@physifun/{web,admin}' lint && eslint packages"`

- [ ] **Step 7: 確認**（Run: `bun run lint` → 既存コードで違反ゼロなら exit 0。違反が出たら Task 12 の例外リストに載せる）

- [ ] **Step 8: コミット**

### Task 12: apps の境界ルールとラチェット例外

**Files:** Modify: `apps/web/eslint.config.mjs`、`apps/admin/eslint.config.mjs`

- [ ] **Step 1: 両方の設定に `src/**/*.{ts,tsx}` 向けブロックを追加する**：`@typescript-eslint/no-restricted-imports` で `@supabase/*`、`@prisma/*`、`kysely`、`pg`、`@physifun/infrastructure` を禁止（`allowTypeImports: true`）。`src/lib/di/**` と テストファイルは対象外

- [ ] **Step 2: 違反を洗い出す**

Run: `bun run lint 2>&1 | grep -B1 no-restricted-imports | grep -E '^/' | sort -u`
Expected: 違反ファイルの一覧（調査時点では admin の約 12 ファイルと `apps/web/src/infrastructure/storage/ImageUploadService.ts`。型 import のみのものは出ない）

- [ ] **Step 3: Issue `refactor: アーキテクチャ境界違反の解消（ラチェット例外）` を作り、一覧を本文に貼る**（ユーザー承認後）

- [ ] **Step 4: 一覧を各設定の `ignores` に名前付きで載せる**：ブロックの直前に `// ラチェット例外: #{Issue番号} で解消する。新規追加禁止` とコメントする

- [ ] **Step 5: 確認**

Run: `bun run lint; echo "exit=$?"` → `exit=0`
Run: `echo "import { createClient } from '@supabase/supabase-js';" | (cd apps/web && bunx eslint --stdin --stdin-filename src/app/page.tsx >/dev/null 2>&1; echo $?)` → `1`

- [ ] **Step 6: コミット**

### Task 13: lint-on-edit.sh で arch-guard を置き換える、PR

**Files:**
- Create: `.claude/hooks/lint-on-edit.sh`、`.claude/hooks/__tests__/lint-on-edit.test.sh`
- Delete: `.claude/hooks/arch-guard.sh`
- Modify: `.claude/settings.json`、`CLAUDE.md`

**Interfaces:**
- Consumes: Task 5 の `lib.sh`、Task 11・12 の ESLint 設定
- Produces: PostToolUse hook。違反時は ESLint の出力（先頭 50 行）を stderr に出して exit 2。それ以外は exit 0

- [ ] **Step 1: 失敗するテストを書く**（テストは実 repo 上で、終了時に必ず消す一時ファイルを使う）

```bash
f=packages/domain/src/__hooktest__.ts
printf "import { z } from 'zod';\nexport const a = z;\n" > "$f"
run_hook "$H" "$(edit Edit "$PWD/$f")";              assert_eq violation_exit2 2 "$CODE"
assert_eq violation_message 1 "$(grep -c no-restricted-imports <<<"$ERR")"
printf "export const a = 1\n" > "$f"
run_hook "$H" "$(edit Edit "$PWD/$f")";              assert_eq clean_exit0 0 "$CODE"
assert_eq prettier_applied "export const a = 1;" "$(cat "$f")"
rm "$f"
run_hook "$H" "$(edit Edit "$PWD/$f")";              assert_eq missing_file_noop 0 "$CODE"
run_hook "$H" "$(edit Edit "$PWD/apps/web/.next/x.ts")"; assert_eq ignored_file_noop 0 "$CODE"
run_hook "$H" "$(edit Edit "$PWD/docs/specs/README.md")"; assert_eq non_ts_noop 0 "$CODE"
```

- [ ] **Step 2: 実行して失敗を確認**

- [ ] **Step 3: `lint-on-edit.sh` を実装する**

ファイルが無い・拡張子が `.ts`/`.tsx` でない・repo 外なら exit 0。`bunx prettier --write` の後、ESLint を設定の場所に合わせて実行する（`apps/web/*` は `apps/web` で、`apps/admin/*` は `apps/admin` で、それ以外は repo ルートで、`bunx eslint --no-warn-ignored <相対パス>`）。

- [ ] **Step 4: テストが通ることを確認**（`bash .claude/hooks/__tests__/run-all.sh` → `ok`）

- [ ] **Step 5: 登録して arch-guard を削除する**

```json
"PostToolUse": [{ "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/lint-on-edit.sh", "timeout": 60, "statusMessage": "Lint 実行中..." }] }]
```

`git rm .claude/hooks/arch-guard.sh`。CLAUDE.md の Hooks 節を更新する。

- [ ] **Step 6: 完了条件を確認する** — 新しいセッションで Claude に「`packages/domain/src/project` に zod を import する一時ファイルを作って」と頼み、hook の指摘を受けて Claude が自分で直すこと（または止めること）を見る。一時ファイルは消す

- [ ] **Step 7: コミットし、ユーザー承認後に push・PR**

---

## P4：自律ループの強化（PR 5）

### Task 14: verify-on-stop.sh

**Files:**
- Create: `.claude/hooks/verify-on-stop.sh`、`.claude/hooks/__tests__/verify-on-stop.test.sh`
- Modify: `.claude/settings.json`、`.gitignore`

**Interfaces:**
- Consumes: Task 10 の `bun run check`、Task 5 の `lib.sh`
- Produces: Stop hook。環境変数 `VERIFY_CMD`（既定 `bun run check`、テストで差し替える）。状態ファイル `$CLAUDE_PROJECT_DIR/.claude/.state/verify-last-ok`（成功時の差分ハッシュ）と `verify-blocks`（連続差し戻し回数）
- 差し戻し時の stdout：`{"decision":"block","reason":"bun run check が失敗しました（<n>/3 回目）。修正してから終了してください。\n<出力の末尾 80 行>"}`。3 回目の reason の先頭には「これが最後の差し戻しです。直せない場合は、失敗内容をユーザーに報告して終了してください。」を付ける

- [ ] **Step 1: Issue `chore: Stop hook で検証を強制` とブランチを作る**

- [ ] **Step 2: 失敗するテストを書く**（`mktemp -d` に git repo を作って初回コミットし、`CLAUDE_PROJECT_DIR` をそこにする）

```bash
blk='"decision":"block"'

run_hook "$V" "$(stop false)";                                         assert_eq no_changes_noop "" "$OUT"
echo x > docs.md;  VERIFY_CMD=false run_hook "$V" "$(stop false)";     assert_eq docs_only_noop "" "$OUT"
echo x > a.ts;     VERIFY_CMD=false run_hook "$V" "$(stop false)";     assert_eq fail_blocks 1 "$(grep -c "$blk" <<<"$OUT")"
VERIFY_CMD=false run_hook "$V" "$(stop true)";                         assert_eq second_block 1 "$(grep -c '2/3' <<<"$OUT")"
VERIFY_CMD=false run_hook "$V" "$(stop true)";                         assert_eq last_block_warns 1 "$(grep -c '最後の差し戻し' <<<"$OUT")"
VERIFY_CMD=false run_hook "$V" "$(stop true)";                         assert_eq fourth_allows "" "$OUT"
VERIFY_CMD=true  run_hook "$V" "$(stop false)";                        assert_eq pass_allows "" "$OUT"
VERIFY_CMD=false run_hook "$V" "$(stop false)";                        assert_eq same_hash_skips "" "$OUT"
cd "$(mktemp -d)" && CLAUDE_PROJECT_DIR=$PWD VERIFY_CMD=false run_hook "$V" "$(stop false)"; assert_eq not_git_repo_noop "" "$OUT"
```

- [ ] **Step 3: 実行して失敗を確認**

- [ ] **Step 4: `verify-on-stop.sh` を実装する**

git repo でなければ exit 0。`git -c core.quotePath=false status --porcelain` から `*.md`・`docs/*`・`plans/*` を除いた変更が無ければ exit 0。ハッシュは `git diff HEAD` と未追跡ファイル（`git ls-files -o --exclude-standard` の各ファイル内容）を `shasum` にかけたもの。`verify-last-ok` と一致すれば exit 0。`stop_hook_active` が false なら `verify-blocks` を 0 に戻す。`VERIFY_CMD` を実行し、成功ならハッシュを保存して回数を 0 にし exit 0。失敗なら回数を加算し、3 以下なら差し戻し JSON、4 以上なら何も出さず exit 0（回数を 0 に戻す）。

- [ ] **Step 5: テストが通ることを確認**（`bash .claude/hooks/__tests__/run-all.sh` → `ok`）

- [ ] **Step 6: 登録と gitignore**

```json
"Stop": [{ "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/verify-on-stop.sh", "timeout": 300, "statusMessage": "検証中（bun run check）..." }] }]
```

`.gitignore` に `.claude/.state/` を追加する。

- [ ] **Step 7: コミット**

### Task 15: pre-pr-check の削除と dev skill の更新、PR

**Files:**
- Delete: `.claude/workflows/pre-pr-check.js`
- Modify: `.claude/skills/dev/SKILL.md`、`CLAUDE.md`

- [ ] **Step 1: `git rm .claude/workflows/pre-pr-check.js`**

- [ ] **Step 2: `dev/SKILL.md` を更新する**

- 手順 7 に「Stop hook（`verify-on-stop`）でも終了時に自動で `bun run check` が走る」と追記
- 冒頭に「実行環境で分岐」節を追加：ローカルは現行どおり（push・PR 前にユーザー承認）。クラウド（`CLAUDE_CODE_REMOTE=true`）では、変更が緑だけなら手順 10 の承認を省いて PR 作成まで進め、緑以外なら `plan` skill に切り替える
- 手順 8 の `full-review` の記述はそのまま

- [ ] **Step 3: CLAUDE.md の Workflows 節から `pre-pr-check` を削除し、Hooks 節に `verify-on-stop` を追加する。Agents 節の「`full-review` / `pre-pr-check`」を「`full-review`」に直す**

- [ ] **Step 4: 完了条件を確認する** — 新しいセッションで、テストを 1 つわざと壊した状態で「完了して」と頼み、Claude が直すまで終われないことを確認。質問だけのターンで「検証中」が表示されないことを確認

- [ ] **Step 5: コミットし、ユーザー承認後に push・PR**
