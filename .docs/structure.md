# リポジトリ構成・コード整理方針

## 基本方針

- **単一リポジトリ** — フロントエンドと API を同一 Next.js プロジェクト内に同居
- **分離可能な構造** — 将来の AWS 移行・マイクロサービス化に備えてレイヤーを明確に分ける
- **過剰な抽象化をしない** — 現在必要な複雑さのみ持つ

---

## ディレクトリ構成

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 認証ページグループ（ログイン）
│   ├── apply/                    # リーダー応募 LP（Phase 1: 非ログイン）
│   ├── api/                      # API Route Handler（薄い BFF）
│   │   ├── auth/
│   │   ├── leader-applications/  # リーダー応募
│   │   ├── projects/             # プロジェクト + 審査
│   │   ├── recruitments/         # サポート募集（リーダー側 UI）
│   │   └── my/
│   ├── my/                       # 認証済みユーザー向けページ
│   ├── page.tsx                  # トップページ（LP）
│   └── layout.tsx
│
├── application/
│   └── use-cases/                # ビジネスロジック層（ユースケース）
│       ├── auth/
│       ├── leader-application/   # リーダー応募（旧 entry）
│       ├── project/              # プロジェクト作成・編集・公開審査
│       └── recruitment/          # サポート募集（活動参加募集）
│
├── domain/                       # ドメイン層（エンティティ・値オブジェクト・リポジトリIF）
│   ├── account/                  # Account, Role
│   ├── leader-application/       # LeaderApplication, ApplicationMode（PRE_ACCOUNT/AUTHENTICATED）
│   ├── project/                  # Project, ProjectPhase, PublishStatus
│   ├── recruitment/              # Recruitment, RecruitmentSchedule, SupportTicket
│   └── shared/                   # Result 型、共通値オブジェクト
│
├── infrastructure/               # インフラ層（外部サービスとの接続）
│   ├── database/
│   │   ├── prisma.ts             # Prisma Client シングルトン
│   │   └── repositories/         # Prisma 実装リポジトリ
│   ├── outbox/                   # Outbox ワーカー（初期パスワード送信等）
│   └── storage/
│       └── ImageUploadService.ts # Supabase Storage 実装
│
├── components/                   # UI コンポーネント
│   ├── common/                   # 汎用コンポーネント（Button, Input, Modal など）
│   ├── auth/
│   ├── leader-application/       # リーダー応募フォーム
│   ├── project/                  # プロジェクト編集タブ（基本情報 / サポート募集 / 活動報告）
│   ├── recruitment/              # サポート募集作成 UI
│   └── providers/
│
├── lib/                          # ユーティリティ・ヘルパー
│   ├── auth.ts                   # NextAuth 設定
│   ├── session.ts                # セッションユーティリティ
│   └── api/                      # API レスポンスヘルパー
│
└── types/                        # 型定義（外部ライブラリ拡張など）
```

> **Phase 1 スコープ**: `leader-application` / `project` / `recruitment`（リーダー側 UI のみ）を実装。サポーター向けの閲覧・申請 UI は Phase 2 で追加。廃止された旧 bounded context（`return` / `participation` / `schedule` / `message` / `guest`）は計画ドキュメントに存在しない。

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
