# AI 開発ハーネス設計

> 作成: 2026-10-17 / 状態: P0〜P3 完了、P4 実装中
> 2026-10-17 改訂: main の変更（`.docs/` → `docs/` 再配置、Prisma 撤去、Vitest 統一、`packages/server-shared` 追加）に合わせて更新
> 対象: `.claude/`（skills・agents・workflows・hooks・settings）、ESLint、CI のうち AI 開発に関わる部分

---

## 1. 目的

Claude と開発するときの品質・安全を、**Claude の注意力ではなく仕組みで担保する**。
特に、スマホからクラウドセッションに頼んだ「誰も見ていない作業」でも事故が起きない状態にする。

## 2. 前提

| 項目 | 内容 |
|---|---|
| 開発体制 | 1 人＋Claude |
| ローカル | メイン。この Mac の Claude Desktop / CLI。ユーザーが画面の前にいる |
| クラウド | 外出時にスマホアプリから起動。ユーザーは画面を見ていない |
| クラウドの制約 | repo を clone するだけ。`~/.claude`（global 設定・プラグイン）、Obsidian、隣接 repo は見えない。**複数 repo を選んだセッションでは repo の hooks・permission が読まれない**。ファイル編集はモードに関係なく事前承認される。git の認証はセッションに付いた repo にしか効かない。`gh pr create` は使えない |

## 3. 設計原則

1. **決定論的なものに寄せる** — 「Claude にお願いするルール」より「通らないと先に進めない仕組み」（hook・ESLint・CI）を優先する。AI レビューは機械で判定できないものだけに使う。
2. **ルールの正は 1 か所** — アーキテクチャルールは ESLint、検証コマンドは `bun run check`、クラウドの許可範囲は `.claude/cloud-allowlist`。hook・skill・CI はそれを呼ぶだけにする。
3. **クラウドは許可リスト方式** — 許可したパス以外はすべて拒否。新しいディレクトリは自動的に拒否側に倒れる。
4. **必須の部分は repo 内で完結させる** — クラウドで効かない場所（`~/.claude` など）に頼らない。
5. **長く使う文書と一時的な計画を分ける** — PhysiFun には実装を理解・変更するために必要な文書（本書など）だけを置く。実装計画のようにその時点で使う文書は docs-repository の `plans/` に置く。本書の実装計画は `docs-repository/plans/2026-10-17-ai-harness.md`。

## 4. 実行環境ごとの自律範囲

| 区分 | ローカル | クラウド |
|---|---|---|
| 🟢 緑 | 通常フロー（push 前にユーザー承認） | **PR 作成まで自動**。マージはユーザー |
| 🟡 通常の機能実装 | 通常フロー | 調査・計画まで（計画書を docs-repository に PR） |
| 🔴 DB・認証・ガードレール・実行環境 | 通常フロー | 調査・計画まで（計画書を docs-repository に PR） |

### 緑（クラウドで書き込みを許可するパス）

```
docs/*
*.md
*/__tests__/*
*.test.ts
*.test.tsx
*.vitest.ts
tests/e2e/*
apps/*/src/components/*
apps/*/public/*
```

パターンは bash の `[[ path == pattern ]]` で評価する（`*` は `/` をまたいでマッチする）。path は repo ルートからの相対パス。

**常に拒否（緑に一致しても拒否が優先）**: `.claude/*`、`.github/*`、`CLAUDE.md`、`*/CLAUDE.md`

> 黄・赤の区別はクラウドでの扱いが同じなので仕組み上は持たない。参考として赤に当たるのは
> `packages/infrastructure/atlas/`、Kysely の生成型（kysely-codegen）、`apps/*/src/lib/auth.ts`、`middleware.ts`、
> `app/api/auth/`、`*Auth*Adapter.ts`、`.claude/`、`.github/workflows/`、`vercel.json`、`next.config.ts`、`app/api/cron/`。

