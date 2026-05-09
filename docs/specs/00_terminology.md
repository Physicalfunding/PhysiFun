# 00. 用語集（コード視点の最小サブセット）

PhysiFun の実装に関わるエンジニアが、コード・schema・ドキュメントを読み書きするときに参照する用語集。

## このドキュメントの位置づけ

- **対象読者**: コードを書く・読むエンジニア（人間 / AI）
- **目的**: コードに登場する識別子・enum 値・概念用語を**ドメインの言葉と対応づける**
- **正本**: コード（型定義・enum 値）。本書はその対訳と意図の補足
- **揮発度**: 低（用語の追加・廃止が起きたときだけ更新）
- **スコープ外**: ビジネス側の完全な用語集（ターゲットユーザー像・マーケティング表現など）。それは別リポジトリで管理されている

> 💡 業務領域の用語は本書より広い（例: "応援コメント" "支援プラン" など）。本書は **コード上に現れる用語に絞った最小サブセット** として運用する。

---

## 1. ロール・アカウント

| 用語 | コード上の表現 | 説明 |
|---|---|---|
| **アカウント** | `Account` モデル / `AccountId` | 一般ユーザの単位。1 種類のみ |
| **運営アカウント** | `AdminAccount` モデル / `AdminAccountId` | `Account` と独立した運営専用アグリゲート。`apps/admin` でのみ使用 |
| **ロール** | `Role` enum | `SUPPORTER` / `LEADER` を `Account.roles[]` に保持（複数可） |
| **リーダー** | `Account` + `Role.LEADER` | プロジェクトを作成・運営する立場 |
| **サポーター** | `Account` + `Role.SUPPORTER` | プロジェクトに時間・スキルで参加する立場（Phase 2 で本格的に活性化） |
| **運営** | `AdminAccount` | リーダー応募・プロジェクト公開の審査を行う |

> ⚠️ `ADMIN` は `Role` enum に**含まれない**（`AdminAccount` 独立アグリゲートで分離）。

---

## 2. リーダー応募

| 用語 | コード上の表現 | 説明 |
|---|---|---|
| **リーダー応募** | `LeaderApplication` モデル | リーダーになるための申請。Phase 1 / Phase 2 共通の経路 |
| **応募ステータス** | `LeaderApplicationStatus` | `PENDING` / `APPROVED` / `REJECTED` |
| **プロジェクト案** | `ProjectDraft` 値オブジェクト | 応募時のプロジェクト情報スナップショット（承認後の Project と直接リンクしない） |
| **アクティベーション** | `Account.activationToken` / `ActivateAccountUseCase` | 応募者がメール経由でパスワード設定し `ACTIVE` 化する流れ |
| **アクティベーショントークン** | `Account.activationToken` | 24 時間有効の URL 付きトークン |

詳細は `02_domain-model.md` §4 / `05_key-flows/` 参照。

---

## 3. プロジェクト公開ライフサイクル

`Project.publishStatus` (`PublishStatus` enum) で管理する**厳格な状態機械**。

| 値 | 意味 |
|---|---|
| `DRAFT` | 下書き |
| `PENDING_REVIEW` | 公開申請中（運営審査待ち） |
| `PUBLISHED` | 公開済み |

| 操作（コード上のメソッド） | 遷移 | 主体 |
|---|---|---|
| `requestPublish()` | `DRAFT` → `PENDING_REVIEW` | リーダー |
| `approveByAdmin()` | `PENDING_REVIEW` → `PUBLISHED` | 運営 |
| `rejectByAdmin()` | `PENDING_REVIEW` → `DRAFT` | 運営（差戻） |
| `withdraw()` | `PENDING_REVIEW` → `DRAFT` | リーダー（自主取下げ） |
| `update()` で自動降格 | `PENDING_REVIEW` → `DRAFT` | リーダー編集時の副作用 |
| `unpublishSelf()` | `PUBLISHED` → `DRAFT` | リーダー（自主非公開） |
| `forceUnpublish()` | `PUBLISHED` → `DRAFT` | 運営（強制非公開） |

詳細遷移図は `02_domain-model.md` §3.6。

---

## 4. プロジェクトフェーズ（ラベル）

`Project.phase` (`ProjectPhase` enum) は**状態機械ではなくラベル**。任意の値間を双方向に遷移できる。

| 値 | 意味 |
|---|---|
| `VISION` | 構想中 |
| `PLANNING` | 計画中 |
| `READY` | 準備完了 |
| `EXECUTION` | 実行中 |
| `ONGOING` | 継続運営中 |

