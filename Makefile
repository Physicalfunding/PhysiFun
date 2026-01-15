# Campfire Experience - 開発用Makefile
# 使用方法: make [コマンド名]

.PHONY: help start stop status db-migrate db-push db-studio db-reset dev build test test-watch test-coverage lint format format-check setup clean env-setup

# ヘルプ表示
help:
	@echo "Campfire Experience - 開発コマンド一覧"
	@echo ""
	@echo "=== Supabase（ローカル環境） ==="
	@echo "  make start       : Supabaseローカル環境を起動"
	@echo "  make stop        : Supabaseローカル環境を停止"
	@echo "  make status      : Supabaseの状態を確認"
	@echo ""
	@echo "=== データベース ==="
	@echo "  make db-migrate  : Prismaマイグレーションを実行"
	@echo "  make db-push     : スキーマをDBに反映（開発用）"
	@echo "  make db-studio   : Prisma Studioを起動"
	@echo "  make db-reset    : DBをリセット（データ全削除）"
	@echo ""
	@echo "=== 開発 ==="
	@echo "  make dev         : 開発サーバーを起動"
	@echo "  make build       : プロダクションビルド"
	@echo "  make test        : テストを実行"
	@echo "  make test-watch  : テストをウォッチモードで実行"
	@echo "  make test-coverage : カバレッジ付きでテスト実行"
	@echo "  make lint        : ESLintを実行"
	@echo "  make format      : Prettierでフォーマット"
	@echo "  make format-check: フォーマットチェック"
	@echo ""
	@echo "=== セットアップ ==="
	@echo "  make setup       : 初期セットアップ（全手順）"
	@echo "  make env-setup   : .envファイルを生成"
	@echo "  make clean       : Supabaseを停止してクリーンアップ"

# ==================== Supabase ====================

# Supabaseローカル環境を起動
start:
	@echo "Supabaseローカル環境を起動中..."
	@echo "（初回は数分かかります）"
	supabase start
	@echo ""
	@echo "✅ Supabaseが起動しました"
	@echo "   Studio: http://127.0.0.1:54323"
	@echo "   API:    http://127.0.0.1:54321"

# Supabaseローカル環境を停止
stop:
	@echo "Supabaseローカル環境を停止中..."
	supabase stop
	@echo "✅ Supabaseを停止しました"

# Supabaseの状態を確認
status:
	supabase status

# ==================== データベース ====================

# Prismaマイグレーションを実行
db-migrate:
	@echo "Prismaマイグレーションを実行中..."
	bun run db:generate
	bun run db:migrate

# スキーマをDBに反映（開発用、マイグレーション履歴なし）
db-push:
	@echo "スキーマをDBに反映中..."
	bun run db:generate
	bun run db:push

# Prisma Studioを起動
db-studio:
	@echo "Prisma Studioを起動中..."
	@echo "http://localhost:5555 でアクセスできます"
	bun run db:studio

# DBをリセット（データ全削除）
db-reset:
	@echo "警告: データベースをリセットします。全てのデータが削除されます。"
	@read -p "続行しますか？ (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	supabase db reset
	@$(MAKE) db-migrate
	@echo "✅ データベースをリセットしました"

# ==================== 開発 ====================

# 開発サーバーを起動
dev:
	bun run dev

# プロダクションビルド
build:
	bun run build

# テストを実行
test:
	bun run test

# テストをウォッチモードで実行
test-watch:
	bun run test:watch

# カバレッジ付きでテスト実行
test-coverage:
	bun run test:coverage

# ESLintを実行
lint:
	bun run lint

# Prettierでフォーマット
format:
	bun run format

# フォーマットチェック
format-check:
	bun run format:check

# ==================== セットアップ ====================

# .envファイルを生成（Supabaseの認証情報を自動取得）
env-setup:
	@echo ".envファイルを生成中..."
	@echo "# Database (Supabase Local)" > .env
	@echo "DATABASE_URL=\"$$(supabase status | grep 'DB URL' | awk '{print $$NF}')\"" >> .env
	@echo "" >> .env
	@echo "# Authentication" >> .env
	@echo "NEXTAUTH_SECRET=\"$$(openssl rand -base64 32)\"" >> .env
	@echo "NEXTAUTH_URL=\"http://localhost:3000\"" >> .env
	@echo "" >> .env
	@echo "# Storage (Supabase Local)" >> .env
	@echo "NEXT_PUBLIC_SUPABASE_URL=\"http://127.0.0.1:54321\"" >> .env
	@echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=\"$$(supabase status | grep 'Publishable' | awk '{print $$NF}')\"" >> .env
	@echo "SUPABASE_SERVICE_ROLE_KEY=\"$$(supabase status | grep 'Secret' | awk '{print $$NF}')\"" >> .env
	@echo "✅ .envファイルを生成しました"

# 初期セットアップ（全手順）
setup:
	@echo "========================================="
	@echo "  Campfire Experience 初期セットアップ"
	@echo "========================================="
	@echo ""
	@echo "[1/5] 依存パッケージをインストール中..."
	bun install
	@echo ""
	@echo "[2/5] Supabaseを起動中..."
	supabase start
	@echo ""
	@echo "[3/5] .envファイルを生成中..."
	@$(MAKE) env-setup
	@echo ""
	@echo "[4/5] Prismaクライアントを生成中..."
	bun run db:generate
	@echo ""
	@echo "[5/5] マイグレーションを実行中..."
	bun run db:migrate
	@echo ""
	@echo "========================================="
	@echo "  ✅ セットアップが完了しました！"
	@echo "========================================="
	@echo ""
	@echo "次のステップ:"
	@echo "  1. make dev          # 開発サーバーを起動"
	@echo "  2. http://localhost:3000 にアクセス"
	@echo ""
	@echo "Supabase Studio: http://127.0.0.1:54323"
	@echo ""

# Supabaseを停止してクリーンアップ
clean:
	@echo "クリーンアップ中..."
	supabase stop --no-backup
	@echo "✅ クリーンアップが完了しました"