## 5. 全体構成（どこで何が効くか）

| 層 | 仕組み | ローカル | クラウド | 役割 |
|---|---|---|---|---|
| 文脈 | `CLAUDE.md` | ✅ | ✅ | 前提・禁止事項・自律範囲の案内 |
| 手順 | skills（`dev` / `issue` / `add-usecase` / `cloud-plan`） | ✅ | ✅ | 定型作業の手順 |
| 専門レビュー | agents ＋ `full-review` workflow | ✅ | ✅ | 機械で判定できない観点（ビジネスロジックの置き場など） |
| 書き込み直後 | PostToolUse hook `lint-on-edit` | ✅ | ✅ | 書いたファイルに ESLint・Prettier |
| 書き込み直前 | PreToolUse hook `cloud-scope-guard` | 何もしない | ✅ | 緑以外への書き込み・commit・push を拒否 |
| 終了時 | Stop hook `verify-on-stop` | ✅ | ✅ | `bun run check` が通るまで完了させない |
| マージ前 | CI（GitHub Actions） | — | — | lint・format・typecheck・test・infra 結合テスト・build・e2e |
| 許可確認 | auto モード（`~/.claude/settings.json`） | ✅ | （クラウドは別仕様） | 確認の削減。危険な操作は deny ルールと hook で止める |

---

## 6. 段階的な導入計画

各段階は独立した PR にする。どこで止めても、そこまでの効果が残る順番にしている。

| 段階 | 依存 |
|---|---|
| P0 土台・すぐ効く改善 | なし |
| P1 クラウドのガード | P0 |
| P2 修理 | P0 |
| P3 ルールを CI に移す | P2 |
| P4 自律ループの強化 | P2・P3 |

### P0：土台・すぐ効く改善

**変更内容**

1. Issue `chore: Claude ハーネスの土台整備` を作り、`main` から `chore/{番号}-claude-harness-foundation` を切る。`feat/228-atlas-baseline` 上の未コミットのハーネス一式を stash で移す。
2. 親ディレクトリの git 管理外コピー `~/github/PhysiFun/.claude/` を削除する。コピーにしかない許可（`Bash(atlas version *)`、`Bash(docker run *)`）は repo の `.claude/settings.local.json` に移す（global gitignore で除外済み）。削除前にユーザーに再確認する。
3. 起動ディレクトリを `PhysiFun/PhysiFun` に統一する。`settings.json` に `additionalDirectories: ["../docs-repository"]` を追加する。
4. `~/.claude/settings.json` に `permissions.defaultMode: "auto"` を追加する（project 設定では auto を既定にできないため repo の外に書く）。repo の許可リストと deny ルールは保険として残す。
5. arch-guard の hook 登録を `settings.json` から外す（書式違反があり、出力も Claude に届かず効果がないため。P3 で lint-on-edit に置き換える）。外したあと `settings.json` が正しく読み込まれることを確認する。
6. 本書を CLAUDE.md の「ドキュメント一覧」に追加し、この PR でコミットする。

**完了条件**

- `feat/228` にハーネスの変更が残っていない
- `PhysiFun/PhysiFun` で起動したセッションで CLAUDE.md と skills が読み込まれている
- 普段の作業でファイル編集のたびに確認が出ない

### P1：クラウドのガード

**変更内容**

1. **`cloud-scope-guard.sh`（PreToolUse）** — `CLAUDE_CODE_REMOTE=true` のときだけ動く。それ以外は即 exit 0。
   - `Edit` / `Write` / `NotebookEdit`：対象パスが緑でなければ `permissionDecision: "deny"` を返し、理由に「クラウドでは編集できません。`cloud-plan` skill で計画書を PR にしてください」と書く。`..` を含むパスは拒否、repo 外は許可。
   - `Bash`：git hook を飛ばす操作（`--no-verify`、`git commit -n`、`core.hooksPath` の変更）を拒否する。commit・push の中身は判定しない（下の git hook が判定する）。
   - 許可リストは `.claude/cloud-allowlist`（1 行 1 パターン、`!` で始まる行は常に拒否、`#` はコメント）。判定は `.claude/hooks/lib/allowlist.sh` に置き、git hook と共有する。`.claude/` はクラウドから書けないので、AI が自分で範囲を広げることはできない。
   - 位置づけ：**うっかりを防ぐガードであり、悪意ある回避を防ぐセキュリティ境界ではない**。最終防衛線はマージ前のユーザー確認。