> ⚠️ `PublishStatus`（厳格）と `ProjectPhase`（自由）は**直交した別軸**。混同しない。

---

## 5. 募集（Recruitment）

Phase 1 では schema のみ存在し、ドメイン層・UI 実装は無い（Phase 2 で起動予定）。

| 用語 | コード上の表現 | 説明 |
|---|---|---|
| **サポート募集** | `SupportRecruitment` モデル | プロジェクトに紐付く募集の単位 |
| **募集スケジュール** | `RecruitmentSchedule` モデル | 1 日単位の時間帯枠（日付 + 開始/終了時刻 + 1 時間あたり定員、JST） |
| **サポートチケット** | `SupportTicket` モデル | サポーターが時間を提供する単位（1h / 2h / 4h） |
| **承認モード** | `ApprovalMode` enum | `AUTO` / `MANUAL` |

### 募集タイプの 2 つの enum（紛らわしいので注意）

| Enum | 値 | 用途 |
|---|---|---|
| `LeaderApplicationRecruitmentType` | `TIME` / `SKILL_ITEM` | **応募フォーム上**で「どんな募集を出すか」をリーダーが選ぶ |
| `RecruitmentType` | `ACTIVITY` | 実際の `SupportRecruitment` 投稿の種別。Phase 1 は `ACTIVITY` のみ |

> 💡 名前が似ているが**別物**。応募時の希望表明と、実際の募集投稿の種別は概念的に異なるため意図的に分けている。

---

## 6. リターン

| 用語 | コード上の表現 | 説明 |
|---|---|---|
| **リターン** | （現状ドメイン層に対応エンティティ無し） | リーダーがサポーターに提供するお礼。**Recruitment 実装時に新設・復活が必要** |
| **時間リターン** | `LeaderApplication.timeReturn` | TIME 募集向けのリターン情報（応募時のテキストフィールド） |
| **スキル・モノリターン** | `LeaderApplication.skillItemReturn` | SKILL_ITEM 募集向けのリターン情報 |

業務方針:

- **リターンは募集ごとに必須**
- **リターンの設計（内容・条件）はリーダーが行う**（運営は審査・ガイドライン提供）
- **金銭リターンも可能**（決済・送金・KYC・税務処理が将来的な要件）

> ⚠️ 過去のドメインスナップショットでは「リターン不採用」とされていた経緯がある。廃止された `Return.ts` は再設計対象。

---

## 7. 提供時間・参加時間

| 用語 | コード上の表現 | 説明 |
|---|---|---|
| **提供時間** | `Account.contributedHours` | そのアカウントが他プロジェクトでサポーターとして提供した時間の累計 |
| **参加時間** | `Account.receivedHours` | そのアカウント（リーダー）が自分のプロジェクトでサポーターから受けた時間の累計 |

> ⚠️ 英語表現 `GIVE` / `TAKE` は使わない（PDF など旧資料に出てくるが NG）。

---

## 8. コミュニケーション

| 用語 | 実装上の扱い | 説明 |
|---|---|---|
| **LINE オープンチャット**（オプチャ） | プロジェクトレコードの URL フィールド（仮） | サービス内メッセージ機能の代替。事務局が作成しリーダーに権限移行 |

> ⚠️ サービス内メッセージング機能は **初回リリースで実装しない**。PDF やワイヤーで「メッセージを送る」ボタンが見えても、コード上は LINE オプチャ URL に置き換える。

---

## 9. 認証・認可

### web ユーザ（apps/web）

| 用語 | コード上の表現 | 説明 |
|---|---|---|
| **Credentials Provider** | `apps/web` の `next-auth` 設定 | メール + パスワードでログイン |
| **JWT セッション** | `next-auth` 戦略 | 30 日 |
| **パスワードハッシュ** | `passwordHash` カラム / `BcryptPasswordHasher` | bcrypt（saltRounds=10） |
| **タイミング攻撃回避** | `PrismaAuthenticateAdapter` 内 | 存在しないアカウントでもダミーハッシュ比較する |

### 運営（apps/admin）

| 用語 | コード上の表現 | 説明 |
|---|---|---|
| **Magic Link** | `next-auth` の `EmailProvider` | メール内 URL でログイン（パスワード持たない） |
| **Database セッション** | `AdminSession` モデル / `next-auth` 戦略 | TTL 1 時間 |
| **Magic Link HMAC** | `ADMIN_MAGIC_LINK_HMAC_SECRET` 環境変数 | URL 改ざん防止 |
| **AdminAccount の論理無効化** | `AdminAccount.disable()` | 物理削除せず `status: DISABLED` にする |

