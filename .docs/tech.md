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
| アプリ | 技術 | 戦略 | 用途 |
|---|---|---|---|
| `apps/web` | NextAuth.js v4 (Credentials Provider) | JWT セッション | 一般ユーザ（リーダー / サポーター）の email + password ログイン |
| `apps/admin` | NextAuth.js v4 (EmailProvider / Magic Link) | Database セッション (TTL 1h) | 運営の Magic Link ログイン（`AdminAccount` 独立アグリゲート、`ADMIN_MAGIC_LINK_HMAC_SECRET` で URL 署名） |

※ Supabase Auth は**使わない**。認証は NextAuth.js に統一。
※ web / admin は **Cookie・セッション・環境変数を完全分離**（サブドメイン分離: `<domain>` / `admin.<domain>`）。

### データベース
| 技術 | 用途 |
|---|---|
| PostgreSQL (Supabase) | メインDB |
| Prisma | ORM（スキーマ管理・マイグレーション） |

### ストレージ
| 技術 | 用途 |
|---|---|
| Supabase Storage | 画像アップロード（バケット: `project-images`） |

### メール送信
| 技術 | 用途 |
|---|---|
| Resend | アクティベーションメール / 運営 Magic Link メール送信 |

### インフラ（現在）
| 技術 | 用途 |
|---|---|
| Vercel | ホスティング（**`apps/web` と `apps/admin` は別 Vercel プロジェクト**、サブドメイン分離） |
| Supabase | DB + Storage（有料プランを前提、web / admin で同一インスタンスを共有） |
| Bun (workspaces) | パッケージマネージャ + monorepo マネージャ |

---

## デプロイ方針

- **ローンチ時から有料プラン前提**（商用利用・安定運用の観点）
- Vercel: Pro プラン推奨
- Supabase: Pro プラン推奨

### 必須の環境変数

アプリごとに別 Vercel プロジェクトとして管理する。詳細は各 README を参照。

#### `apps/web`（一般ユーザ向け）

```env
DATABASE_URL                       # Supabase PostgreSQL（Transaction Pooler URL）
NEXTAUTH_SECRET                    # apps/admin と必ず別値
NEXTAUTH_URL                       # 本番: https://<本番ドメイン>
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET            # デフォルト: project-images
RESEND_API_KEY                     # アクティベーションメール送信
ADMIN_EMAIL_LIST                   # 運営宛通知（Phase 1 用、カンマ区切り）
NEXT_PUBLIC_RELEASE_PHASE          # 1 / 2
```

詳細は [`apps/web/README.md`](../apps/web/README.md#環境変数) を参照。

#### `apps/admin`（運営管理）

```env
DATABASE_URL                       # apps/web と同値で OK
NEXTAUTH_SECRET                    # apps/web と必ず別値
NEXTAUTH_URL                       # 本番: https://admin.<本番ドメイン>
ADMIN_MAGIC_LINK_HMAC_SECRET       # NEXTAUTH_SECRET と必ず別値（未設定なら起動拒否）
RESEND_API_KEY                     # 運営 Magic Link 送信
MAIL_FROM                          # 例: "PhysiFun 運営" <admin-noreply@<本番ドメイン>>
CRON_SECRET                        # /api/cron/gc-admin-auth の Bearer 認証
```

詳細は [`apps/admin/README.md`](../apps/admin/README.md#環境変数) および [`.docs/admin-role-setup.md`](./admin-role-setup.md) を参照。

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

### モノレポ構成

```
PhysiFun/
├── apps/
│   ├── web/        # 一般ユーザ向け（Next.js, port 3000）
│   └── admin/      # 運営管理（Next.js, port 3001、別 Vercel プロジェクト）
└── packages/
    ├── domain/          # エンティティ / 値オブジェクト / リポジトリ IF
    ├── application/     # ユースケース
    ├── infrastructure/  # Prisma / Supabase Storage / メール / Outbox
    └── ui-shared/       # 両アプリ共通の UI コンポーネント
```

### レイヤー構成（現在）

```
Next.js App Router (apps/{web,admin})
  ↓ API Route Handler（薄い BFF）
  ↓ Application Layer（packages/application/use-cases）
  ↓ Domain Layer（packages/domain）
  ↓ Infrastructure Layer（packages/infrastructure: Prisma / Supabase / Outbox）
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