2. **`.claude/git-hooks/pre-commit`・`pre-push`（git hook）** — `cloud-setup.sh` がクラウドのときだけ PhysiFun に `core.hooksPath=.claude/git-hooks` を設定して有効にする（docs-repository には設定しないので、そちらへの push は止めない）。
   - pre-commit：stage されたファイルが緑でなければ commit を止める
   - pre-push：git が渡す「実際に push される ref とコミット」で判定する。既存のリモートブランチなら新しく送るコミットだけ、新しいブランチなら `origin/main` との共通の祖先からの差分を見る（判定の前に `origin/main` を fetch する。クラウドの clone ではローカルの `origin/main` が古いまま残っていて、main で進んだ変更まで数えてしまう誤検知があった）
   - **PreToolUse で判定しない理由**：PreToolUse はコマンド実行前に走るため、1 コマンドにまとめた書き込み＋commit を見られず、今いるブランチ以外の push も判定できなかった（P1 のクラウド確認で判明）
3. **`.claude/hooks/__tests__/cloud-scope-guard.test.sh`・`git-hooks.test.sh`** — 許可・拒否の代表パターンを JSON 入力で流して判定を確かめる。
4. **SessionStart hook（クラウドのみ）** — PhysiFun に `core.hooksPath=.claude/git-hooks` を設定し、依存パッケージをインストールし、docs-repository がセッションに付いているかを知らせる。docs-repository の clone はしない（下記「スパイクの結果」）。
5. **CLAUDE.md に「実行環境ごとの自律範囲」節を追加** — 本書 4 章の要約。hook に止められる前に Claude が判断できるようにする。
6. **`cloud-plan` skill**（組み込みの `/plan` コマンドとぶつからない名前にした） — 黄・赤の依頼をクラウドで受けたとき、Claude が docs-repository をセッションに追加し、調査して `plans/YYYY-MM-DD-{Issue番号}-{slug}.md` を書いて docs-repository に PR を出す（構成：依存グラフ＋Step ごとのコンテキスト）。PR とコメントは `gh api`（REST）で作る。PhysiFun の Issue に計画 PR の URL をコメントする。帰宅後に `/dev` で実装する。
7. クラウドセッションは **PhysiFun 単独で起動する**（複数 repo を選ぶと hooks が読まれないため）。docs-repository は必要になったときに Claude がセッションに追加する。

**スパイクの結果（2026-10-17）**

- クラウドの git 認証は**セッションに付いている repo にしか効かない**。SessionStart hook の素の `git clone` では docs-repository を取れなかった
- Claude がセッションの途中で docs-repository を追加すると、clone・push・PR 作成まで通った（`claude/` ブランチで確認。それ以外のブランチ名は未確認）
- クラウドでは `gh pr create` が使えない。PR は `gh api` の REST か GitHub MCP で作る
- PR を REST や MCP で作る場合も、事前に `git push` が必要なので、`cloud-scope-guard` の push ゲートで止まる。PR 作成コマンド自体の判定は補助的なもの

**クラウドでの確認結果（2026-10-17、#263・#274）**

