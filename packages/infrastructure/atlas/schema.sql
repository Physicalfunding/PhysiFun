-- =====================================================================
-- PhysiFun DB スキーマ（宣言的ソース / 正本）
--
-- このファイルが「あるべきスキーマ」の定義。変更したら差分から versioned migration を生成する:
--   bun run db:migrate:diff <変更内容を表す名前>
-- 生成物は atlas/migrations/ に入る（手で書き換えない）。詳細は docs/guides/db-migration.md。
--
-- NOTE:
-- - テーブル名は snake_case、カラム名は camelCase（Prisma 時代に作成した名前を引き継いでいる）。
-- - id（UUID）と updatedAt には DB 側の DEFAULT が無い。INSERT 時にアプリ側で値を渡す。
-- - 初版は Prisma マイグレーション適用済みの DB から `atlas schema inspect` で取り込んだ（#228）。
-- - テーブル・列には必ず `COMMENT ON` で説明を書く（各テーブル定義の直後。#271）。説明は docs/db/・Supabase Studio・
--   types.ts の JSDoc に反映される。付け忘れは CI の tbls lint（DB Docs ワークフロー）で失敗する。
--   書く内容: 業務上の意味、値の形式・上限、NULL の意味、ドメインでの呼び名（列名と違う場合）、【未使用】【未実装】の印。
-- =====================================================================

