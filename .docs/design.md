# 設計書

## 1. システムアーキテクチャ

### 1.1 技術スタック

#### フレームワーク・ライブラリ

- **Next.js 16** (App Router) - フルスタック React フレームワーク
- **TypeScript** - 型安全な開発
- **React 19** - UI ライブラリ
- **Tailwind CSS** - ユーティリティファースト CSS フレームワーク

#### データベース・ORM

- **PostgreSQL** - リレーショナルデータベース
- **Prisma** - 型安全な ORM

#### 認証

- **NextAuth.js** - Next.js 公式認証ライブラリ
- **bcrypt** - パスワードハッシュ化
- **jose** - JWT 処理

#### フォーム・バリデーション

- **React Hook Form** - フォーム管理
- **Zod** - スキーマバリデーション

#### テスト

- **Jest** - ユニットテストフレームワーク
- **React Testing Library** - コンポーネントテスト
- **Playwright** - E2E テスト（将来実装）

#### パッケージマネージャー

- **Bun** - 高速パッケージマネージャー・ランタイム

### 1.2 アーキテクチャパターン

本システムは**クリーンアーキテクチャ + ドメイン駆動設計 (DDD)** を採用する。

#### レイヤー構成

```
┌─────────────────────────────────────────┐
│   Presentation Layer (Next.js)          │
│   - Pages (App Router)                  │
│   - API Routes                          │
│   - UI Components                       │
└─────────────────────────────────────────┘
              ↓ depends on
┌─────────────────────────────────────────┐
│   Application Layer                     │
│   - Use Cases (ビジネスロジックの実行)   │
│   - DTOs (データ転送オブジェクト)        │
└─────────────────────────────────────────┘
              ↓ depends on
┌─────────────────────────────────────────┐
│   Domain Layer                          │
│   - Entities (エンティティ)              │
│   - Value Objects (値オブジェクト)       │
│   - Domain Services                     │
│   - Repository Interfaces               │
└─────────────────────────────────────────┘
              ↑ implemented by
┌─────────────────────────────────────────┐
│   Infrastructure Layer                  │
│   - Prisma Repository Implementations   │
│   - External API Clients                │
│   - Database Migrations                 │
└─────────────────────────────────────────┘
```

### 1.3 ディレクトリ構成

```
src/
├── app/                        # Presentation Layer (Next.js App Router)
│   ├── (public)/              # 公開ページグループ
│   │   ├── page.tsx           # ホームページ
│   │   ├── projects/          # プロジェクト一覧・詳細
│   │   └── search/            # 検索ページ
│   ├── my/                    # マイページグループ（認証必須）
│   │   ├── layout.tsx         # マイページレイアウト
│   │   ├── profile/           # プロフィール
│   │   ├── project/           # プロジェクト管理
│   │   ├── participations/    # 参加予定一覧
│   │   └── messages/          # メッセージ
│   └── api/                   # API Routes
│       ├── auth/              # 認証API
│       ├── users/             # ユーザーAPI
│       ├── projects/          # プロジェクトAPI
│       ├── schedules/         # スケジュールAPI
│       ├── participations/    # 参加申し込みAPI
│       └── messages/          # メッセージAPI
│
├── components/                 # UI Components (Client Components)
│   ├── auth/                  # 認証関連コンポーネント
│   ├── project/               # プロジェクト関連
│   ├── schedule/              # スケジュール関連
│   └── common/                # 共通コンポーネント
│
├── application/                # Application Layer
│   └── use-cases/             # ユースケース
│       ├── auth/              # 認証ユースケース
│       ├── project/           # プロジェクトユースケース
│       ├── schedule/          # スケジュールユースケース
│       ├── participation/     # 参加申し込みユースケース
│       └── message/           # メッセージユースケース
│
├── domain/                     # Domain Layer
│   ├── account/               # アカウント集約
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── repositories/
│   │   └── services/
│   ├── project/               # プロジェクト集約
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── repositories/
│   │   └── services/
│   ├── schedule/              # スケジュール集約
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── repositories/
│   │   └── services/
│   ├── participation/         # 参加申し込み集約
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── repositories/
│   │   └── services/
│   └── message/               # メッセージ集約
│       ├── entities/
│       ├── repositories/
│       └── services/
│
└── infrastructure/             # Infrastructure Layer
    └── database/
        ├── prisma/
        │   └── schema.prisma  # Prismaスキーマ定義
        └── repositories/      # リポジトリ実装
            ├── UserRepository.ts
            ├── ProjectRepository.ts
            ├── ScheduleRepository.ts
            ├── ParticipationRepository.ts
            └── MessageRepository.ts
```

