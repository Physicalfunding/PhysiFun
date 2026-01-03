# Research & Design Decisions

---
**Purpose**: Campfire Experience MVP の技術設計に関する調査結果と設計決定の根拠を記録する。

**Usage**:
- ディスカバリーフェーズでの調査結果を記録
- design.md には収まらない詳細なトレードオフを文書化
- 将来の監査や再利用のための参照資料を提供
---

## Summary
- **Feature**: `create-mvp`
- **Discovery Scope**: New Feature (新規プラットフォーム構築)
- **Key Findings**:
  - Next.js 15 + React 19 の Server Actions により、従来の REST API の50-70%のボイラープレートを削減可能
  - Auth.js v5 は正式リリースされ、Next.js 15 の App Router と完全互換
  - Prisma 6.x は PostgreSQL との統合が強化され、Supabase との連携も安定

## Research Log

### Next.js 15 App Router & Server Actions
- **Context**: MVP の基盤となるフレームワーク選定
- **Sources Consulted**:
  - [Next.js App Router Docs](https://nextjs.org/docs/app)
  - [Next.js App Router Best Practices 2025](https://www.anshgupta.in/blog/nextjs-app-router-best-practices-2025)
  - [Vercel Discussion: Server Actions vs Route Handlers](https://github.com/vercel/next.js/discussions/72919)
- **Findings**:
  - Server Actions は `'use server'` ディレクティブで自動的に安全なサーバー専用エンドポイントを生成
  - CSRF 攻撃への保護が組み込まれており、オリジン検証が自動的に行われる
  - ミューテーション操作には Server Actions、公開 API/Webhook には Route Handlers を使い分け
  - キャッシュ制御は `revalidatePath` / `revalidateTag` で明示的に行う
- **Implications**:
  - API Route を最小限に抑え、Server Actions 中心の設計が可能
  - Zod による入力バリデーションと型付きペイロードの返却を標準化

### Auth.js v5 (NextAuth.js 5)
- **Context**: ユーザー認証・セッション管理の実装方針
- **Sources Consulted**:
  - [Auth.js v5 Migration Guide](https://authjs.dev/getting-started/migrating-to-v5)
  - [Auth.js Credentials Provider](https://authjs.dev/getting-started/authentication/credentials)
  - [Auth.js NextAuth.js Reference](https://authjs.dev/reference/nextjs)
- **Findings**:
  - 最低要件は Next.js 14.0 以上（Next.js 15 は完全対応）
  - `auth.config.ts` と `auth.ts` の分離構成が推奨
  - 環境変数は `AUTH_` プレフィックスで自動認識
  - Credentials Provider では Zod + bcrypt によるカスタム認証が可能
  - JWT セッション戦略を採用し、データベースセッションは不要
- **Implications**:
  - PrismaAdapter は使用せず、ユーザー情報のみを Prisma で管理
  - JWT コールバックでカスタムクレーム（userType 等）を追加

### Prisma 6.x with PostgreSQL
- **Context**: データアクセス層の技術選定
- **Sources Consulted**:
  - [Prisma 6 Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-6)
  - [Prisma ORM with PostgreSQL Quickstart](https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/postgresql)
  - [Prisma 6.10.0 Release Notes](https://www.prisma.io/blog/orm-6-10-0-new-features-for-prisma-postgres-remote-mcp-and-more)
- **Findings**:
  - TypeScript 5.1.0 以上が必須
  - 新しい `prisma.config.ts` による設定ファイル管理
  - PostgreSQL の多対多リレーションで主キー変更あり
  - `fullTextSearchPostgres` プレビュー機能で全文検索対応
  - Singleton パターンによる接続プール管理が推奨
- **Implications**:
  - Supabase PostgreSQL との連携で `@prisma/adapter-pg` の使用を検討
  - スキーマ設計時に多対多リレーションの主キー変更を考慮

### Supabase PostgreSQL
- **Context**: データベースホスティングの選定
- **Sources Consulted**:
  - [Supabase Docs: Use with Next.js](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
  - [Supabase Pricing](https://supabase.com/pricing)
- **Findings**:
  - 無料枠: 500MB データベース、2GB ストレージ、50,000 月間 API リクエスト、10k MAU
  - コールドスタートなし（常時起動）
  - Direct Connection 文字列で Prisma から直接接続可能
  - Auth 機能は使用せず（Auth.js を使用）、DB ホスティングのみ利用
- **Implications**:
  - MVP 段階では無料枠で十分
  - Connection Pooling は Supabase の PgBouncer を活用

### Cloudinary & next-cloudinary
- **Context**: 画像アップロード・配信の技術選定
- **Sources Consulted**:
  - [Next Cloudinary Official Docs](https://next.cloudinary.dev/)
  - [Cloudinary Integration Guide](https://cloudinary.com/guides/front-end-development/integrating-cloudinary-with-next-js)
- **Findings**:
  - CldImage コンポーネントが Next.js Image を拡張
  - Server Actions との統合でクリーンなアップロードフローが可能
  - 署名付きアップロード URL でセキュアな直接アップロード
  - 自動画像最適化とレスポンシブサイズ対応
- **Implications**:
  - `res.cloudinary.com` を Next.js の remotePatterns に追加必須
  - 署名生成は Server Action で行い、クライアントから直接 Cloudinary へアップロード

### React 19 Server Components & Form Actions
- **Context**: UI 層のアーキテクチャ選定
- **Sources Consulted**:
  - [React v19 Release Blog](https://react.dev/blog/2024/12/05/react-19)
  - [React Server Functions](https://react.dev/reference/rsc/server-functions)
  - [Vercel: What's New in React 19](https://vercel.com/blog/whats-new-in-react-19)
- **Findings**:
  - Server Components が正式に安定版としてリリース
  - `useActionState` フックでフォーム状態とペンディング状態を統合管理
  - Server Actions と Form の直接統合が可能
  - フォームリセットの自動化
- **Implications**:
  - React Hook Form + Zod の組み合わせを継続しつつ、Server Actions と統合
  - `useActionState` でローディング状態を管理

### Tailwind CSS v4
- **Context**: スタイリングフレームワークの選定
- **Sources Consulted**:
  - [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
  - [Tailwind CSS with Next.js Guide](https://tailwindcss.com/docs/guides/nextjs)
- **Findings**:
  - 2025年1月リリース、CSS-First Configuration へ移行
  - `tailwind.config.ts` 不要、CSS 内の `@theme` ディレクティブで設定
  - ブラウザ要件: Safari 16.4+, Chrome 111+, Firefox 128+
  - `create-next-app` はデフォルトで v3 をインストール、明示的に v4 指定が必要
- **Implications**:
  - 新規プロジェクトでは最初から v4 を採用
  - レガシーブラウザサポートが不要な場合のみ v4 を使用

### shadcn/ui with React 19
- **Context**: UI コンポーネントライブラリの選定
- **Sources Consulted**:
  - [shadcn/ui React 19 Docs](https://ui.shadcn.com/docs/react-19)
  - [shadcn/ui Tailwind v4 Docs](https://ui.shadcn.com/docs/tailwind-v4)
- **Findings**:
  - React 19 と Tailwind v4 に完全対応
  - `forwardRef` 削除、`data-slot` 属性によるスタイリング
  - toast コンポーネントは sonner に移行
  - npm では `--legacy-peer-deps` フラグが必要な場合あり
- **Implications**:
  - pnpm または bun の使用でピア依存関係の問題を回避
  - 既存の toast は sonner に置き換え

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Clean Architecture + DDD | ドメイン中心の層分離設計 | テスタビリティ、ドメインロジックの分離 | 初期実装コストが高い | steering 原則に適合 |
| Feature-based Structure | 機能単位でのファイル構成 | チーム並行開発が容易 | 共通ロジックの重複リスク | App Router のグループ機能と相性良好 |
| Hexagonal (Ports & Adapters) | 外部依存を抽象化 | インフラ層の差し替えが容易 | アダプタ層の実装が必要 | Prisma リポジトリに適用 |

**Selected Approach**: Clean Architecture + Feature-based Route Groups の組み合わせ

## Design Decisions

### Decision: Server Actions 中心のミューテーション設計
- **Context**: API 設計の方針決定
- **Alternatives Considered**:
  1. 従来の REST API Route Handlers
  2. Server Actions のみ
  3. Server Actions + 必要に応じて Route Handlers
- **Selected Approach**: Server Actions を主軸とし、外部連携（Webhook 等）のみ Route Handlers を使用
- **Rationale**: ボイラープレート削減、型安全性向上、CSRF 対策の自動化
- **Trade-offs**: 外部からの API 呼び出しには別途 Route Handler が必要
- **Follow-up**: メッセージ機能の WebSocket 対応時に再検討

### Decision: Auth.js v5 + JWT セッション
- **Context**: 認証方式の選定
- **Alternatives Considered**:
  1. Supabase Auth
  2. Auth.js + Database Sessions
  3. Auth.js + JWT Sessions
- **Selected Approach**: Auth.js v5 + JWT Sessions（Credentials Provider）
- **Rationale**:
  - Supabase は DB ホスティングのみ利用したい
  - JWT はスケーラビリティに優れ、DB 負荷を軽減
  - Credentials Provider でカスタム認証ロジックを実装可能
- **Trade-offs**: セッション即時無効化は困難（短い有効期限で対応）
- **Follow-up**: OAuth プロバイダー追加は Phase 2 で検討

### Decision: Prisma 6 + Supabase PostgreSQL
- **Context**: データ永続化層の選定
- **Alternatives Considered**:
  1. Prisma + Vercel Postgres
  2. Prisma + Supabase PostgreSQL
  3. Drizzle ORM + Supabase
- **Selected Approach**: Prisma 6 + Supabase PostgreSQL
- **Rationale**:
  - Prisma の型安全性と開発者体験
  - Supabase の無料枠が MVP に適している
  - Prisma の成熟したエコシステム
- **Trade-offs**: Drizzle より若干ビルドサイズが大きい
- **Follow-up**: Edge Runtime 対応が必要な場合は Drizzle を検討

### Decision: pnpm をパッケージマネージャーとして採用
- **Context**: 依存関係管理ツールの選定
- **Alternatives Considered**:
  1. npm
  2. pnpm
  3. bun
- **Selected Approach**: pnpm
- **Rationale**:
  - ディスク効率が良く、インストールが高速
  - React 19 のピア依存関係問題を回避
  - Vercel で完全サポート
- **Trade-offs**: npm よりコマンドが若干異なる
- **Follow-up**: なし

## Risks & Mitigations

- **Risk 1: React 19 のピア依存関係問題**
  - Mitigation: pnpm を使用、必要に応じて `--legacy-peer-deps` フラグ

- **Risk 2: Auth.js v5 の安定性**
  - Mitigation: 正式リリース済み、Next.js 15 との互換性確認済み

- **Risk 3: Supabase 無料枠の制限**
  - Mitigation: MVP 規模では十分、スケール時に Pro プランへ移行

- **Risk 4: Tailwind v4 のブラウザサポート**
  - Mitigation: モダンブラウザのみ対象、レガシー対応不要と確認

## References

- [Next.js App Router Documentation](https://nextjs.org/docs/app) — 公式ドキュメント
- [Auth.js v5 Documentation](https://authjs.dev/) — 認証ライブラリ公式
- [Prisma Documentation](https://www.prisma.io/docs/) — ORM 公式
- [Supabase Documentation](https://supabase.com/docs) — DB ホスティング公式
- [Next Cloudinary](https://next.cloudinary.dev/) — 画像アップロード
- [React v19 Blog](https://react.dev/blog/2024/12/05/react-19) — React 公式リリースノート
- [Tailwind CSS v4](https://tailwindcss.com/docs) — CSS フレームワーク公式
- [shadcn/ui](https://ui.shadcn.com/) — UI コンポーネント