-- Create enum type "AdminAccountStatus"
CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'DISABLED');
-- Create "admin_accounts" table
CREATE TABLE "admin_accounts" (
  "id" text NOT NULL,
  "email" text NOT NULL,
  "status" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastLoginAt" timestamp(3) NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
-- Create index "admin_accounts_email_key" to table: "admin_accounts"
CREATE UNIQUE INDEX "admin_accounts_email_key" ON "admin_accounts" ("email");
-- Create index "admin_accounts_status_idx" to table: "admin_accounts"
CREATE INDEX "admin_accounts_status_idx" ON "admin_accounts" ("status");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "admin_accounts" IS '運営アカウント（apps/admin にログインする運営メンバー）。一般ユーザーの accounts とは別物。物理削除はせず status で無効化する。ドメインの AdminAccount 集約';
COMMENT ON COLUMN "admin_accounts"."id" IS '運営アカウント ID（UUID v4。アプリ側で生成）';
COMMENT ON COLUMN "admin_accounts"."email" IS 'ログインに使うメールアドレス（小文字・前後の空白なしに正規化。最大 255 文字）';
COMMENT ON COLUMN "admin_accounts"."status" IS 'ACTIVE=ログインできる / DISABLED=無効化済み（退職時など。自分自身は無効化できない）';
COMMENT ON COLUMN "admin_accounts"."lastLoginAt" IS '最後にログインした日時。【注意】記録する処理（AdminAccount.recordLogin）が呼ばれておらず、現状は常に NULL';
COMMENT ON COLUMN "admin_accounts"."createdAt" IS '作成日時';
COMMENT ON COLUMN "admin_accounts"."updatedAt" IS '更新日時（アプリ側で設定する）';
-- Create enum type "AccountStatus"
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_EMAIL_CONFIRMATION', 'ACTIVE');
-- Create enum type "PublishStatus"
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED');
-- Create enum type "ProjectPhase"
CREATE TYPE "ProjectPhase" AS ENUM ('VISION', 'PLANNING', 'READY', 'EXECUTION', 'ONGOING');
-- Create enum type "ReviewAction"
CREATE TYPE "ReviewAction" AS ENUM ('APPROVED', 'REJECTED', 'FORCE_UNPUBLISHED');
-- Create enum type "RecruitmentType"
CREATE TYPE "RecruitmentType" AS ENUM ('ACTIVITY');
-- Create "project_outbox_messages" table
CREATE TABLE "project_outbox_messages" (
  "id" text NOT NULL,
  "type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" timestamp(3) NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "lastError" text NULL,
  "nextRetryAt" timestamp(3) NULL,
  "deadLetteredAt" timestamp(3) NULL,
  "claimedAt" timestamp(3) NULL,
  "claimedBy" text NULL,
  PRIMARY KEY ("id")
);
-- Create index "project_outbox_messages_claimedBy_idx" to table: "project_outbox_messages"
CREATE INDEX "project_outbox_messages_claimedBy_idx" ON "project_outbox_messages" ("claimedBy");
-- Create index "project_outbox_messages_sentAt_deadLetteredAt_nextRetryAt_idx" to table: "project_outbox_messages"
CREATE INDEX "project_outbox_messages_sentAt_deadLetteredAt_nextRetryAt_idx" ON "project_outbox_messages" ("sentAt", "deadLetteredAt", "nextRetryAt");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "project_outbox_messages" IS 'プロジェクトの公開審査に関する送信待ちメール（Outbox）。状態の変更と同じトランザクションで積み、ワーカーが非同期で送る';
COMMENT ON COLUMN "project_outbox_messages"."id" IS 'メッセージ ID（UUID v4。アプリ側で生成）';
COMMENT ON COLUMN "project_outbox_messages"."payload" IS '送信に必要なデータ（JSON。形はメッセージの種類ごとに違う）';
COMMENT ON COLUMN "project_outbox_messages"."createdAt" IS '積んだ日時。古いものから順に処理する';
COMMENT ON COLUMN "project_outbox_messages"."sentAt" IS '送信が完了した日時。運営画面で完了扱いにした場合も入る。未送信は NULL';
COMMENT ON COLUMN "project_outbox_messages"."attempts" IS '送信を試みた回数。失敗のたびに増え、運営画面の手動リトライでも戻さない';
COMMENT ON COLUMN "project_outbox_messages"."lastError" IS '最後に失敗したときのエラー内容。手動リトライで NULL に戻る';
COMMENT ON COLUMN "project_outbox_messages"."nextRetryAt" IS '次に再送してよい日時（失敗後に指数バックオフで設定）。NULL ならすぐ処理対象';
COMMENT ON COLUMN "project_outbox_messages"."deadLetteredAt" IS '最大試行回数（既定 10 回）を超えて再送をやめた日時。運営画面の手動リトライで NULL に戻る';
COMMENT ON COLUMN "project_outbox_messages"."claimedAt" IS 'ワーカーが処理のために確保した日時。5 分を過ぎた確保は無効とみなし、別のワーカーが取り直せる';
COMMENT ON COLUMN "project_outbox_messages"."claimedBy" IS '確保したワーカーの実行ごとの ID（ランダムな UUID）。処理が終わると NULL';
COMMENT ON COLUMN "project_outbox_messages"."type" IS 'メッセージの種類（admin_publish_request.notify=運営への公開申請の通知 / project_publish_approved.notify=公開承認の通知 / project_publish_rejected.notify=差戻の通知 / project_force_unpublished.notify=強制非公開の通知）';
-- Create enum type "SupportTicketStatus"
CREATE TYPE "SupportTicketStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
-- Create enum type "Role"
CREATE TYPE "Role" AS ENUM ('SUPPORTER', 'LEADER');
-- Create enum type "LeaderApplicationStatus"
CREATE TYPE "LeaderApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
-- Create enum type "ApprovalMode"
CREATE TYPE "ApprovalMode" AS ENUM ('AUTO', 'MANUAL');
-- Create "leader_application_outbox_messages" table
CREATE TABLE "leader_application_outbox_messages" (
  "id" text NOT NULL,
  "type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" timestamp(3) NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "lastError" text NULL,
  "nextRetryAt" timestamp(3) NULL,
  "deadLetteredAt" timestamp(3) NULL,
  "claimedAt" timestamp(3) NULL,
  "claimedBy" text NULL,
  PRIMARY KEY ("id")
);
-- Create index "leader_application_outbox_messages_claimedBy_idx" to table: "leader_application_outbox_messages"
CREATE INDEX "leader_application_outbox_messages_claimedBy_idx" ON "leader_application_outbox_messages" ("claimedBy");
-- Create index "leader_application_outbox_messages_sentAt_deadLetteredAt_ne_idx" to table: "leader_application_outbox_messages"
CREATE INDEX "leader_application_outbox_messages_sentAt_deadLetteredAt_ne_idx" ON "leader_application_outbox_messages" ("sentAt", "deadLetteredAt", "nextRetryAt");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "leader_application_outbox_messages" IS 'リーダー応募に関する送信待ちメール（Outbox）。応募・審査と同じトランザクションで積み、ワーカーが非同期で送る';
COMMENT ON COLUMN "leader_application_outbox_messages"."id" IS 'メッセージ ID（UUID v4。アプリ側で生成）';
COMMENT ON COLUMN "leader_application_outbox_messages"."payload" IS '送信に必要なデータ（JSON。形はメッセージの種類ごとに違う）';
COMMENT ON COLUMN "leader_application_outbox_messages"."createdAt" IS '積んだ日時。古いものから順に処理する';
COMMENT ON COLUMN "leader_application_outbox_messages"."sentAt" IS '送信が完了した日時。運営画面で完了扱いにした場合も入る。未送信は NULL';
COMMENT ON COLUMN "leader_application_outbox_messages"."attempts" IS '送信を試みた回数。失敗のたびに増え、運営画面の手動リトライでも戻さない';
COMMENT ON COLUMN "leader_application_outbox_messages"."lastError" IS '最後に失敗したときのエラー内容。手動リトライで NULL に戻る';
COMMENT ON COLUMN "leader_application_outbox_messages"."nextRetryAt" IS '次に再送してよい日時（失敗後に指数バックオフで設定）。NULL ならすぐ処理対象';
COMMENT ON COLUMN "leader_application_outbox_messages"."deadLetteredAt" IS '最大試行回数（既定 10 回）を超えて再送をやめた日時。運営画面の手動リトライで NULL に戻る';
COMMENT ON COLUMN "leader_application_outbox_messages"."claimedAt" IS 'ワーカーが処理のために確保した日時。5 分を過ぎた確保は無効とみなし、別のワーカーが取り直せる';
COMMENT ON COLUMN "leader_application_outbox_messages"."claimedBy" IS '確保したワーカーの実行ごとの ID（ランダムな UUID）。処理が終わると NULL';
COMMENT ON COLUMN "leader_application_outbox_messages"."type" IS 'メッセージの種類（ACTIVATION_EMAIL=アクティベーションメール / approved.notify_applicant=承認の通知 / rejected.notify_applicant=却下の通知）';
-- Create enum type "LeaderApplicationRecruitmentType"
CREATE TYPE "LeaderApplicationRecruitmentType" AS ENUM ('TIME', 'SKILL_ITEM');
-- Create "admin_verification_tokens" table
CREATE TABLE "admin_verification_tokens" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp(3) NOT NULL
);
-- Create index "admin_verification_tokens_expires_idx" to table: "admin_verification_tokens"
CREATE INDEX "admin_verification_tokens_expires_idx" ON "admin_verification_tokens" ("expires");
-- Create index "admin_verification_tokens_identifier_token_key" to table: "admin_verification_tokens"
CREATE UNIQUE INDEX "admin_verification_tokens_identifier_token_key" ON "admin_verification_tokens" ("identifier", "token");
-- Create index "admin_verification_tokens_token_key" to table: "admin_verification_tokens"
CREATE UNIQUE INDEX "admin_verification_tokens_token_key" ON "admin_verification_tokens" ("token");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "admin_verification_tokens" IS '運営ログイン用 Magic Link のトークン（NextAuth の VerificationToken）。使うと削除され、期限切れのものも定期的に削除される。FK は持たない';
COMMENT ON COLUMN "admin_verification_tokens"."identifier" IS 'Magic Link の送信先メールアドレス（小文字・前後の空白なしに正規化）';
COMMENT ON COLUMN "admin_verification_tokens"."token" IS 'Magic Link に含まれるトークンのハッシュ値（NextAuth がハッシュ化してから保存する）';
COMMENT ON COLUMN "admin_verification_tokens"."expires" IS '有効期限（発行から 10 分）';
-- Create "admin_sessions" table
CREATE TABLE "admin_sessions" (
  "id" text NOT NULL,
  "sessionToken" text NOT NULL,
  "adminAccountId" text NOT NULL,
  "expires" timestamp(3) NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "admin_sessions_adminAccountId_fkey" FOREIGN KEY ("adminAccountId") REFERENCES "admin_accounts" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "admin_sessions_adminAccountId_idx" to table: "admin_sessions"
CREATE INDEX "admin_sessions_adminAccountId_idx" ON "admin_sessions" ("adminAccountId");
-- Create index "admin_sessions_expires_idx" to table: "admin_sessions"
CREATE INDEX "admin_sessions_expires_idx" ON "admin_sessions" ("expires");
-- Create index "admin_sessions_sessionToken_key" to table: "admin_sessions"
CREATE UNIQUE INDEX "admin_sessions_sessionToken_key" ON "admin_sessions" ("sessionToken");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "admin_sessions" IS '運営アプリのログインセッション（NextAuth の Database セッション）。有効期間は 1 時間で、使っている間は延長される。期限切れのものは定期的に削除される';
COMMENT ON COLUMN "admin_sessions"."id" IS 'セッション ID';
COMMENT ON COLUMN "admin_sessions"."sessionToken" IS 'Cookie に入れるセッショントークン';
COMMENT ON COLUMN "admin_sessions"."adminAccountId" IS 'ログインしている運営アカウント';
COMMENT ON COLUMN "admin_sessions"."expires" IS 'セッションの有効期限';
COMMENT ON COLUMN "admin_sessions"."createdAt" IS '作成日時';
COMMENT ON COLUMN "admin_sessions"."updatedAt" IS '更新日時（アプリ側で設定する）';
-- Create "admin_audit_logs" table
CREATE TABLE "admin_audit_logs" (
  "id" text NOT NULL,
  "adminAccountId" text NOT NULL,
  "adminSessionId" text NULL,
  "action" text NOT NULL,
  "targetType" text NOT NULL,
  "targetId" text NULL,
  "metadata" jsonb NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "admin_audit_logs_adminAccountId_fkey" FOREIGN KEY ("adminAccountId") REFERENCES "admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "admin_audit_logs_adminSessionId_fkey" FOREIGN KEY ("adminSessionId") REFERENCES "admin_sessions" ("id") ON UPDATE CASCADE ON DELETE SET NULL
);
-- Create index "admin_audit_logs_action_createdAt_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_action_createdAt_idx" ON "admin_audit_logs" ("action", "createdAt");
-- Create index "admin_audit_logs_adminAccountId_createdAt_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_adminAccountId_createdAt_idx" ON "admin_audit_logs" ("adminAccountId", "createdAt");
-- Create index "admin_audit_logs_adminSessionId_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_adminSessionId_idx" ON "admin_audit_logs" ("adminSessionId");
-- Create index "admin_audit_logs_createdAt_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs" ("createdAt");
-- Create index "admin_audit_logs_targetType_createdAt_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_targetType_createdAt_idx" ON "admin_audit_logs" ("targetType", "createdAt");
-- Create index "admin_audit_logs_targetType_targetId_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs" ("targetType", "targetId");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "admin_audit_logs" IS '運営の操作ログ（誰が・いつ・何に対して・何をしたか）。運営画面の操作ログ一覧で見る';
COMMENT ON COLUMN "admin_audit_logs"."id" IS 'ログ ID（UUID v4。アプリ側で生成）';
COMMENT ON COLUMN "admin_audit_logs"."adminAccountId" IS '操作した運営アカウント';
COMMENT ON COLUMN "admin_audit_logs"."adminSessionId" IS '操作したときのセッション。セッションが削除されると NULL になる';
COMMENT ON COLUMN "admin_audit_logs"."action" IS '操作の種類（対象.操作 の形。例: project.approve / leader_application.reject / admin_account.disable / outbox.retry）';
COMMENT ON COLUMN "admin_audit_logs"."targetType" IS '操作した対象の種類（AdminAccount / LeaderApplication / Project / OutboxMessage）';
COMMENT ON COLUMN "admin_audit_logs"."targetId" IS '操作した対象の ID。特定のレコードが対象でない操作は NULL';
COMMENT ON COLUMN "admin_audit_logs"."metadata" IS '操作ごとの補足情報（却下理由など。JSON）';
COMMENT ON COLUMN "admin_audit_logs"."createdAt" IS '操作した日時';
-- Create "accounts" table
CREATE TABLE "accounts" (
  "id" text NOT NULL,
  "email" text NOT NULL,
  "displayName" text NOT NULL,
  "status" "AccountStatus" NOT NULL,
  "passwordHash" text NULL,
  "roles" "Role"[] NULL,
  "activationToken" text NULL,
  "activationTokenExp" timestamp(3) NULL,
  "iconUrl" text NULL,
  "bio" text NULL,
  "snsLinks" jsonb NULL,
  "contributedHours" integer NOT NULL DEFAULT 0,
  "receivedHours" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  "phoneNumber" text NULL,
  PRIMARY KEY ("id")
);
-- Create index "accounts_activationToken_key" to table: "accounts"
CREATE UNIQUE INDEX "accounts_activationToken_key" ON "accounts" ("activationToken");
-- Create index "accounts_email_key" to table: "accounts"
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts" ("email");
-- Create index "accounts_status_idx" to table: "accounts"
CREATE INDEX "accounts_status_idx" ON "accounts" ("status");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "accounts" IS '一般ユーザーのアカウント（サポーター・リーダー）。リーダー応募の送信時に作られ、メールのリンクからパスワードを設定すると有効になる';
COMMENT ON COLUMN "accounts"."id" IS 'アカウント ID（UUID v4。アプリ側で生成）';
COMMENT ON COLUMN "accounts"."email" IS 'ログイン ID のメールアドレス（小文字・前後の空白なしに正規化）';
COMMENT ON COLUMN "accounts"."displayName" IS '表示名（1〜50 文字）';
COMMENT ON COLUMN "accounts"."status" IS 'PENDING_EMAIL_CONFIRMATION=メール確認待ち（作成から 72 時間で自動削除）/ ACTIVE=有効';
COMMENT ON COLUMN "accounts"."passwordHash" IS 'パスワードの bcrypt ハッシュ。アクティベーション前は NULL';
COMMENT ON COLUMN "accounts"."roles" IS 'ロール（SUPPORTER / LEADER。複数可）。作成時は SUPPORTER で、リーダー応募の承認で LEADER が加わる';
COMMENT ON COLUMN "accounts"."activationToken" IS 'アクティベーション URL に含めるトークン（ランダムな 64 桁の 16 進数）。有効化すると NULL';
COMMENT ON COLUMN "accounts"."activationTokenExp" IS 'activationToken の有効期限（発行から 24 時間）。有効化すると NULL';
COMMENT ON COLUMN "accounts"."iconUrl" IS '【未使用】アイコン画像の URL。設定する機能が無い';
COMMENT ON COLUMN "accounts"."bio" IS '自己紹介。公開ページと運営画面で表示するが、設定する機能が無く現状は常に NULL';
COMMENT ON COLUMN "accounts"."snsLinks" IS '【未使用】SNS リンク。現状は応募（leader_applications）とプロジェクト（projects）の snsLinks を使う';
COMMENT ON COLUMN "accounts"."contributedHours" IS '【未使用】提供時間の累計（時間）。サポーターとして他のプロジェクトに提供した時間';
COMMENT ON COLUMN "accounts"."receivedHours" IS '【未使用】参加時間の累計（時間）。リーダーとして自分のプロジェクトでサポーターから受けた時間';
COMMENT ON COLUMN "accounts"."createdAt" IS '作成日時';
COMMENT ON COLUMN "accounts"."updatedAt" IS '更新日時（アプリ側で設定する）';
COMMENT ON COLUMN "accounts"."phoneNumber" IS '電話番号（任意。最大 20 文字、ハイフン可）。リーダー応募のときに入力された値';
-- Create "leader_applications" table
CREATE TABLE "leader_applications" (
  "id" text NOT NULL,
  "accountId" text NOT NULL,
  "status" "LeaderApplicationStatus" NOT NULL,
  "reviewerNote" text NULL,
  "projectTitle" text NOT NULL,
  "projectSummary" text NOT NULL,
  "projectStory" text NOT NULL,
  "projectCategory" text NOT NULL,
  "prefectureCode" text NOT NULL,
  "municipality" text NULL,
  "activityContent" text NULL,
  "snsLinks" jsonb NULL,
  "submittedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" timestamp(3) NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  "reviewedBy" text NULL,
  "phoneNumber" text NULL,
  "progress" "ProjectPhase" NOT NULL DEFAULT 'PLANNING',
  "recruitmentTypes" "LeaderApplicationRecruitmentType"[] NOT NULL DEFAULT '{}',
  "eventLocation" text NULL,
  "eventPeriod" text NULL,
  "recruitCount" integer NULL,
  "skillItemNeeds" text NULL,
  "skillItemDeadline" text NULL,
  "timeReturn" text NULL,
  "skillItemReturn" text NULL,
  "experienceOffered" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "leader_applications_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "leader_applications_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
-- Create index "leader_applications_accountId_idx" to table: "leader_applications"
CREATE INDEX "leader_applications_accountId_idx" ON "leader_applications" ("accountId");
-- Create index "leader_applications_reviewedBy_idx" to table: "leader_applications"
CREATE INDEX "leader_applications_reviewedBy_idx" ON "leader_applications" ("reviewedBy");
-- Create index "leader_applications_status_idx" to table: "leader_applications"
CREATE INDEX "leader_applications_status_idx" ON "leader_applications" ("status");
-- Create index "leader_applications_submittedAt_idx" to table: "leader_applications"
CREATE INDEX "leader_applications_submittedAt_idx" ON "leader_applications" ("submittedAt");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "leader_applications" IS 'リーダー応募（リーダーになるための申請）と運営の審査結果。応募内容は送信時点のスナップショットで、承認時に作られる projects とは参照でつながらない。ドメインの LeaderApplication 集約（project 系の列は ProjectDraft、連絡先・募集情報の列は LeaderApplicationSnapshot に載る）';
COMMENT ON COLUMN "leader_applications"."id" IS '応募 ID（UUID v4。アプリ側で生成）';
COMMENT ON COLUMN "leader_applications"."accountId" IS '応募者のアカウント';
COMMENT ON COLUMN "leader_applications"."status" IS 'PENDING=審査待ち / APPROVED=承認 / REJECTED=却下。承認・却下のあとは変わらない';
COMMENT ON COLUMN "leader_applications"."reviewerNote" IS '却下理由（却下するときは必須。最大 2000 文字）';
COMMENT ON COLUMN "leader_applications"."projectTitle" IS '立ち上げたいプロジェクトのタイトル（最大 60 文字）';
COMMENT ON COLUMN "leader_applications"."projectSummary" IS 'プロジェクトの概要（最大 150 文字）';
COMMENT ON COLUMN "leader_applications"."projectStory" IS 'プロジェクトのストーリー（Markdown。最大 300 文字）';
COMMENT ON COLUMN "leader_applications"."projectCategory" IS 'カテゴリ（MANUFACTURING / FOOD / NATURE / EVENT。CATEGORY_MASTER の値）';
COMMENT ON COLUMN "leader_applications"."prefectureCode" IS '活動場所の都道府県コード（JIS X 0401: 01〜47）';
COMMENT ON COLUMN "leader_applications"."municipality" IS '活動場所の市区町村（任意。最大 50 文字）';
COMMENT ON COLUMN "leader_applications"."activityContent" IS '活動内容（募集の種類に TIME を含むときは必須。最大 200 文字）';
COMMENT ON COLUMN "leader_applications"."snsLinks" IS 'SNS リンク（x / instagram / facebook / website の URL。それぞれ任意。JSON）';
COMMENT ON COLUMN "leader_applications"."submittedAt" IS '応募した日時';
COMMENT ON COLUMN "leader_applications"."reviewedAt" IS '運営が承認・却下した日時。審査前は NULL';
COMMENT ON COLUMN "leader_applications"."createdAt" IS '作成日時';
COMMENT ON COLUMN "leader_applications"."updatedAt" IS '更新日時（アプリ側で設定する）';
COMMENT ON COLUMN "leader_applications"."reviewedBy" IS '【未使用】審査した運営アカウント。どこからも書き込まれず常に NULL（審査の記録は admin_audit_logs に残る）';
COMMENT ON COLUMN "leader_applications"."phoneNumber" IS '応募時の電話番号（任意。最大 20 文字）。accounts.phoneNumber にも同じ値を保存する';
COMMENT ON COLUMN "leader_applications"."progress" IS '応募時点のプロジェクトの進み具合（VISION / PLANNING / READY / EXECUTION / ONGOING）';
COMMENT ON COLUMN "leader_applications"."recruitmentTypes" IS '出したい募集の種類（TIME=時間（やる気）での支援 / SKILL_ITEM=スキル・モノでの支援。1 つ以上）';
COMMENT ON COLUMN "leader_applications"."eventLocation" IS '開催場所（TIME を含むときは必須。最大 200 文字）';
COMMENT ON COLUMN "leader_applications"."eventPeriod" IS '実施期間（TIME を含むときは必須。最大 200 文字の自由記述）';
COMMENT ON COLUMN "leader_applications"."recruitCount" IS '募集人数（TIME を含むときは必須。1〜1000）';
COMMENT ON COLUMN "leader_applications"."skillItemNeeds" IS '募集したいスキル・モノの内容（SKILL_ITEM を含むときは必須。最大 200 文字）';
COMMENT ON COLUMN "leader_applications"."skillItemDeadline" IS 'スキル・モノの募集期限（SKILL_ITEM を含むときは必須。最大 200 文字の自由記述）';
COMMENT ON COLUMN "leader_applications"."timeReturn" IS '時間で支援した人へのリターン（TIME を含むときは必須。最大 200 文字）';
COMMENT ON COLUMN "leader_applications"."skillItemReturn" IS 'スキル・モノで支援した人へのリターン（SKILL_ITEM を含むときは必須。最大 200 文字）';
COMMENT ON COLUMN "leader_applications"."experienceOffered" IS 'サポーターが体験できること（必須。最大 150 文字）';
-- Create "projects" table
CREATE TABLE "projects" (
  "id" text NOT NULL,
  "ownerAccountId" text NOT NULL,
  "slug" text NULL,
  "title" text NOT NULL,
  "summary" text NULL,
  "story" text NULL,
  "leaderIntro" text NULL,
  "coverImageUrl" text NULL,
  "category" text NULL,
  "prefectureCode" text NULL,
  "municipality" text NULL,
  "snsLinks" jsonb NULL,
  "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "phase" "ProjectPhase" NOT NULL DEFAULT 'VISION',
  "publishRequestedAt" timestamp(3) NULL,
  "publishedAt" timestamp(3) NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  "activityPlan" text NULL,
  "forcedUnpublishedBy" text NULL,
  "reviewedBy" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "projects_forcedUnpublishedBy_fkey" FOREIGN KEY ("forcedUnpublishedBy") REFERENCES "admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "projects_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "accounts" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "projects_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
-- Create index "projects_category_idx" to table: "projects"
CREATE INDEX "projects_category_idx" ON "projects" ("category");
-- Create index "projects_forcedUnpublishedBy_idx" to table: "projects"
CREATE INDEX "projects_forcedUnpublishedBy_idx" ON "projects" ("forcedUnpublishedBy");
-- Create index "projects_ownerAccountId_idx" to table: "projects"
CREATE INDEX "projects_ownerAccountId_idx" ON "projects" ("ownerAccountId");
-- Create index "projects_prefectureCode_idx" to table: "projects"
CREATE INDEX "projects_prefectureCode_idx" ON "projects" ("prefectureCode");
-- Create index "projects_publishedAt_idx" to table: "projects"
CREATE INDEX "projects_publishedAt_idx" ON "projects" ("publishedAt");
-- Create index "projects_reviewedBy_idx" to table: "projects"
CREATE INDEX "projects_reviewedBy_idx" ON "projects" ("reviewedBy");
-- Create index "projects_slug_key" to table: "projects"
CREATE UNIQUE INDEX "projects_slug_key" ON "projects" ("slug");
-- Create index "projects_status_idx" to table: "projects"
CREATE INDEX "projects_status_idx" ON "projects" ("status");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "projects" IS 'リーダーが立ち上げるプロジェクト。公開審査（DRAFT → PENDING_REVIEW → PUBLISHED）を持つ。リーダー応募の承認時に、応募内容から下書きが作られる。ドメインの Project 集約';
COMMENT ON COLUMN "projects"."id" IS 'プロジェクト ID（UUID v4。アプリ側で生成）';
COMMENT ON COLUMN "projects"."ownerAccountId" IS '所有者（リーダー）のアカウント';
COMMENT ON COLUMN "projects"."slug" IS '公開ページ URL（/projects/{slug}）に使う文字列。初回の公開承認で id と同じ値を発行し、非公開にしても残す。初回承認までは NULL';
COMMENT ON COLUMN "projects"."title" IS 'タイトル（1〜100 文字）';
COMMENT ON COLUMN "projects"."summary" IS '概要（最大 300 文字。公開申請に必須）';
COMMENT ON COLUMN "projects"."story" IS '本文（Markdown。最大 10000 文字。公開申請に必須）。ドメインでは body';
COMMENT ON COLUMN "projects"."leaderIntro" IS 'リーダー紹介（最大 2000 文字。公開申請に必須）。ドメインでは leaderIntroduction';
COMMENT ON COLUMN "projects"."coverImageUrl" IS 'カバー画像の URL（公開申請に必須）';
COMMENT ON COLUMN "projects"."category" IS 'カテゴリ（MANUFACTURING / FOOD / NATURE / EVENT。公開申請に必須）';
COMMENT ON COLUMN "projects"."prefectureCode" IS '活動場所の都道府県コード（JIS X 0401: 01〜47。公開申請に必須）。ドメインでは location の一部';
COMMENT ON COLUMN "projects"."municipality" IS '活動場所の市区町村（任意）。ドメインでは location の一部';
COMMENT ON COLUMN "projects"."snsLinks" IS 'SNS リンク（x / instagram / facebook / website の URL。それぞれ任意。JSON）';
COMMENT ON COLUMN "projects"."status" IS '公開状態（DRAFT=下書き / PENDING_REVIEW=審査待ち / PUBLISHED=公開中）。ドメインでは publishStatus';
COMMENT ON COLUMN "projects"."phase" IS '進み具合のラベル（VISION / PLANNING / READY / EXECUTION / ONGOING）。どの値にも自由に切り替えられる';
COMMENT ON COLUMN "projects"."publishRequestedAt" IS '公開申請した日時。下書き（DRAFT）に戻ると NULL';
COMMENT ON COLUMN "projects"."publishedAt" IS '運営が公開を承認した日時。下書き（DRAFT）に戻ると NULL';
COMMENT ON COLUMN "projects"."createdAt" IS '作成日時';
COMMENT ON COLUMN "projects"."updatedAt" IS '更新日時（アプリ側で設定する）';
COMMENT ON COLUMN "projects"."activityPlan" IS '活動計画（任意。最大 1000 文字。公開申請にも必須ではない）';
COMMENT ON COLUMN "projects"."forcedUnpublishedBy" IS '【未使用】強制非公開にした運営アカウント。どこからも書き込まれず常に NULL（記録は project_review_feedbacks に残る）';
COMMENT ON COLUMN "projects"."reviewedBy" IS '【未使用】審査した運営アカウント。どこからも書き込まれず常に NULL（記録は project_review_feedbacks に残る）';
-- Create "project_review_feedbacks" table
CREATE TABLE "project_review_feedbacks" (
  "id" text NOT NULL,
  "projectId" text NOT NULL,
  "reviewerId" text NOT NULL,
  "action" "ReviewAction" NOT NULL,
  "note" text NULL,
  "reviewedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "project_review_feedbacks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "project_review_feedbacks_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
-- Create index "project_review_feedbacks_projectId_idx" to table: "project_review_feedbacks"
CREATE INDEX "project_review_feedbacks_projectId_idx" ON "project_review_feedbacks" ("projectId");
-- Create index "project_review_feedbacks_reviewedAt_idx" to table: "project_review_feedbacks"
CREATE INDEX "project_review_feedbacks_reviewedAt_idx" ON "project_review_feedbacks" ("reviewedAt");
-- Create index "project_review_feedbacks_reviewerId_idx" to table: "project_review_feedbacks"
CREATE INDEX "project_review_feedbacks_reviewerId_idx" ON "project_review_feedbacks" ("reviewerId");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "project_review_feedbacks" IS 'プロジェクトの公開審査の履歴（承認・差戻・強制非公開）。差戻が繰り返されても全件残る。ドメインの ProjectReviewFeedback（Project のサブエンティティ）';
COMMENT ON COLUMN "project_review_feedbacks"."id" IS '審査履歴 ID（UUID v4。アプリ側で生成）';
COMMENT ON COLUMN "project_review_feedbacks"."projectId" IS '審査したプロジェクト';
COMMENT ON COLUMN "project_review_feedbacks"."reviewerId" IS '審査した運営アカウント';
COMMENT ON COLUMN "project_review_feedbacks"."action" IS '審査の結果（APPROVED=承認 / REJECTED=差戻 / FORCE_UNPUBLISHED=強制非公開）';
COMMENT ON COLUMN "project_review_feedbacks"."note" IS '運営からのコメント（差戻・強制非公開では必須。最大 2000 文字）';
COMMENT ON COLUMN "project_review_feedbacks"."reviewedAt" IS '審査した日時';
COMMENT ON COLUMN "project_review_feedbacks"."createdAt" IS '作成日時';
-- Create "support_recruitments" table
CREATE TABLE "support_recruitments" (
  "id" text NOT NULL,
  "projectId" text NOT NULL,
  "type" "RecruitmentType" NOT NULL DEFAULT 'ACTIVITY',
  "title" text NOT NULL,
  "description" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "support_recruitments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "support_recruitments_projectId_idx" to table: "support_recruitments"
CREATE INDEX "support_recruitments_projectId_idx" ON "support_recruitments" ("projectId");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "support_recruitments" IS '【未実装 #212】サポート募集。プロジェクトに紐づく募集の単位。スキーマだけ存在し、コードはまだ無い';
COMMENT ON COLUMN "support_recruitments"."id" IS 'サポート募集 ID';
COMMENT ON COLUMN "support_recruitments"."projectId" IS '募集を出したプロジェクト';
COMMENT ON COLUMN "support_recruitments"."type" IS '募集の種類（初回リリースは ACTIVITY のみ）';
COMMENT ON COLUMN "support_recruitments"."title" IS '募集のタイトル';
COMMENT ON COLUMN "support_recruitments"."description" IS '募集の説明';
COMMENT ON COLUMN "support_recruitments"."createdAt" IS '作成日時';
COMMENT ON COLUMN "support_recruitments"."updatedAt" IS '更新日時（アプリ側で設定する）';
-- Create "recruitment_schedules" table
CREATE TABLE "recruitment_schedules" (
  "id" text NOT NULL,
  "supportRecruitmentId" text NOT NULL,
  "date" date NOT NULL,
  "startTime" text NOT NULL,
  "endTime" text NOT NULL,
  "capacityPerHour" integer NOT NULL,
  "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'AUTO',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "recruitment_schedules_supportRecruitmentId_fkey" FOREIGN KEY ("supportRecruitmentId") REFERENCES "support_recruitments" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "recruitment_schedules_date_idx" to table: "recruitment_schedules"
CREATE INDEX "recruitment_schedules_date_idx" ON "recruitment_schedules" ("date");
-- Create index "recruitment_schedules_supportRecruitmentId_date_key" to table: "recruitment_schedules"
CREATE UNIQUE INDEX "recruitment_schedules_supportRecruitmentId_date_key" ON "recruitment_schedules" ("supportRecruitmentId", "date");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "recruitment_schedules" IS '【未実装 #212】サポート募集の日程。1 募集につき 1 日 1 行で、その日の受付時間帯と、1 時間ごとの定員を持つ';
COMMENT ON COLUMN "recruitment_schedules"."id" IS '日程 ID';
COMMENT ON COLUMN "recruitment_schedules"."supportRecruitmentId" IS '日程が属するサポート募集';
COMMENT ON COLUMN "recruitment_schedules"."date" IS '開催日（JST のカレンダー日）';
COMMENT ON COLUMN "recruitment_schedules"."startTime" IS '受付時間帯の開始時刻（HH:MM 形式の JST）';
COMMENT ON COLUMN "recruitment_schedules"."endTime" IS '受付時間帯の終了時刻（HH:MM 形式の JST）。過ぎると新規の申し込みを締め切る想定';
COMMENT ON COLUMN "recruitment_schedules"."capacityPerHour" IS '1 時間ごとの定員（人数）。申し込みは先着順で、またがる全時間帯が定員内に収まる必要がある想定';
COMMENT ON COLUMN "recruitment_schedules"."approvalMode" IS '承認モード（AUTO=申し込んだ時点で確定 / MANUAL=リーダーの承認で確定）';
COMMENT ON COLUMN "recruitment_schedules"."createdAt" IS '作成日時';
COMMENT ON COLUMN "recruitment_schedules"."updatedAt" IS '更新日時（アプリ側で設定する）';
-- Create "support_tickets" table
CREATE TABLE "support_tickets" (
  "id" text NOT NULL,
  "recruitmentScheduleId" text NOT NULL,
  "supporterAccountId" text NOT NULL,
  "duration" integer NOT NULL,
  "slotStart" text NOT NULL,
  "companionCount" integer NOT NULL DEFAULT 0,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "support_tickets_recruitmentScheduleId_fkey" FOREIGN KEY ("recruitmentScheduleId") REFERENCES "recruitment_schedules" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "support_tickets_supporterAccountId_fkey" FOREIGN KEY ("supporterAccountId") REFERENCES "accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
-- Create index "support_tickets_recruitmentScheduleId_idx" to table: "support_tickets"
CREATE INDEX "support_tickets_recruitmentScheduleId_idx" ON "support_tickets" ("recruitmentScheduleId");
-- Create index "support_tickets_status_idx" to table: "support_tickets"
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" ("status");
-- Create index "support_tickets_supporterAccountId_idx" to table: "support_tickets"
CREATE INDEX "support_tickets_supporterAccountId_idx" ON "support_tickets" ("supporterAccountId");
-- 説明（docs/db/・Supabase Studio・types.ts の JSDoc に反映される）
COMMENT ON TABLE "support_tickets" IS '【未実装 #212】サポートチケット。サポーターが日程の中の時間帯に参加を申し込んだ記録。チケットは提供する時間の単位を表す言葉で、購入や在庫は無い';
COMMENT ON COLUMN "support_tickets"."id" IS 'サポートチケット ID';
COMMENT ON COLUMN "support_tickets"."recruitmentScheduleId" IS '申し込んだ日程';
COMMENT ON COLUMN "support_tickets"."supporterAccountId" IS '申し込んだサポーターのアカウント';
COMMENT ON COLUMN "support_tickets"."duration" IS '提供する時間の長さ（時間。チケットの区分 1 / 2 / 4）';
COMMENT ON COLUMN "support_tickets"."slotStart" IS '参加を始める時刻（HH:MM 形式の JST。1 時間単位）';
COMMENT ON COLUMN "support_tickets"."companionCount" IS '一緒に参加する同伴者の人数（申し込んだ本人は含まない想定。同伴者はアカウント不要）';
COMMENT ON COLUMN "support_tickets"."status" IS '申し込みの状態（PENDING=承認待ち / CONFIRMED=確定 / CANCELLED=取り消し / COMPLETED=完了。COMPLETED にする条件は未決）';
COMMENT ON COLUMN "support_tickets"."createdAt" IS '作成日時';
COMMENT ON COLUMN "support_tickets"."updatedAt" IS '更新日時（アプリ側で設定する）';
