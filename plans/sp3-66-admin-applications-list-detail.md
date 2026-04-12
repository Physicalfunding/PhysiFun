# Blueprint: #66 /admin/applications 一覧 + 詳細

> **Objective:** 運営が応募を確認・審査するための一覧/詳細画面を admin アプリに追加する。
>
> **Branch:** `feat/sp3-66-admin-applications-list-detail`
> **Base:** `main`
> **PR title:** `feat(admin): applications list + detail`

---

## 依存グラフ

```
Step 1 (共通基盤)
  ├── Step 2 (API: 一覧) ──┐
  │                         ├── Step 4 (UI: 一覧ページ)
  ├── Step 3 (API: 詳細) ──┤
  │                         └── Step 5 (UI: 詳細ページ)
  └─────────────────────────── Step 6 (トップページ更新 + 統合確認)
```

- Step 2, 3 は **並列可能**（互いに独立）
- Step 4, 5 は **並列可能**（別ページ）
- Step 6 は全ステップ完了後

---

## Step 1: 共通基盤 — レスポンスヘルパー + Prisma 読み取りアダプター

### コンテキスト

admin アプリにはまだ API レスポンスヘルパーがない（web アプリ側の `@/lib/api/response.ts` と同等のもの）。
また、LeaderApplication を Prisma で読み取るインフラアダプターも存在しない。

### タスク

- [ ] `apps/admin/src/lib/api/response.ts` を作成
  - web アプリの `apps/web/src/lib/api/response.ts` を **そのままコピー** する（共通パッケージ化は将来課題）
  - 型: `ApiErrorCode`, `ApiResponse<T>`, 関数: `successResponse`, `errorResponse`, `validationErrorResponse`, `unauthorizedResponse`, `forbiddenResponse`, `notFoundResponse`, `conflictResponse`, `unprocessableEntityResponse`, `internalErrorResponse`

- [ ] `packages/infrastructure/src/leader-application/PrismaLeaderApplicationQueryService.ts` を作成
  - **UseCase ではなく Query Service パターン** を採用する（一覧/詳細は読み取り専用で、ドメインロジックを通す必要がない CQRS の Q 側）
  - インターフェース定義は同ファイル内で行う（application 層に置くほどの複雑さがないため）
  - メソッド:
    ```typescript
    interface LeaderApplicationQueryService {
      /** 一覧取得（ステータスフィルタ + ページネーション） */
      findMany(params: {
        status?: "PENDING" | "APPROVED" | "REJECTED";
        page: number;      // 1-indexed
        perPage: number;    // デフォルト 20
      }): Promise<{ items: LeaderApplicationListItem[]; totalCount: number }>;

      /** 詳細取得 */
      findById(id: string): Promise<LeaderApplicationDetail | null>;
    }
    ```
  - `LeaderApplicationListItem` 型:
    ```typescript
    {
      id: string;
      accountId: string;
      displayName: string;       // Account.displayName
      email: string;             // Account.email
      projectTitle: string;
      status: "PENDING" | "APPROVED" | "REJECTED";
      submittedAt: Date;
      reviewedAt: Date | null;
    }
    ```
  - `LeaderApplicationDetail` 型:
    ```typescript
    {
      id: string;
      accountId: string;
      displayName: string;
      email: string;
      status: "PENDING" | "APPROVED" | "REJECTED";
      reviewerNote: string | null;
      projectTitle: string;
      projectSummary: string;
      projectStory: string;
      projectCategory: string;
      prefectureCode: string;
      municipality: string | null;
      plannedActivities: string;
      snsLinks: { x: string | null; instagram: string | null; facebook: string | null; website: string | null } | null;
      submittedAt: Date;
      reviewedAt: Date | null;
    }
    ```
  - Prisma 実装: `PrismaLeaderApplicationQueryService`
    - `findMany`: `prisma.leaderApplication.findMany` + `include: { account: { select: { displayName, email } } }` + count
    - `findById`: `prisma.leaderApplication.findUnique` + `include: { account: { select: { displayName, email } } }`
    - ソート: `submittedAt` 降順（新しいものが先頭）

- [ ] `packages/infrastructure/src/index.ts` に QueryService をエクスポート追加

