# 技術スタック・アーキテクチャ方針

## 確定技術スタック

### フロントエンド / BFF
| 技術 | バージョン | 用途 |
|---|---|---|
| Next.js | 16.x (App Router) | フロント + API Route Handler |
| React | 19.x | UI |
| TypeScript | 5.x | 型安全 |
| Tailwind CSS | 4.x | スタイリング |
| React Hook Form + Zod | 最新 | フォーム・バリデーション |

### 認証
| 技術 | 用途 |
|---|---|
| NextAuth.js v4 | セッション管理・認証（メール + パスワード） |

※ Supabase Auth は**使わない**。認証は NextAuth.js に統一。

### データベース
| 技術 | 用途 |
|---|---|
| PostgreSQL (Supabase) | メインDB |
| Prisma | ORM（スキーマ管理・マイグレーション） |

### ストレージ
| 技術 | 用途 |
|---|---|
| Supabase Storage | 画像アップロード（バケット: `crowfun-images`） |

### インフラ（現在）
| 技術 | 用途 |
|---|---|
| Vercel | ホスティング（サーバレス関数 + 静的配信） |
| Supabase | DB + Storage（有料プランを前提） |

---

## デプロイ方針

- **ローンチ時から有料プラン前提**（商用利用・安定運用の観点）
- Vercel: Pro プラン推奨
- Supabase: Pro プラン推奨

### 必須の環境変数

```env
DATABASE_URL          # Supabase PostgreSQL（Transaction Pooler URL）
NEXTAUTH_SECRET       # ランダム秘密鍵
NEXTAUTH_URL          # 本番: https://your-app.vercel.app
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET   # デフォルト: crowfun-images
```

---

## SSR / SEO 方針

| ページ種別 | レンダリング | 理由 |
|---|---|---|
| LP（トップページ） | SSG（静的生成） | SEO 対象はここのみ |
| プロジェクト詳細 | SSR or ISR | 必要に応じて |
| ダッシュボード系 | CSR | 認証後のため SEO 不要 |

**原則:** SEO よりスピードと体験を優先。SSR が必要なページは最小限にする。

---

## アーキテクチャ原則

### レイヤー構成（現在）

```
Next.js App Router
  ↓ API Route Handler（薄い BFF）
  ↓ Application Layer（use-cases）
  ↓ Domain Layer（entities・value-objects）
  ↓ Infrastructure Layer（Prisma・Supabase）
```

### 分離の原則

- **API Route Handler は薄く保つ** — リクエスト受け取り・レスポンス返却のみ
- **ビジネスロジックは `application/use-cases/` に集約**
- **DB・ストレージ操作は `infrastructure/` に閉じ込める**
- **ドメインルールは `domain/` に保持**

この構造を守ることで、将来の AWS 移行時にビジネスロジックをそのまま流用できる。

---

## 将来の AWS 移行方針

現時点では Vercel + Supabase で進めるが、スケールに応じて AWS 移行を想定。

### 想定移行先（サーバレス寄り）

| 現在 | 将来（AWS） |
|---|---|
| Vercel（静的配信） | CloudFront + S3 |
| Vercel API Routes | API Gateway + Lambda |
| Supabase PostgreSQL | RDS (PostgreSQL) |
| NextAuth.js | Cognito（または継続） |
| Supabase Storage | S3 |

### Next.js SSR の AWS 対応

SSR が必要になった場合の対応候補:
- **Amplify Hosting** — AWS マネージドで Next.js SSR をサポート
- **OpenNext / SST** — セルフホストで Lambda + CloudFront に最適化

### 移行に備えた設計指針

- Supabase SDK の直接呼び出しは `infrastructure/` 層のみに限定する
- ビジネスロジックに Supabase 依存を持ち込まない
- 環境変数で接続先を切り替えられる構造を維持する
