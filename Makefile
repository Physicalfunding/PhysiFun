# PhysiFun - 開発用Makefile
# 使用方法: make [コマンド名]

.PHONY: help start stop status db-migrate db-status db-reset dev build test test-watch test-coverage lint format format-check setup clean env-setup

# ヘルプ表示
help:
	@echo "PhysiFun - 開発コマンド一覧"
	@echo ""
	@echo "=== Supabase（ローカル環境） ==="
	@echo "  make start       : Supabaseローカル環境を起動"
	@echo "  make stop        : Supabaseローカル環境を停止"
	@echo "  make status      : Supabaseの状態を確認"
	@echo ""
	@echo "=== データベース ==="
	@echo "  make db-migrate  : マイグレーションを適用（Atlas）"
	@echo "  make db-status   : マイグレーションの適用状況を確認"
	@echo "  make db-reset    : DBをリセット（データ全削除）"
	@echo "  ※ DB の中身を見るときは Supabase Studio（http://127.0.0.1:54323）を使う"
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

# マイグレーションを適用（Atlas。schema.sql を変えたときの作成は bun run db:migrate:diff <名前>）
db-migrate:
	@echo "マイグレーションを適用中..."
	bun run db:migrate:deploy

# マイグレーションの適用状況を確認
db-status:
	bun run db:migrate:status

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
	@echo "  PhysiFun 初期セットアップ"
	@echo "========================================="
	@echo ""
	@echo "[1/4] 依存パッケージをインストール中..."
	bun install
	@echo ""
	@echo "[2/4] Supabaseを起動中..."
	supabase start
	@echo ""
	@echo "[3/4] .envファイルを生成中..."
	@$(MAKE) env-setup
	@echo ""
	@echo "[4/4] マイグレーションを適用中..."
	bun run db:migrate:deploy
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