### 検証

```bash
bun run typecheck
```

### 完了条件

- admin アプリに response ヘルパーが使える
- infrastructure パッケージから `PrismaLeaderApplicationQueryService` がインポート可能
- typecheck パス

---

## Step 2: API Route — 一覧 `GET /api/admin/applications`

### コンテキスト

Step 1 で作成した QueryService を使い、一覧 API を実装する。
ミドルウェアは `/api` パスを除外している（認証チェックなし）が、API 側で独自にセッション検証する。

### タスク

- [ ] `apps/admin/src/app/api/admin/applications/route.ts` を作成
  - `GET` ハンドラのみ
  - クエリパラメータ:
    - `status`: `"PENDING" | "APPROVED" | "REJECTED"` (省略時は全件)
    - `page`: number (デフォルト 1)
    - `perPage`: number (デフォルト 20, 上限 100)
  - セッション検証: `getToken()` で JWT 取得 → `roles` に ADMIN が含まれるか確認
  - 成功: `successResponse({ items, totalCount, page, perPage })`
  - エラー: `unauthorizedResponse()` / `validationErrorResponse()`

### 検証

```bash
bun run typecheck
```

### 完了条件

- `GET /api/admin/applications` が QueryService を呼び出して JSON を返す
- ADMIN ロールチェックが入っている
- typecheck パス

---

## Step 3: API Route — 詳細 `GET /api/admin/applications/[id]`

### コンテキスト

Step 1 の QueryService の `findById` を使い、詳細 API を実装する。

### タスク

- [ ] `apps/admin/src/app/api/admin/applications/[id]/route.ts` を作成
  - `GET` ハンドラのみ
  - パスパラメータ: `id` (string)
  - セッション検証: Step 2 と同様
  - 成功: `successResponse(detail)`
  - エラー: `unauthorizedResponse()` / `notFoundResponse("応募")`

### 検証

```bash
bun run typecheck
```

### 完了条件

- `GET /api/admin/applications/:id` が詳細 JSON を返す
- 存在しない ID で 404
- typecheck パス

---

## Step 4: UI — 一覧ページ `/applications`

### コンテキスト

PENDING / APPROVED / REJECTED のタブ切り替えで一覧を表示するページ。
Server Component + URLSearchParams でタブ・ページを管理する。

### タスク

- [ ] `apps/admin/src/app/applications/page.tsx` を作成
  - Server Component（`async function`）
  - URLSearchParams で `status`（デフォルト: `PENDING`）と `page` を取得
  - 内部で QueryService を直接呼ぶ（API Route 経由ではなく、Server Component から直接 Prisma）
  - 表示項目:
    - タブ: PENDING (審査待ち) / APPROVED (承認済み) / REJECTED (却下済み)
    - テーブル: 応募日 / 応募者名 / プロジェクトタイトル / ステータスバッジ
    - 各行はリンク → `/applications/[id]`
  - ページネーション: 前へ / 次へ ボタン（total > perPage の場合）
  - 空状態: 「該当する応募はありません」

- [ ] `apps/admin/src/components/ApplicationStatusBadge.tsx` を作成
  - PENDING: 黄色バッジ「審査待ち」
  - APPROVED: 緑バッジ「承認済み」
  - REJECTED: 赤バッジ「却下済み」

### 検証

```bash
bun run typecheck
bun run build  # apps/admin のビルドが通ること
```

### 完了条件

- `/applications` にアクセスするとタブ付き一覧が表示される
- タブ切り替えで status フィルタが効く
- 各行クリックで詳細に遷移
- typecheck + build パス

---

## Step 5: UI — 詳細ページ `/applications/[id]`

### コンテキスト

応募の全内容を表示する詳細ページ。
承認/却下ボタンは #70 で配線するため、このステップでは **PENDING の場合のみボタン placeholder を置く**。

### タスク

