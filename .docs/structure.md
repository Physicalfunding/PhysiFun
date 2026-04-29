# リポジトリ構成・コード整理方針

## 基本方針

- **モノレポ（bun workspaces）** — 一般ユーザ向け (`apps/web`) と運営管理 (`apps/admin`) を別 Next.js アプリとして分離。共通レイヤーは `packages/` に集約
- **分離可能な構造** — 将来の AWS 移行・マイクロサービス化に備えてレイヤーを明確に分ける
- **過剰な抽象化をしない** — 現在必要な複雑さのみ持つ

---

## ディレクトリ構成

```
PhysiFun/
├── apps/
│   ├── web/                              # 一般ユーザ向け Next.js（port 3000）
│   │   └── src/app/
│   │       ├── (auth)/                   # 認証ページ（ログイン）
│   │       ├── activate/                 # メール経由のパスワード設定
│   │       ├── apply/                    # リーダー応募 LP（Phase 1: 非ログイン）
│   │       ├── api/                      # API Route Handler（薄い BFF）
│   │       ├── my/                       # 認証済みユーザー向けページ（マイページ等）
│   │       ├── projects/                 # 公開プロジェクトページ（Phase 2 拡張）
│   │       └── page.tsx                  # トップページ（LP）
│   │
│   └── admin/                            # 運営管理 Next.js（port 3001、別 Vercel プロジェクト）
│       └── src/app/
│           ├── (auth)/                   # 運営ログイン（Magic Link）
│           ├── admin/                    # 運営ダッシュボード（応募審査 / プロジェクト審査 / 運営メンバー管理 / 監査ログ）
│           └── api/
│               ├── auth/                 # NextAuth (EmailProvider)
│               └── cron/gc-admin-auth/   # 期限切れトークン / セッションの GC
│
├── packages/
│   ├── domain/                           # ドメイン層
│   │   ├── account/                      # Account, Role（SUPPORTER / LEADER）
│   │   ├── admin-account/                # AdminAccount（apps/admin 専用、Magic Link 認証ベース）
│   │   ├── leader-application/           # LeaderApplication
│   │   ├── project/                      # Project, ProjectPhase, PublishStatus
│   │   ├── recruitment/                  # Recruitment, SupportTicket（Phase 1 では未実装、計画段階）
│   │   └── shared/                       # Result 型、共通値オブジェクト
│   │
│   ├── application/
│   │   └── use-cases/                    # ユースケース層
│   │
│   ├── infrastructure/                   # インフラ層
│   │   ├── prisma/                       # Prisma スキーマ / マイグレーション / seed
│   │   ├── database/
│   │   │   └── repositories/             # Prisma 実装リポジトリ
│   │   ├── outbox/                       # Outbox ワーカー（メール送信のリトライ・冪等化、Magic Link / アクティベーションメール等）
│   │   ├── mail/                         # Resend クライアント
│   │   └── storage/                      # Supabase Storage 実装
│   │
│   └── ui-shared/                        # 両アプリで共有する UI コンポーネント
│
├── .docs/                                # 設計・運用ドキュメント
└── docs-repository/                      # フェーズ別の最新仕様書
```

> **Phase 1 スコープ**: `leader-application` / `project`（リーダー側のプロジェクト作成・編集・公開申請）を実装。`recruitment` は計画ドキュメントには存在するが Phase 1 では未実装。サポーター向けの閲覧・申請 UI は Phase 2 で追加。廃止された旧 bounded context（`return` / `participation` / `schedule` / `message` / `guest` / `ApplicationMode`）は計画ドキュメントに存在しない。

---

## レイヤー別責務

### `app/api/`（API Route Handler）
- HTTP リクエストの受け取りとレスポンスの返却のみ
- バリデーション（Zod）
- 認証チェック
- ユースケースの呼び出し
- **ビジネスロジックを書かない**

```ts
// 良い例
export async function POST(request: Request) {
  const body = await request.json();
  const session = await getServerSession();
  const result = await new CreateProjectUseCase(repo).execute(session.user.id, body);
  return NextResponse.json(result);
}
```

### `application/use-cases/`（ビジネスロジック）
- アプリケーションのユースケースを実装
- ドメインエンティティを操作する
- リポジトリインターフェースを通じてデータを取得・保存
- 外部サービス（Supabase など）に**直接依存しない**

### `domain/`（ドメインルール）
- エンティティ（User, Project, Schedule など）
- 値オブジェクト（UserId, Email など）
- リポジトリインターフェース（実装は `infrastructure/` に置く）
- ビジネスルールの制約（バリデーション、不変条件）

### `infrastructure/`（外部サービス）
- Prisma リポジトリ実装
- Supabase Storage 操作
- **ここ以外で Supabase SDK・Prisma を直接呼ばない**
- 環境変数の読み込みはこの層で完結させる

### admin アプリの Server Component 規約（#119 / #131 Min-8）
- admin ページは `export const dynamic = "force-dynamic"` を必ず宣言（認証必須 + 常に最新表示のため、ビルド時の静的生成を無効化）。ただし Client Component (`"use client"`) は対象外。
- `force-dynamic` 宣言はファイル先頭の import 群の直後にまとめて記述する（宣言位置の揺れを避け、静的生成無効化の意図を一目で確認できるようにするため）。
- `layout.tsx` は現状 state を持たない前提のため `force-dynamic` は宣言しない。動的データ取得 (認証ユーザー情報の埋め込み等) を始める場合は page と同様に追加する。
- `QueryService` は `apps/admin/src/lib/di/queryServices.ts` のファクトリ経由でリクエストスコープに生成し、モジュールレベルで `new` しない（モック差し替えや将来のリクエスト単位 Prisma 切替を阻害しないため）。Server Component だけでなく Route Handler (`app/api/**/route.ts`) も同様。

### `components/`（UI）
- サーバーコンポーネント・クライアントコンポーネントを適切に使い分ける
- `common/` は再利用可能な汎用コンポーネントのみ
- ページ固有のロジックはページファイルに持つ

---

## 命名規則

| 種別 | 規則 | 例 |
|---|---|---|
| コンポーネント | PascalCase | `ProjectCard.tsx` |
| ユースケース | `動詞 + 名詞 + UseCase` | `CreateProjectUseCase.ts` |
| リポジトリIF | `名詞 + Repository` | `ProjectRepository.ts` |
| Prisma実装 | `Prisma + 名詞 + Repository` | `PrismaProjectRepository.ts` |
| API Route | `route.ts` | `app/api/projects/route.ts` |
| 型定義ファイル | camelCase | `next-auth.d.ts` |

---

## テスト方針

- ユースケース層のユニットテストを優先（`__tests__/` をユースケースの隣に配置）
- コンポーネントテストは重要な UI コンポーネントのみ
- API 統合テストは MVP フェーズでは省略可
- テストフレームワーク: Jest + React Testing Library

---

## 将来の分離に備えた境界

```
┌─────────────────────────────────┐
│ Next.js (フロント + API BFF)    │ ← Vercel
├─────────────────────────────────┤
│ application/ + domain/          │ ← 将来 Lambda に移植可能
├─────────────────────────────────┤
│ infrastructure/ (Prisma)        │ ← RDS に変更するだけで動く
├─────────────────────────────────┤
│ infrastructure/ (Supabase Storage) │ ← S3 に変更するだけで動く
└─────────────────────────────────┘
```

この境界を守ることで、AWS 移行時のコード変更量を最小化できる。