---

## 2. ドメインモデル設計

### 2.1 エンティティ一覧

#### User（ユーザー）

```typescript
class User {
  id: UserId; // 値オブジェクト
  email: Email; // 値オブジェクト（バリデーション含む）
  password: HashedPassword; // 値オブジェクト（ハッシュ化済み）
  profile: UserProfile; // 値オブジェクト
  userType: UserType; // 値オブジェクト
  createdAt: Date;
  updatedAt: Date;
}
```

#### Project（プロジェクト）

```typescript
class Project {
  id: ProjectId;
  hostId: UserId;
  title: string;
  summary: string;
  description: string;
  category: Category; // 値オブジェクト
  location: Location; // 値オブジェクト
  imageUrls: string[];
  status: ProjectStatus; // 値オブジェクト（DRAFT/PUBLISHED）
  returns: Return[]; // エンティティ配列
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}
```

#### Return（リターン）

```typescript
class Return {
  id: ReturnId;
  projectId: ProjectId;
  name: string;
  description: string;
  estimatedDeliveryDate: Date | null;
  quantityLimit: number | null;
  order: number; // 表示順
  createdAt: Date;
}
```

#### ExperienceSchedule（体験スケジュール）

```typescript
class ExperienceSchedule {
  id: ScheduleId;
  projectId: ProjectId;
  title: string;
  description: string;
  startDateTime: Date;
  duration: number | null; // 分単位
  capacity: number; // 募集人数
  requirements: string | null; // 持ち物・注意事項
  createdAt: Date;
  updatedAt: Date;
}
```

#### Participation（参加申し込み）