- [ ] `apps/admin/src/app/applications/[id]/page.tsx` を作成
  - Server Component
  - QueryService の `findById` で取得（not found → `notFound()` 呼び出し）
  - 表示セクション:
    - **ヘッダー**: ステータスバッジ + 応募日 + 審査日
    - **応募者情報**: displayName, email
    - **企画内容**:
      - プロジェクトタイトル
      - カテゴリ（`CATEGORY_MASTER` のラベルに変換）
      - 活動地域（都道府県名に変換 + 市区町村）
      - 概要（projectSummary）
      - 詳細（projectStory — Markdown 表示は Phase 1 ではプレーンテキスト）
      - 活動予定（plannedActivities）
      - SNS リンク
    - **審査メモ**: reviewerNote（REJECTED の場合のみ表示）
    - **アクションエリア**: PENDING の場合「承認」「却下」ボタンの placeholder（disabled, #70 で有効化）
  - 戻るリンク: `/applications` に戻る

- [ ] `apps/admin/src/lib/category.ts` を作成
  - `CATEGORY_MASTER` からカテゴリコード → ラベル変換ヘルパー
  - ドメイン層の `CATEGORY_MASTER` を使用

- [ ] `apps/admin/src/lib/prefecture.ts` を作成
  - 都道府県コード → 都道府県名変換のマッピング

### 検証

```bash
bun run typecheck
bun run build
```

### 完了条件

- `/applications/[id]` で全企画内容が表示される
- 存在しない ID で 404 ページ
- PENDING 応募に placeholder ボタンが表示される
- typecheck + build パス

---

## Step 6: トップページ更新 + 最終確認

### コンテキスト

admin トップページの TODO を応募管理リンクに置き換える。

### タスク

- [ ] `apps/admin/src/app/page.tsx` を更新
  - 「管理メニューは今後追加予定」を削除
  - `/applications` へのリンクカード「リーダー応募管理」を追加
  - PENDING 件数バッジ表示（Server Component で直接カウント取得）

- [ ] `apps/admin/src/app/applications/not-found.tsx` を作成
  - 「この応募は見つかりません」+ 一覧に戻るリンク

- [ ] Prettier フォーマット: `bun run format`
- [ ] 全体 typecheck: `bun run typecheck`
- [ ] ビルド確認: `cd apps/admin && bun run build`

### 検証

```bash
bun run format
bun run typecheck
cd apps/admin && bun run build
```

### 完了条件

- トップページに応募管理リンクが表示される
- format / typecheck / build 全パス
- 全 Step のチェックボックスが完了

---

## ファイル作成/変更一覧

| 操作 | パス |
|------|------|
| 新規 | `apps/admin/src/lib/api/response.ts` |
| 新規 | `packages/infrastructure/src/leader-application/PrismaLeaderApplicationQueryService.ts` |
| 変更 | `packages/infrastructure/src/index.ts` |
| 新規 | `apps/admin/src/app/api/admin/applications/route.ts` |
| 新規 | `apps/admin/src/app/api/admin/applications/[id]/route.ts` |
| 新規 | `apps/admin/src/app/applications/page.tsx` |
| 新規 | `apps/admin/src/app/applications/[id]/page.tsx` |
| 新規 | `apps/admin/src/app/applications/not-found.tsx` |
| 新規 | `apps/admin/src/components/ApplicationStatusBadge.tsx` |
| 新規 | `apps/admin/src/lib/category.ts` |
| 新規 | `apps/admin/src/lib/prefecture.ts` |
| 変更 | `apps/admin/src/app/page.tsx` |

## 設計判断メモ

1. **Query Service パターン採用**: 一覧/詳細は読み取り専用のため、UseCase + Port パターンではなく、インフラ層に直接 Query Service を置く。CQRS の Q 側として、ドメインエンティティの reconstruct を経由しない（パフォーマンスとシンプルさ優先）。

2. **Server Component から直接 Prisma**: UI ページは Server Component なので API Route 経由せず直接 QueryService を呼ぶ。API Route は外部クライアント（将来のモバイルアプリ等）用に残す。

3. **Markdown レンダリングは Phase 1 では省略**: `projectStory` は `<pre>` or `whitespace-pre-wrap` でプレーンテキスト表示。Phase 2 で `react-markdown` 等を導入。

4. **ページネーション**: offset ベース（Prisma の `skip` / `take`）。データ量が少ない Phase 1 では十分。

5. **response.ts の重複**: web アプリとの共通化は将来 `packages/shared` に切り出す。今は各アプリにコピー。