- 途中で docs-repository を追加したあとも、PhysiFun の hooks は効き続ける。追加した repo は `../docs-repository`（`/home/user/docs-repository`）に置かれる
- クラウドで `bun install` は通る
- 赤のファイルの Edit 拒否、1 コマンドにまとめた書き込み＋commit の停止（pre-commit）、`--no-verify` の拒否、`cloud-plan` での計画 PR 作成、緑のファイルの PR 作成をすべて確認した
- クラウドからはリモートブランチを削除できない（`git push --delete` が HTTP 403）。同名ブランチへの fast-forward でない push も拒否される。検証用ブランチは毎回別名にし、片付けはローカルから行う

**完了条件**

- hook のテストで許可・拒否が期待どおり
- 実際のクラウドセッションで、赤のファイルの編集が拒否され、緑のファイルは PR まで進む
- クラウドセッションで、Claude が docs-repository を追加して読める

### P2：修理

**変更内容**

1. agents 4 つの frontmatter に `name` を追加する（無いと黙ってスキップされる）。`tools` から `Agent` を外す。`spec-finder` の参照パスを `../docs-repository/` に直す。
2. `full-review` workflow：レビュー観点が workflow のプロンプトと agents/*.md に重複している。`agent()` で agent 定義を指定できるなら、workflow 側は定義を呼ぶだけにする（指定できるかは実装時に確認する）。
3. ルート `package.json`：
   - `check` を新設：`lint` → `format:check` → `typecheck` → `test` を CI と同じ順で実行する
   - `lint` を web と admin の両方に広げる（admin の既存違反が多ければ修正は別 PR）
4. 古い記述の掃除：`.claude/` 内の `.docs/` 参照を新しい場所（`docs/product.md`、`docs/specs/01_system-architecture.md`、`docs/guides/dev-rule.md`、`docs/guides/db-migration.md`、`docs/guides/admin-setup.md`）に置き換える。agents・workflow の Prisma 前提の記述を Atlas＋kysely-codegen に直す。`add-usecase` に `verify-and-pr` 参照が残っていれば `bun run check` に置き換える。

**完了条件**

- `/agents` に 4 つの agent が表示される
- 小さな差分で `full-review` が完走する
- `bun run check` の中身が CI の lint・format・typecheck・test と一致する
- `grep -r verify-and-pr` が 0 件

### P3：ルールを CI に移す

**現状**：packages/ には ESLint が無い。既存の違反として、admin の Route Handler・コンポーネント約 12 ファイルが `lib/di/` を経由せず `@physifun/infrastructure` を直接 import している。web の `src/infrastructure/storage/ImageUploadService.ts` が apps 内で Supabase SDK を直接使っている。

**変更内容**

1. `@typescript-eslint/no-restricted-imports` で境界ルールを入れる（`allowTypeImports: true`。境界専用のプラグインは入れない）。

   | 対象 | 禁止 |
   |---|---|
   | infrastructure 以外すべて | `@supabase/*`、`@prisma/*`、`kysely`、`pg` |
   | `packages/domain` | 外部ライブラリ（next・react・zod・bcrypt・jose・resend など）、application・infrastructure |
   | `packages/application` | `@physifun/infrastructure`、DB ライブラリ |
   | apps の `lib/di/` 以外 | `@physifun/infrastructure` |
   | domain・application | `process.env`（`no-restricted-properties`） |

   ルートに `eslint.config.mjs` を置いて packages/ を対象にし、`bun run lint` で apps と packages の両方を検査する。ルートに `eslint` と `typescript-eslint`（TS を解析するため）を devDependency として追加する。
2. **ラチェット方式**：既存の違反ファイルは設定内に名前付きの例外リストとして明記する。新しい違反は CI で落ちる。違反の修正は別 Issue で進め、例外リストを縮めていく。
3. `arch-guard.sh` を削除し、**`lint-on-edit.sh`（PostToolUse、matcher `Edit|Write`）** に置き換える。stdin の JSON から `tool_input.file_path` を読み、`.ts`/`.tsx` なら Prettier で整形してから ESLint をかける。違反があれば **exit 2＋stderr** で Claude に返す。`if` は使わず拡張子はスクリプト内で判定する。`timeout` は秒単位で 60。
4. 「Route Handler にビジネスロジックを書かない」は機械判定できないので arch-reviewer に残す。

**完了条件**

- `packages/domain` で `zod` を import すると、ローカルでも CI でも lint が落ちる
- Claude のセッションで違反を書くと hook の指摘が Claude に届き、Claude が自分で直す
- `arch-guard.sh` が削除され、例外リストの中身が Issue に記録されている

### P4：自律ループの強化

**変更内容**

1. **`verify-on-stop.sh`（Stop hook）** — 終了しようとした時点で `bun run check` を実行し、失敗したら `decision: "block"` と失敗内容を返して作業を続けさせる。
   - 実行するのは「`origin/main` との差分（未 push のコミットと未コミットの変更）にコードの変更があり、前回の結果から差分が変わっている」ときだけ。クラウドで commit → push → PR を 1 ターンで進める場合も検証が走る。merge・rebase などの途中は何もしない。状態は `.claude/.state/`（gitignore する）に保存する。
   - 連続した差し戻しは 3 回まで。超えたら終了を許可し、**その差分では以後差し戻さない**（変更されたらまた検証する）。3 回目には「直せなければ報告して終了」と伝える。`stop_hook_active` も参照する。
   - infrastructure の結合テスト（Docker）と build は対象外にし、CI に任せる。
2. `pre-pr-check` workflow を削除する（lint・テストは Stop hook と CI で自動実行されるため）。
3. `dev` skill を更新する：手順 7 を `bun run check` に置き換え、Stop hook でも自動で走ると明記する。実行環境で分岐させる（ローカル：push 前に承認／クラウド：緑は PR まで自動、黄・赤は `cloud-plan` skill へ）。

**実測（2026-10-17、P2 で測定）**：`bun run check`（lint web・admin → format:check → typecheck → test 682 件）で約 11 秒。Stop hook では `bun run check` をそのまま実行する。

**完了条件**

- テストを壊した状態で完了を頼むと、Claude が直すまで終われない
- 質問に答えるだけのターンでは検証が走らない
- 直せない失敗では、3 回差し戻したあと失敗を報告して終わる

---

## 7. 対象外（別 Issue にする）

- 上流〜下流の skill の拡充 — 「同じ説明を Claude に 2〜3 回したら skill にする」方針で、必要になったものから作る
- e2e が main で恒常的に失敗している件（#234）
- 既存のアーキテクチャ違反の修正（P3 の例外リストの解消）
- SessionStart での文脈注入（CLAUDE.md で足りるため見送り）

---

## 用語集

| 用語 | 意味 |
|---|---|
| ハーネス | AI が正しく動くように周りに置く仕組み一式（手順書・検査・自動実行） |
| 決定論的 | 同じ入力なら毎回同じ判定になること。AI の判断と違い、ぶれない |
| hook | Claude の特定の操作（書き込み・終了など）をきっかけに必ず実行されるスクリプト |
| PreToolUse / PostToolUse | ツール（Edit・Bash など）を実行する直前／直後に走る hook |
| Stop hook | Claude が作業を終えようとした瞬間に走る hook。終了を差し戻せる |
| SessionStart hook | セッション開始時に走る hook |
| exit 2 | hook が「問題あり」を伝える終了コード。stderr の内容が Claude に届く |
| 許可リスト（allowlist） | 書かれたものだけ許可し、それ以外を全部拒否する方式 |
| ラチェット方式 | 既存の違反は例外として記録し、新しい違反だけを止めて、例外を徐々に減らすやり方 |
| auto モード | 分類器（別の AI）が操作の安全性を判断して、確認なしで通す許可モード |
| workflow | 複数の agent を動かす JavaScript の台本 |
| stash | 未コミットの変更を一時退避する git の機能 |