```typescript
class Participation {
  id: ParticipationId;
  guestId: UserId;
  scheduleId: ScheduleId;
  participantCount: number; // 参加人数（本人含む）
  status: ParticipationStatus; // 値オブジェクト（PENDING/CONFIRMED/CANCELLED）
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Message（メッセージ）

```typescript
class Message {
  id: MessageId;
  senderId: UserId;
  receiverId: UserId;
  subject: string;
  body: string;
  isRead: boolean;
  parentMessageId: MessageId | null; // 返信元メッセージID
  createdAt: Date;
  readAt: Date | null;
}
```

### 2.2 値オブジェクト一覧

#### Account Domain

- **Email**: メールアドレス（形式バリデーション）
- **HashedPassword**: ハッシュ化されたパスワード（最小 8 文字のバリデーション）
- **UserProfile**: ユーザー名、自己紹介、プロフィール画像 URL
- **UserType**: リーダー/サポーター/両方の列挙型（LEADER/SUPPORTER/BOTH）

#### Project Domain

- **ProjectStatus**: DRAFT（下書き）/ PUBLISHED（公開）
- **Category**: カテゴリ（古民家再生、米作り、DIY など）
- **Location**: 開催場所（住所または地域情報）

#### Participation Domain

- **ParticipationStatus**: PENDING（申し込み）/ CONFIRMED（確定）/ CANCELLED（キャンセル）

### 2.3 ビジネスルール

#### アカウント管理

- 同一メールアドレスでの重複登録禁止
- パスワードは 8 文字以上必須
- ログイン時の認証情報検証
- セッション管理（JWT 使用）

#### プロジェクト管理

- プロジェクトの作成はリーダーのみ可能
- 1 アカウント 1 プロジェクト制限（MVP 段階）
- 公開前にプレビュー可能
- 公開後も編集可能、下書きに戻すことも可能
- リターンは複数設定可能
- 画像は複数アップロード可能

#### スケジュール管理

- スケジュールの作成はプロジェクトのリーダーのみ可能
- 参加申し込みがある場合、削除時に警告
- 開催日時は未来の日時のみ設定可能

#### 参加申し込み管理

- サポーターのみ参加申し込み可能
- 募集人数を超える申し込みは不可
- 同一サポーターが同じスケジュールに複数回申し込み不可
- 申し込み時にスケジュールの残り枠を確認

#### メッセージング

- サポーターは参加申し込みをしたプロジェクトのリーダーにのみメッセージ送信可能
- リーダーは自分のプロジェクトに参加申し込みしたサポーターにメッセージ送信可能
- メッセージ送信前に参加関係を検証
- 返信は元のメッセージに紐づく（スレッド形式）
- 既読/未読の管理

---

## 3. データモデル設計

### 3.1 ER 図

```mermaid
erDiagram
    User ||--o{ Project : "hosts"
    User ||--o{ Participation : "participates"
    User ||--o{ Message : "sends"
    User ||--o{ Message : "receives"

    Project ||--o{ Return : "has"
    Project ||--o{ ExperienceSchedule : "has"

    ExperienceSchedule ||--o{ Participation : "has"

    Message ||--o{ Message : "replies to"

    User {
        string id PK
        string email UK
        string passwordHash
        string name
        string bio
        string avatarUrl
        enum userType
        datetime createdAt
        datetime updatedAt
    }

    Project {
        string id PK
        string hostId FK
        string title
        text summary
        text description
        string category
        string location
        array imageUrls
        enum status
        datetime createdAt
        datetime updatedAt
        datetime publishedAt
    }

    Return {
        string id PK
        string projectId FK
        string name
        text description
        datetime estimatedDeliveryDate
        int quantityLimit
        int order
        datetime createdAt
    }

    ExperienceSchedule {
        string id PK
        string projectId FK
        string title
        text description
        datetime startDateTime
        int duration
        int capacity
        text requirements
        datetime createdAt
        datetime updatedAt
    }

    Participation {
        string id PK
        string guestId FK
        string scheduleId FK
        int participantCount
        enum status
        datetime appliedAt
        datetime createdAt
        datetime updatedAt
    }

    Message {
        string id PK
        string senderId FK
        string receiverId FK
        string subject
        text body
        boolean isRead
        string parentMessageId FK
        datetime createdAt
        datetime readAt
    }
```

### 3.2 Prisma スキーマ定義

```prisma
// datasource と generator の設定
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==================== User ====================
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  name          String
  bio           String?
  avatarUrl     String?
  userType      UserType
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // リレーション
  projects         Project[]
  participations   Participation[]
  sentMessages     Message[] @relation("sender")
  receivedMessages Message[] @relation("receiver")

  @@map("users")
}

enum UserType {
  LEADER
  SUPPORTER
  BOTH
}

// ==================== Project ====================
model Project {
  id            String        @id @default(uuid())
  hostId        String
  title         String
  summary       String        @db.Text
  description   String        @db.Text
  category      String
  location      String
  imageUrls     String[]
  status        ProjectStatus @default(DRAFT)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  publishedAt   DateTime?

  // リレーション
  host          User          @relation(fields: [hostId], references: [id])
  returns       Return[]
  schedules     ExperienceSchedule[]

  @@map("projects")
}

enum ProjectStatus {
  DRAFT
  PUBLISHED
}

model Return {
  id                      String    @id @default(uuid())
  projectId               String
  name                    String
  description             String    @db.Text
  estimatedDeliveryDate   DateTime?
  quantityLimit           Int?
  order                   Int       @default(0)
  createdAt               DateTime  @default(now())

  // リレーション
  project                 Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("returns")
}

// ==================== ExperienceSchedule ====================
model ExperienceSchedule {
  id                  String    @id @default(uuid())
  projectId           String
  title               String
  description         String    @db.Text
  startDateTime       DateTime
  duration            Int?
  capacity            Int
  requirements        String?   @db.Text
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // リレーション
  project             Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  participations      Participation[]

  @@map("experience_schedules")
}

// ==================== Participation ====================
model Participation {
  id                String              @id @default(uuid())
  guestId           String
  scheduleId        String
  participantCount  Int                 @default(1)
  status            ParticipationStatus @default(PENDING)
  appliedAt         DateTime            @default(now())
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  // リレーション
  guest             User                @relation(fields: [guestId], references: [id])
  schedule          ExperienceSchedule  @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

  @@unique([guestId, scheduleId])
  @@map("participations")
}

enum ParticipationStatus {
  PENDING
  CONFIRMED
  CANCELLED
}

// ==================== Message ====================
model Message {
  id              String    @id @default(uuid())
  senderId        String
  receiverId      String
  subject         String
  body            String    @db.Text
  isRead          Boolean   @default(false)
  parentMessageId String?
  createdAt       DateTime  @default(now())
  readAt          DateTime?

  // リレーション
  sender          User      @relation("sender", fields: [senderId], references: [id])
  receiver        User      @relation("receiver", fields: [receiverId], references: [id])
  parentMessage   Message?  @relation("replies", fields: [parentMessageId], references: [id])
  replies         Message[] @relation("replies")

  @@map("messages")
}
```

### 3.3 インデックス設計

パフォーマンス最適化のための推奨インデックス：

```prisma
// User
@@index([email])

// Project
@@index([hostId])
@@index([status])
@@index([category])
@@index([location])
@@index([publishedAt])

// ExperienceSchedule
@@index([projectId])
@@index([startDateTime])

// Participation
@@index([guestId])
@@index([scheduleId])
@@index([status])

// Message
@@index([senderId])
@@index([receiverId])
@@index([parentMessageId])
@@index([isRead])
```

---

## 4. API 設計

### 4.1 認証 API

#### POST /api/auth/register

ユーザー登録

**リクエスト:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "山田太郎",
  "userType": "LEADER" | "SUPPORTER" | "BOTH"
}
```

**レスポンス:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "山田太郎",
    "userType": "LEADER"
  },
  "token": "jwt-token"
}
```

---

#### POST /api/auth/login

ログイン

**リクエスト:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**レスポンス:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "山田太郎",
    "userType": "LEADER"
  },
  "token": "jwt-token"
}
```

---

#### POST /api/auth/logout

ログアウト

**レスポンス:**

```json
{
  "success": true
}
```

---

### 4.2 ユーザー API

#### GET /api/users/me

現在のユーザー情報取得（認証必須）

**レスポンス:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "山田太郎",
    "bio": "自己紹介文",
    "avatarUrl": "https://...",
    "userType": "LEADER"
  }
}
```

---

#### PUT /api/users/me

プロフィール更新（認証必須）

**リクエスト:**

```json
{
  "name": "山田太郎",
  "bio": "新しい自己紹介文",
  "avatarUrl": "https://..."
}
```

**レスポンス:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "山田太郎",
    "bio": "新しい自己紹介文",
    "avatarUrl": "https://...",
    "userType": "LEADER"
  }
}
```

---

#### POST /api/users/me/avatar

プロフィール画像アップロード（認証必須）

**リクエスト:** `FormData { file }`

**レスポンス:**

```json
{
  "avatarUrl": "https://..."
}
```

---

### 4.3 プロジェクト API

#### POST /api/projects

プロジェクト作成（リーダー認証必須）

**リクエスト:**

```json
{
  "title": "古民家再生プロジェクト",
  "summary": "100年の歴史を持つ古民家を再生します",
  "description": "詳細な説明...",
  "category": "古民家再生",
  "location": "長野県松本市",
  "imageUrls": ["https://..."]
}
```

**レスポンス:**

```json
{
  "project": {
    "id": "uuid",
    "hostId": "uuid",
    "title": "古民家再生プロジェクト",
    "summary": "100年の歴史を持つ古民家を再生します",
    "description": "詳細な説明...",
    "category": "古民家再生",
    "location": "長野県松本市",
    "imageUrls": ["https://..."],
    "status": "DRAFT",
    "createdAt": "2026-01-03T00:00:00Z",
    "updatedAt": "2026-01-03T00:00:00Z",
    "publishedAt": null
  }
}
```

---

#### PUT /api/projects/:id

プロジェクト更新（リーダー認証必須）

**リクエスト:**

```json
{
  "title": "古民家再生プロジェクト（更新）",
  "summary": "更新された概要",
  "description": "更新された詳細...",
  "category": "古民家再生",
  "location": "長野県松本市",
  "imageUrls": ["https://..."]
}
```

**レスポンス:**

```json
{
  "project": {
    /* 更新されたプロジェクト */
  }
}
```

---

#### PATCH /api/projects/:id/publish

プロジェクト公開（リーダー認証必須）

**レスポンス:**

```json
{
  "project": {
    "id": "uuid",
    "status": "PUBLISHED",
    "publishedAt": "2026-01-03T10:00:00Z"
  }
}
```

---

#### PATCH /api/projects/:id/unpublish

プロジェクト非公開化（リーダー認証必須）

**レスポンス:**

```json
{
  "project": {
    "id": "uuid",
    "status": "DRAFT",
    "publishedAt": null
  }
}
```

---

#### GET /api/projects

公開プロジェクト一覧取得

**クエリパラメータ:**

- `keyword`: 検索キーワード
- `category`: カテゴリフィルタ
- `location`: 地域フィルタ
- `page`: ページ番号（デフォルト: 1）
- `limit`: 1 ページあたりの件数（デフォルト: 20）

**レスポンス:**

```json
{
  "projects": [
    {
      "id": "uuid",
      "title": "古民家再生プロジェクト",
      "summary": "100年の歴史を持つ古民家を再生します",
      "category": "古民家再生",
      "location": "長野県松本市",
      "imageUrls": ["https://..."],
      "publishedAt": "2026-01-03T10:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

#### GET /api/projects/:id/public

プロジェクト詳細取得（公開情報）

**レスポンス:**

```json
{
  "project": {
    "id": "uuid",
    "title": "古民家再生プロジェクト",
    "summary": "100年の歴史を持つ古民家を再生します",
    "description": "詳細な説明...",
    "category": "古民家再生",
    "location": "長野県松本市",
    "imageUrls": ["https://..."],
    "publishedAt": "2026-01-03T10:00:00Z"
  },
  "schedules": [
    {
      "id": "uuid",
      "title": "第1回 古民家清掃",
      "startDateTime": "2026-02-01T10:00:00Z",
      "capacity": 10
    }
  ],
  "returns": [
    {
      "id": "uuid",
      "name": "古民家宿泊権",
      "description": "再生後の古民家に1泊宿泊できます"
    }
  ]
}
```

---

#### GET /api/my/project

自分のプロジェクト取得（リーダー認証必須）

**レスポンス:**

```json
{
  "project": { /* プロジェクト情報 */ } | null
}
```

---

#### POST /api/projects/:id/images

プロジェクト画像アップロード（リーダー認証必須）

**リクエスト:** `FormData { files }`

**レスポンス:**

```json
{
  "imageUrls": ["https://...", "https://..."]
}
```

---

### 4.4 リターン API

#### POST /api/projects/:id/returns

リターン追加（リーダー認証必須）

**リクエスト:**

```json
{
  "name": "古民家宿泊権",
  "description": "再生後の古民家に1泊宿泊できます",
  "estimatedDeliveryDate": "2026-12-31T00:00:00Z",
  "quantityLimit": 10
}
```

**レスポンス:**

```json
{
  "return": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "古民家宿泊権",
    "description": "再生後の古民家に1泊宿泊できます",
    "estimatedDeliveryDate": "2026-12-31T00:00:00Z",
    "quantityLimit": 10,
    "order": 0
  }
}
```

---

#### PUT /api/projects/:projectId/returns/:returnId

リターン更新（リーダー認証必須）

**リクエスト:**

```json
{
  "name": "古民家宿泊権（更新）",
  "description": "更新された説明",
  "estimatedDeliveryDate": "2027-01-31T00:00:00Z",
  "quantityLimit": 15
}
```

**レスポンス:**

```json
{
  "return": {
    /* 更新されたリターン */
  }
}
```

---

#### DELETE /api/projects/:projectId/returns/:returnId

リターン削除（リーダー認証必須）

**レスポンス:**

```json
{
  "success": true
}
```

---

### 4.5 スケジュール API

#### POST /api/projects/:projectId/schedules

体験スケジュール作成（リーダー認証必須）

**リクエスト:**

```json
{
  "title": "第1回 古民家清掃",
  "description": "古民家の清掃作業を行います",
  "startDateTime": "2026-02-01T10:00:00Z",
  "duration": 180,
  "capacity": 10,
  "requirements": "作業着、軍手をご持参ください"
}
```

**レスポンス:**

```json
{
  "schedule": {
    "id": "uuid",
    "projectId": "uuid",
    "title": "第1回 古民家清掃",
    "description": "古民家の清掃作業を行います",
    "startDateTime": "2026-02-01T10:00:00Z",
    "duration": 180,
    "capacity": 10,
    "requirements": "作業着、軍手をご持参ください"
  }
}
```

---

#### PUT /api/projects/:projectId/schedules/:scheduleId

体験スケジュール更新（リーダー認証必須）

**リクエスト:**

```json
{
  "title": "第1回 古民家清掃（更新）",
  "description": "更新された説明",
  "startDateTime": "2026-02-02T10:00:00Z",
  "duration": 240,
  "capacity": 15,
  "requirements": "更新された持ち物"
}
```

**レスポンス:**

```json
{
  "schedule": {
    /* 更新されたスケジュール */
  }
}
```

---

#### DELETE /api/projects/:projectId/schedules/:scheduleId

体験スケジュール削除（リーダー認証必須）

**レスポンス:**

```json
{
  "success": true,
  "warnings": ["参加申し込みが3件あります"]
}
```

---

#### GET /api/projects/:projectId/schedules

プロジェクトのスケジュール一覧取得

**レスポンス:**

```json
{
  "schedules": [
    {
      "id": "uuid",
      "title": "第1回 古民家清掃",
      "startDateTime": "2026-02-01T10:00:00Z",
      "capacity": 10
    }
  ]
}
```

---

#### GET /api/schedules/:scheduleId

スケジュール詳細取得

**レスポンス:**

```json
{
  "schedule": {
    "id": "uuid",
    "title": "第1回 古民家清掃",
    "description": "古民家の清掃作業を行います",
    "startDateTime": "2026-02-01T10:00:00Z",
    "duration": 180,
    "capacity": 10,
    "requirements": "作業着、軍手をご持参ください"
  },
  "availableSlots": 7
}
```

---

### 4.6 参加申し込み API

#### POST /api/schedules/:scheduleId/participate

体験参加申し込み（サポーター認証必須）

**リクエスト:**

```json
{
  "participantCount": 2
}
```

**レスポンス:**

```json
{
  "participation": {
    "id": "uuid",
    "guestId": "uuid",
    "scheduleId": "uuid",
    "participantCount": 2,
    "status": "PENDING",
    "appliedAt": "2026-01-03T10:00:00Z"
  }
}
```

---

#### GET /api/my/participations

自分の参加予定一覧取得（サポーター認証必須）

**クエリパラメータ:**

- `status`: PENDING | CONFIRMED | CANCELLED
- `upcoming`: true（今後の体験のみ）

**レスポンス:**

```json
{
  "participations": [
    {
      "id": "uuid",
      "guestId": "uuid",
      "scheduleId": "uuid",
      "participantCount": 2,
      "status": "PENDING",
      "appliedAt": "2026-01-03T10:00:00Z",
      "schedule": {
        "id": "uuid",
        "title": "第1回 古民家清掃",
        "startDateTime": "2026-02-01T10:00:00Z",
        "project": {
          "id": "uuid",
          "title": "古民家再生プロジェクト",
          "location": "長野県松本市"
        }
      }
    }
  ]
}
```

---

#### GET /api/schedules/:scheduleId/participants

スケジュールの参加者一覧取得（リーダー認証必須）

**レスポンス:**

```json
{
  "participants": [
    {
      "id": "uuid",
      "participantCount": 2,
      "appliedAt": "2026-01-03T10:00:00Z",
      "guest": {
        "id": "uuid",
        "name": "山田太郎"
      }
    }
  ],
  "total": 3,
  "capacity": 10
}
```

---

#### GET /api/participations/:guestId/:scheduleId/exists

参加関係の検証

**レスポンス:**

```json
{
  "exists": true
}
```

---

### 4.7 メッセージ API

#### POST /api/messages

メッセージ送信（認証必須）

**リクエスト:**

```json
{
  "receiverId": "uuid",
  "subject": "体験について質問です",
  "body": "持ち物について詳しく教えてください",
  "parentMessageId": "uuid"
}
```

**レスポンス:**

```json
{
  "message": {
    "id": "uuid",
    "senderId": "uuid",
    "receiverId": "uuid",
    "subject": "体験について質問です",
    "body": "持ち物について詳しく教えてください",
    "isRead": false,
    "parentMessageId": "uuid",
    "createdAt": "2026-01-03T10:00:00Z"
  }
}
```

---

#### GET /api/messages/inbox

受信メッセージ一覧取得（認証必須）

**クエリパラメータ:**

- `unreadOnly`: true（未読のみ）

**レスポンス:**

```json
{
  "messages": [
    {
      "id": "uuid",
      "senderId": "uuid",
      "subject": "体験について質問です",
      "isRead": false,
      "createdAt": "2026-01-03T10:00:00Z",
      "sender": {
        "id": "uuid",
        "name": "山田太郎"
      }
    }
  ],
  "unreadCount": 3
}
```

---

#### GET /api/messages/sent

送信メッセージ一覧取得（認証必須）

**レスポンス:**

```json
{
  "messages": [
    {
      "id": "uuid",
      "receiverId": "uuid",
      "subject": "Re: 体験について質問です",
      "createdAt": "2026-01-03T11:00:00Z",
      "receiver": {
        "id": "uuid",
        "name": "佐藤花子"
      }
    }
  ]
}
```

---

#### GET /api/messages/:id

メッセージ詳細取得（認証必須）

**レスポンス:**

```json
{
  "message": {
    "id": "uuid",
    "senderId": "uuid",
    "receiverId": "uuid",
    "subject": "体験について質問です",
    "body": "持ち物について詳しく教えてください",
    "isRead": true,
    "parentMessageId": null,
    "createdAt": "2026-01-03T10:00:00Z",
    "readAt": "2026-01-03T10:30:00Z",
    "sender": {
      "id": "uuid",
      "name": "山田太郎"
    }
  },
  "thread": [
    {
      "id": "uuid",
      "subject": "Re: 体験について質問です",
      "body": "ご質問ありがとうございます...",
      "createdAt": "2026-01-03T11:00:00Z"
    }
  ]
}
```

---

#### PATCH /api/messages/:id/read

メッセージを既読にする（認証必須）

**レスポンス:**

```json
{
  "success": true
}
```

---

#### GET /api/messages/unread-count

未読メッセージ数取得（認証必須）

**レスポンス:**

```json
{
  "count": 5
}
```

---

### 4.8 ホームページ API

#### GET /api/home/featured

ホームページ用データ取得

**レスポンス:**

```json
{
  "featured": [
    {
      /* ピックアッププロジェクト */
    }
  ],
  "popular": [
    {
      /* 人気プロジェクト */
    }
  ],
  "categories": ["古民家再生", "米作り", "DIY"],
  "locations": ["長野県", "北海道", "沖縄県"]
}
```

---

#### GET /api/home/recommended

おすすめプロジェクト取得（認証必須）

**レスポンス:**

```json
{
  "recommended": [
    {
      /* おすすめプロジェクト */
    }
  ]
}
```

---

## 5. セキュリティ設計

### 5.1 認証・認可

#### 認証方式

- **NextAuth.js**: Next.js 公式の認証ライブラリを使用
- **JWT (JSON Web Token)**: セッション管理に JWT を使用
- **httpOnly Cookie**: トークンを httpOnly cookie に保存し、XSS 攻撃から保護

#### 認可方式

- **ロールベースアクセス制御 (RBAC)**:
  - リーダー: プロジェクト・スケジュール・リターンの作成・編集・削除
  - サポーター: 参加申し込み、メッセージ送信（参加済みプロジェクトのみ）
  - 両方: リーダーとサポーターの両方の機能を使用可能

#### セッション管理

- **トークン有効期限**: 24 時間
- **リフレッシュトークン**: 30 日間（将来実装）
- **セッション無効化**: ログアウト時にサーバーサイドでセッション無効化

### 5.2 データ保護

#### パスワード保護

- **bcrypt**: ソルト付きハッシュ化（ラウンド数: 10）
- **最小文字数**: 8 文字以上
- **パスワードポリシー**: 英数字を推奨（将来実装で強制）

#### 個人情報保護

- **メールアドレス**: 暗号化せず DB に保存（unique インデックス）
- **プロフィール画像**: 外部ストレージ（Supabase Storage or AWS S3）にアップロード
- **センシティブデータ**: パスワードハッシュ以外のセンシティブデータは MVP では扱わない

### 5.3 入力バリデーション

#### クライアントサイド

- **React Hook Form**: フォーム管理
- **Zod**: スキーマバリデーション

#### サーバーサイド

- **Zod**: API Routes でのリクエストバリデーション
- **Prisma**: データベースレベルでの型チェック

#### バリデーションルール

- **メールアドレス**: RFC 5322 準拠の形式チェック
- **パスワード**: 最小 8 文字
- **プロジェクトタイトル**: 最大 100 文字
- **プロジェクト概要**: 最大 500 文字
- **プロジェクト詳細**: 最大 10,000 文字

### 5.4 脆弱性対策

#### XSS (Cross-Site Scripting)

- **React 自動エスケープ**: React のデフォルトエスケープ処理を使用
- **dangerouslySetInnerHTML 禁止**: 使用しない（リッチテキストは将来実装時に対策）
- **外部 URL スキーム制限**: SNS リンク等の外部 URL は `https://` スキームのみ許可する（ドメイン層 `SnsLinks`・応募フォーム `ApplyForm`・編集フォーム `projectFormSchema` の全レイヤーで統一）。`javascript:` / `data:` / `vbscript:` など XSS 誘発スキームを拒否し、`http://` は Mixed Content 回避のため許可しない。
- **既存 DB データのマイグレーション方針**: 既存 DB に `http://` の SNS URL が残っている場合、編集フォームで開いた際にバリデーションエラーとなる。ユーザーには `https://` への書き換えを促し、読み取り専用の公開表示用途では `isSafeHttpsUrl` により該当リンクが非表示になるため既存値を保持したままで実害はない。必要に応じて将来的に一括書き換えのデータパッチを実施する。

#### CSRF (Cross-Site Request Forgery)

- **Next.js 標準対策**: Next.js App Router のデフォルト CSRF 対策を使用
- **SameSite Cookie**: SameSite=Lax 属性を設定

#### SQL Injection

- **Prisma ORM**: パラメータ化クエリによる自動防御

#### ファイルアップロード攻撃

- **ファイル形式チェック**: 画像ファイルのみ許可（JPEG, PNG, WebP）
- **ファイルサイズ制限**: 最大 5MB
- **外部ストレージ**: Supabase Storage or AWS S3 にアップロード

---

## 6. インフラ設計

### 6.1 開発環境

#### ローカル開発

- **Node.js**: 20.x 以上
- **Bun**: 1.x 以上（パッケージマネージャー・ランタイム）
- **PostgreSQL**: 14.x 以上（Docker またはローカルインストール）

#### Docker Compose 構成（推奨）

```yaml
version: '3.8'
services:
  db:
    image: postgres:14
    environment:
      POSTGRES_USER: campfire
      POSTGRES_PASSWORD: campfire
      POSTGRES_DB: campfire_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 6.2 本番環境

#### ホスティング

- **Vercel**: Next.js 公式推奨のホスティングプラットフォーム
  - 自動スケーリング
  - エッジネットワーク
  - ISR 対応
  - Bun 公式サポート

#### データベース

- **Supabase**: PostgreSQL マネージドサービス（推奨）
  - 無料枠: 500MB ストレージ
  - 自動バックアップ
  - レプリケーション
- **Neon**: サーバーレス PostgreSQL（代替案）
- **Vercel Postgres**: Vercel 公式の PostgreSQL（代替案）

#### ストレージ

- **Supabase Storage**: 画像・ファイルストレージ（推奨）
  - 無料枠: 1GB
  - CDN 対応
- **AWS S3**: 大規模化時の代替案

### 6.3 環境変数

#### 必須環境変数

```env
# データベース
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# 認証
NEXTAUTH_SECRET="ランダムな秘密鍵"
NEXTAUTH_URL="http://localhost:3000"

# ストレージ（Supabase使用時）
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="public-anon-key"
SUPABASE_SERVICE_ROLE_KEY="service-role-key"
```

### 6.4 CI/CD

#### GitHub Actions（推奨構成）

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - run: bun run lint

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

### 6.5 モニタリング・ログ

#### アプリケーション監視

- **Vercel Analytics**: ページビュー、パフォーマンス測定
- **Sentry**: エラートラッキング（将来実装）

#### ログ管理

- **Vercel Logs**: サーバーサイドログ
- **Console.log**: 開発環境でのデバッグ

---

**バージョン:** 1.0
**作成日:** 2026-01-03
**最終更新:** 2026-01-03