詳細は `04_security-design.md`（作成予定）参照。

---

## 10. 非同期処理（Outbox）

| 用語 | コード上の表現 | 説明 |
|---|---|---|
| **Outbox メッセージ** | `LeaderApplicationOutboxMessage` / `ProjectOutboxMessage` モデル | アグリゲート単位の非同期イベント |
| **クレームロック** | `claimedAt` / `claimedBy` カラム | ワーカーの重複処理を防ぐ排他制御 |
| **Dead Letter** | `deadLetteredAt` カラム | 最大リトライ超過で再試行対象から除外 |
| **Outbox ワーカー** | `LeaderApplicationOutboxWorker` / `ProjectOutboxWorker` | Vercel Cron + リクエスト後の `after()` で起動 |

詳細は `03_data-model.md` §5 / `05_key-flows/outbox-mail.md`（作成予定）参照。

---

## 11. コード設計用語

| 用語 | 定義 |
|---|---|
| **アグリゲート** | DDD の集約。一貫性境界を保つエンティティ群のルート単位（`Account` / `AdminAccount` / `LeaderApplication` / `Project`） |
| **バウンデッドコンテキスト** | DDD の境界。`packages/domain/src/{account, admin-account, leader-application, project}/` がそれぞれ対応 |
| **値オブジェクト** | 同値性で識別される不変オブジェクト（`ProjectId` / `Email` など） |
| **リポジトリ** | アグリゲートの永続化を抽象化するインターフェース（実装は `infrastructure/`） |
| **アダプタ** | リポジトリインターフェースの Prisma 実装（`PrismaXxxRepository` / `PrismaXxxAdapter`） |
| **ユースケース** | アプリケーション層のビジネスロジック単位（`packages/application/src/`） |
| **`Result<T, E>` 型** | 成功/失敗を判別共用体で返す（例外を使わない）。`packages/domain/src/shared/result.ts` |
| **Outbox パターン** | DB 書き込みと非同期メッセージ発行を同一トランザクションで行う設計パターン |

---

## 12. NG 用語と置き換え

コード・ドキュメント・UI 文言で**使ってはいけない用語**と、置き換え先。

| ❌ NG | ✅ 正式 | 補足 |
|---|---|---|
| 支援者 | サポーター | |
| プロジェクトリーダー | リーダー | 冗長表現を避ける |
| ホスト / オーナー | リーダー | |
| ゲスト | サポーター | |
| オーナー応募 / `OwnerEntry` | リーダー応募 / `LeaderApplication` | |
| 仲間募集 | サポート募集 | |
| 支援プラン | サポートチケット | |
| チケット在庫 | （使わない） | 在庫概念は存在しない |
| GIVE | 提供時間 | |
| TAKE | 参加時間 | |
| 「メッセージを送る」ボタン | （削除）→ LINE オプチャリンク | サービス内メッセージは作らない |

---

## 13. 表記揺れに注意したいペア

| ペア | 違い |
|---|---|
| `LeaderApplicationRecruitmentType` ↔ `RecruitmentType` | §5 参照。応募時の希望表明 vs 実際の募集投稿種別 |
| `PublishStatus` ↔ `ProjectPhase` | §3 / §4 参照。厳格な状態機械 vs 自由なラベル |
| `Account` ↔ `AdminAccount` | §1 参照。**完全に独立したアグリゲート**（Cookie・セッション・Vercel プロジェクトも分離） |
| `LeaderApplication` の `accountId` ↔ `Project` の `ownerAccountId` | 同じ Account への参照だが命名規則が違う（前者は応募者、後者は所有者の意味づけ） |
| `reviewedBy` ↔ `forcedUnpublishedBy` | どちらも `AdminAccount` への参照だが、それぞれ「審査者」と「強制非公開実行者」の異なる責任 |
| `body`（ドメイン）↔ `story`（Prisma） | Project 本文。命名揺れあり（`03_data-model.md` §9 参照） |
| `leaderIntroduction`（ドメイン）↔ `leaderIntro`（Prisma） | リーダー紹介。同上 |

---

## 14. 改訂履歴

| 日付 | 改訂内容 | 担当 |
|---|---|---|
| 2026-05-09 | 初稿作成（コード視点の最小用語集として整備） | 設計チーム |
