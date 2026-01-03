# Technical Design Document

## Overview

**Purpose**: Campfire Experience は、体験を提供したいホストと体験を求めるゲストを繋ぐプラットフォームである。本 MVP では、プロジェクト作成から体験参加申し込みまでの基本フローを実現する。

**Users**:
- ホスト: プロジェクトを立ち上げ、体験を提供するユーザー
- ゲスト: プロジェクトを閲覧し、体験に参加するユーザー

**Impact**: 新規プラットフォームとしてゼロからの構築を行う。

### Goals

- ホストがプロジェクトを作成・公開し、体験スケジュールを設定できる
- ゲストがプロジェクトを検索・閲覧し、体験に参加申し込みできる
- ホストとゲスト間で非同期メッセージによるコミュニケーションができる
- 安全なユーザー認証とプロフィール管理を提供する

### Non-Goals

- 決済機能（MVP 範囲外）
- リアルタイムチャット（非同期メッセージのみ）
- 管理者機能
- レビュー・評価機能
- 通知機能（メール・プッシュ）
- 参加申し込みキャンセル機能

---

## Architecture

### Architecture Pattern & Boundary Map

**クリーンアーキテクチャ + ドメイン駆動設計 (DDD)** を採用する。

**採用理由**:
- **将来的なバックエンド分離**: ドメイン層をフレームワークから完全に分離することで、将来的に Python や Go などの別言語でバックエンドを置き換える際に、ビジネスロジックの移植が容易になる
- **マイクロサービス移行**: 各ドメイン（User、Project、Schedule、Participation、Message）が明確な境界を持つため、将来的にマイクロサービスとして切り出しやすい
- **テスト容易性**: 依存性の逆転により、各レイヤーを独立してテストできる（TDD に適している）
- **関心の分離**: UI、ビジネスロジック、データアクセスが明確に分離され、変更の影響範囲を限定できる

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

```mermaid
graph TB
    subgraph Presentation Layer
        Pages[App Router Pages]
        Components[React Components]
        APIRoutes[API Routes]
    end

    subgraph Application Layer
        UseCases[Use Cases]
        DTOs[DTOs]
    end

    subgraph Domain Layer
        Entities[Entities]
        ValueObjects[Value Objects]
        DomainServices[Domain Services]
        Repositories[Repository Interfaces]
    end

    subgraph Infrastructure Layer
        PrismaRepo[Prisma Repositories]
        AuthAdapter[NextAuth.js Adapter]
        StorageAdapter[Storage Adapter]
        Database[(PostgreSQL)]
        StorageService[Supabase Storage]
    end

    Pages --> APIRoutes
    Components --> APIRoutes
    APIRoutes --> UseCases
    UseCases --> Entities
    UseCases --> Repositories
    PrismaRepo --> Repositories
    PrismaRepo --> Database
    AuthAdapter --> Repositories
    StorageAdapter --> StorageService
```

**Architecture Integration**:
- **Selected pattern**: Clean Architecture + DDD
- **Domain boundaries**: User、Project、Schedule、Participation、Message の 5 ドメイン
- **New components rationale**: 各ドメインに対応するエンティティ・リポジトリ・ユースケースを定義
- **Future extensibility**: ドメイン層は純粋な TypeScript で実装し、フレームワーク依存を排除。将来的にバックエンドを別言語で再実装する際の移植性を確保

### Technology Stack

| Layer | Choice / Version | Role in Feature | Notes |
|-------|------------------|-----------------|-------|
| Framework | **Next.js 16** (App Router) | フルスタック React フレームワーク | SSR/ISR 対応 |
| Language | **TypeScript** | 型安全な開発 | 全レイヤーで使用 |
| UI Library | **React 19** | UI ライブラリ | Server Components 対応 |
| CSS | **Tailwind CSS** | ユーティリティファースト CSS | レスポンシブ対応 |
| Database | **PostgreSQL** | リレーショナルデータベース | Supabase でホスティング |
| ORM | **Prisma** | 型安全な ORM | マイグレーション管理含む |
| Auth | **NextAuth.js** | Next.js 公式認証ライブラリ | Credentials Provider |
| Password | **bcrypt** | パスワードハッシュ化 | ラウンド数: 10 |
| JWT | **jose** | JWT 処理 | セッション管理 |
| Forms | **React Hook Form** | フォーム管理 | バリデーション連携 |
| Validation | **Zod** | スキーマバリデーション | クライアント/サーバー両対応 |
| Unit Test | **Jest** | ユニットテストフレームワーク | TDD で使用 |
| Component Test | **React Testing Library** | コンポーネントテスト | DOM テスト |
| E2E Test | **Playwright** | E2E テスト | 将来実装 |
| Package Manager | **Bun** | 高速パッケージマネージャー | ランタイムとしても使用 |
| Storage | **Supabase Storage** | 画像ファイルストレージ | CDN 対応 |
| Hosting | **Vercel** | デプロイ、Edge Functions | GitHub 連携 |

---

## Development Methodology

### TDD (テスト駆動開発)

本プロジェクトでは **TDD (Test-Driven Development)** を採用する。

#### TDD サイクル

```
┌─────────────────────────────────────────┐
│  1. Red: 失敗するテストを書く            │
│     - 要件に基づいてテストケースを作成    │
│     - テストが失敗することを確認          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  2. Green: テストを通す最小限のコードを書く │
│     - 最もシンプルな実装                  │
│     - テストが成功することを確認          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  3. Refactor: コードを改善する           │
│     - 重複の除去                         │
│     - 命名の改善                         │
│     - テストが通り続けることを確認        │
└─────────────────────────────────────────┘
              ↓ 繰り返し
```

#### TDD 適用範囲

| レイヤー | テスト種別 | ツール | 適用 |
|---------|----------|--------|------|
| Domain Layer | Unit Test | Jest | 必須 |
| Application Layer (Use Cases) | Unit Test | Jest | 必須 |
| Infrastructure Layer | Integration Test | Jest + Prisma | 必須 |
| Presentation Layer | Component Test | React Testing Library | 推奨 |
| 全体 | E2E Test | Playwright | 将来実装 |

#### テストファイル配置

```
src/
├── domain/
│   └── user/
│       ├── entities/
│       │   ├── User.ts
│       │   └── User.test.ts          # ユニットテスト
│       └── value-objects/
│           ├── Email.ts
│           └── Email.test.ts         # ユニットテスト
├── application/
│   └── use-cases/
│       ├── auth/
│       │   ├── RegisterUserUseCase.ts
│       │   └── RegisterUserUseCase.test.ts
└── infrastructure/
    └── database/
        └── repositories/
            ├── PrismaUserRepository.ts
            └── PrismaUserRepository.test.ts  # 統合テスト
```

#### テスト命名規則

```typescript
// ユニットテストの例
describe('Email', () => {
  describe('create', () => {
    it('should create a valid email', () => {
      // ...
    });

    it('should throw an error for invalid email format', () => {
      // ...
    });
  });
});

// ユースケーステストの例
describe('RegisterUserUseCase', () => {
  describe('execute', () => {
    it('should register a new user successfully', () => {
      // ...
    });

    it('should return error when email already exists', () => {
      // ...
    });
  });
});
```

---

## Directory Structure

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
            ├── PrismaUserRepository.ts
            ├── PrismaProjectRepository.ts
            ├── PrismaScheduleRepository.ts
            ├── PrismaParticipationRepository.ts
            └── PrismaMessageRepository.ts
```

---

## System Flows

### 認証フロー

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextAuth
    participant Database

    User->>Browser: メールアドレス・パスワード入力
    Browser->>NextAuth: signIn credentials
    NextAuth->>Database: ユーザー検索
    Database-->>NextAuth: ユーザー情報
    NextAuth->>NextAuth: パスワード検証 bcrypt
    alt 認証成功
        NextAuth-->>Browser: JWT セッション設定
        Browser-->>User: ダッシュボードへリダイレクト
    else 認証失敗
        NextAuth-->>Browser: エラーレスポンス
        Browser-->>User: エラーメッセージ表示
    end
```

### プロジェクト公開フロー

```mermaid
sequenceDiagram
    participant Host
    participant Browser
    participant APIRoute
    participant UseCase
    participant Repository
    participant Database

    Host->>Browser: プロジェクト情報入力
    Browser->>APIRoute: POST /api/projects
    APIRoute->>UseCase: execute(input)
    UseCase->>UseCase: バリデーション
    UseCase->>Repository: save(project)
    Repository->>Database: INSERT
    Database-->>Repository: Project
    Repository-->>UseCase: Project
    UseCase-->>APIRoute: ProjectDTO
    APIRoute-->>Browser: JSON Response
    Browser-->>Host: 成功メッセージ表示
```

### 参加申し込みフロー

```mermaid
sequenceDiagram
    participant Guest
    participant Browser
    participant APIRoute
    participant UseCase
    participant Repository
    participant Database

    Guest->>Browser: 参加人数選択・申し込み
    Browser->>APIRoute: POST /api/participations
    APIRoute->>UseCase: execute(input)
    UseCase->>Repository: findScheduleById(id)
    Repository->>Database: SELECT
    Database-->>Repository: Schedule
    UseCase->>UseCase: 定員チェック
    UseCase->>UseCase: 重複申し込みチェック
    alt 申し込み可能
        UseCase->>Repository: save(participation)
        Repository->>Database: INSERT
        Database-->>Repository: Participation
        UseCase-->>APIRoute: ParticipationDTO
        APIRoute-->>Browser: 成功レスポンス
        Browser-->>Guest: 申し込み完了画面
    else 定員オーバー or 重複
        UseCase-->>APIRoute: エラー
        APIRoute-->>Browser: エラーレスポンス
        Browser-->>Guest: エラーメッセージ表示
    end
```

---

## Requirements Traceability

| Requirement | Summary | Components | Interfaces | Flows |
|-------------|---------|------------|------------|-------|
| 1.1-1.5 | ユーザー登録 | AuthService, UserRepository | RegisterUserUseCase | 認証フロー |
| 2.1-2.4 | ログイン・ログアウト | AuthService, SessionManager | LoginUseCase, LogoutUseCase | 認証フロー |
| 3.1-3.3 | プロフィール管理 | UserRepository, ProfileService | UpdateProfileUseCase | - |
| 4.1-4.4 | プロジェクト作成 | ProjectRepository, ProjectService | CreateProjectUseCase | プロジェクト公開フロー |
| 5.1-5.5 | プロジェクト編集・公開 | ProjectRepository, ProjectService | UpdateProjectUseCase, PublishProjectUseCase | プロジェクト公開フロー |
| 6.1-6.5 | 体験スケジュール管理 | ScheduleRepository, ScheduleService | CreateScheduleUseCase | - |
| 7.1-7.4 | リターン設定 | ReturnRepository | CreateReturnUseCase | - |
| 8.1-8.4 | 参加者管理 | ParticipationRepository | GetParticipantsUseCase | - |
| 9.1-9.4 | マイプロジェクト一覧 | ProjectRepository | GetMyProjectsUseCase | - |
| 10.1-10.6 | ホームページ表示 | ProjectRepository | GetFeaturedProjectsUseCase | - |
| 11.1-11.5 | プロジェクト一覧・検索 | ProjectRepository | SearchProjectsUseCase | - |
| 12.1-12.4 | プロジェクト詳細表示 | ProjectRepository | GetProjectDetailUseCase | - |
| 13.1-13.5 | 体験参加申し込み | ParticipationRepository | ApplyParticipationUseCase | 参加申し込みフロー |
| 14.1-14.4 | 参加予定一覧 | ParticipationRepository | GetMyParticipationsUseCase | - |
| 15.1-15.6 | メッセージ機能 | MessageRepository | SendMessageUseCase, GetMessagesUseCase | - |

---

## Components and Interfaces

### Component Summary

| Component | Domain/Layer | Intent | Req Coverage | Key Dependencies (P0/P1) | Contracts |
|-----------|--------------|--------|--------------|--------------------------|-----------|
| AuthService | Infrastructure | 認証・セッション管理 | 1, 2 | NextAuth.js (P0), UserRepository (P0) | Service |
| UserRepository | Domain | ユーザー永続化 | 1, 2, 3 | Prisma (P0) | Service |
| ProjectRepository | Domain | プロジェクト永続化 | 4, 5, 9, 10, 11, 12 | Prisma (P0) | Service |
| ScheduleRepository | Domain | スケジュール永続化 | 6 | Prisma (P0) | Service |
| ReturnRepository | Domain | リターン永続化 | 7 | Prisma (P0) | Service |
| ParticipationRepository | Domain | 参加申し込み永続化 | 8, 13, 14 | Prisma (P0) | Service |
| MessageRepository | Domain | メッセージ永続化 | 15 | Prisma (P0) | Service |
| ImageUploadService | Infrastructure | 画像アップロード | 3, 4 | Supabase Storage (P0) | Service, API |

---

### Domain Layer

#### User Entity

| Field | Detail |
|-------|--------|
| Intent | ユーザー情報を表現するドメインエンティティ |
| Requirements | 1.1-1.5, 2.1-2.4, 3.1-3.3 |

**Responsibilities & Constraints**
- ユーザーの識別と属性管理
- パスワードはハッシュ化して保存
- ユーザータイプ（HOST/GUEST/BOTH）による権限分離

**Contracts**: Service [x]

##### Service Interface
```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: CreateUserInput): Promise<User>;
  update(id: string, data: UpdateUserInput): Promise<User>;
}

type UserType = 'HOST' | 'GUEST' | 'BOTH';

interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  userType: UserType;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
  userType: UserType;
}

interface UpdateUserInput {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  userType?: UserType;
}
```

---

#### Project Entity

| Field | Detail |
|-------|--------|
| Intent | プロジェクト情報を表現するドメインエンティティ |
| Requirements | 4.1-4.4, 5.1-5.5, 9.1-9.4, 10.1-10.6, 11.1-11.5, 12.1-12.4 |

**Responsibilities & Constraints**
- プロジェクトのライフサイクル管理（DRAFT/PUBLISHED）
- ホスト 1 人につき同時に 1 プロジェクトのみ
- 公開時に URL スラッグ生成

**Contracts**: Service [x]

##### Service Interface
```typescript
interface ProjectRepository {
  findById(id: string): Promise<Project | null>;
  findBySlug(slug: string): Promise<Project | null>;
  findByHostId(hostId: string): Promise<Project[]>;
  findPublished(filter: ProjectFilter): Promise<PaginatedResult<Project>>;
  findFeatured(): Promise<Project[]>;
  create(project: CreateProjectInput): Promise<Project>;
  update(id: string, data: UpdateProjectInput): Promise<Project>;
  delete(id: string): Promise<void>;
  countByHostId(hostId: string, status?: ProjectStatus): Promise<number>;
}

type ProjectStatus = 'DRAFT' | 'PUBLISHED';
type Category = 'KOMINKA' | 'RICE_FARMING' | 'DIY' | 'CRAFT' | 'OTHER';

interface Project {
  id: string;
  hostId: string;
  title: string;
  summary: string;
  description: string;
  category: Category;
  location: string;
  imageUrls: string[];
  status: ProjectStatus;
  slug: string | null;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

interface ProjectFilter {
  keyword?: string;
  category?: Category;
  location?: string;
  page: number;
  limit: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}
```

---

#### Schedule Entity

| Field | Detail |
|-------|--------|
| Intent | 体験スケジュールを表現するドメインエンティティ |
| Requirements | 6.1-6.5, 13.1-13.5 |

**Responsibilities & Constraints**
- プロジェクトに紐づく複数スケジュール管理
- 開催日時は未来のみ設定可能
- 募集人数と現在申し込み数の管理

**Contracts**: Service [x]

##### Service Interface
```typescript
interface ScheduleRepository {
  findById(id: string): Promise<Schedule | null>;
  findByProjectId(projectId: string): Promise<Schedule[]>;
  findUpcoming(projectId: string): Promise<Schedule[]>;
  create(schedule: CreateScheduleInput): Promise<Schedule>;
  update(id: string, data: UpdateScheduleInput): Promise<Schedule>;
  delete(id: string): Promise<void>;
  countParticipants(scheduleId: string): Promise<number>;
  hasParticipants(scheduleId: string): Promise<boolean>;
}

interface Schedule {
  id: string;
  projectId: string;
  title: string;
  description: string;
  startDateTime: Date;
  duration: number | null; // 分単位
  capacity: number;
  requirements: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateScheduleInput {
  projectId: string;
  title: string;
  description: string;
  startDateTime: Date;
  duration?: number;
  capacity: number;
  requirements?: string;
}
```

---

#### Return Entity

| Field | Detail |
|-------|--------|
| Intent | リターン（特典）を表現するドメインエンティティ |
| Requirements | 7.1-7.4 |

**Responsibilities & Constraints**
- プロジェクトに紐づく複数リターン管理
- 数量制限のオプション管理

**Contracts**: Service [x]

##### Service Interface
```typescript
interface ReturnRepository {
  findById(id: string): Promise<Return | null>;
  findByProjectId(projectId: string): Promise<Return[]>;
  create(returnItem: CreateReturnInput): Promise<Return>;
  update(id: string, data: UpdateReturnInput): Promise<Return>;
  delete(id: string): Promise<void>;
}

interface Return {
  id: string;
  projectId: string;
  name: string;
  description: string;
  estimatedDeliveryDate: Date | null;
  quantityLimit: number | null;
  order: number;
  createdAt: Date;
}

interface CreateReturnInput {
  projectId: string;
  name: string;
  description: string;
  estimatedDeliveryDate?: Date;
  quantityLimit?: number;
}
```

---

#### Participation Entity

| Field | Detail |
|-------|--------|
| Intent | 参加申し込みを表現するドメインエンティティ |
| Requirements | 8.1-8.4, 13.1-13.5, 14.1-14.4 |

**Responsibilities & Constraints**
- ゲストとスケジュールの紐付け
- 重複申し込み防止（同一ゲスト・同一スケジュール）
- 募集人数超過防止

**Contracts**: Service [x]

##### Service Interface
```typescript
interface ParticipationRepository {
  findById(id: string): Promise<Participation | null>;
  findByGuestId(guestId: string): Promise<ParticipationWithDetails[]>;
  findByScheduleId(scheduleId: string): Promise<ParticipationWithGuest[]>;
  findByGuestAndSchedule(guestId: string, scheduleId: string): Promise<Participation | null>;
  create(participation: CreateParticipationInput): Promise<Participation>;
  sumParticipantsByScheduleId(scheduleId: string): Promise<number>;
}

type ParticipationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

interface Participation {
  id: string;
  guestId: string;
  scheduleId: string;
  participantCount: number;
  status: ParticipationStatus;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ParticipationWithDetails extends Participation {
  schedule: Schedule & { project: Project };
}

interface ParticipationWithGuest extends Participation {
  guest: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

interface CreateParticipationInput {
  guestId: string;
  scheduleId: string;
  participantCount: number;
}
```

---

#### Message Entity

| Field | Detail |
|-------|--------|
| Intent | メッセージを表現するドメインエンティティ |
| Requirements | 15.1-15.6 |

**Responsibilities & Constraints**
- ホスト⇔ゲスト間の非同期メッセージ
- スレッド形式での返信管理
- 既読/未読状態管理
- 参加申し込み済みの関係のみ送信可能

**Contracts**: Service [x]

##### Service Interface
```typescript
interface MessageRepository {
  findById(id: string): Promise<Message | null>;
  findByUserId(userId: string): Promise<MessageWithSender[]>;
  findThread(messageId: string): Promise<Message[]>;
  create(message: CreateMessageInput): Promise<Message>;
  markAsRead(id: string): Promise<void>;
  countUnread(userId: string): Promise<number>;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  subject: string;
  body: string;
  isRead: boolean;
  parentMessageId: string | null;
  createdAt: Date;
  readAt: Date | null;
}

interface MessageWithSender extends Message {
  sender: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

interface CreateMessageInput {
  senderId: string;
  receiverId: string;
  parentMessageId?: string;
  subject: string;
  body: string;
}
```

---

### Application Layer

#### Use Cases Summary

| UseCase | Domain | Intent | Requirements |
|---------|--------|--------|--------------|
| RegisterUserUseCase | User | 新規ユーザー登録 | 1.1-1.5 |
| LoginUseCase | User | ログイン認証 | 2.1-2.2 |
| LogoutUseCase | User | ログアウト | 2.4 |
| UpdateProfileUseCase | User | プロフィール更新 | 3.1-3.3 |
| CreateProjectUseCase | Project | プロジェクト作成 | 4.1-4.4 |
| UpdateProjectUseCase | Project | プロジェクト更新 | 5.1 |
| PublishProjectUseCase | Project | プロジェクト公開 | 5.2-5.5 |
| CreateScheduleUseCase | Schedule | スケジュール作成 | 6.1-6.2 |
| UpdateScheduleUseCase | Schedule | スケジュール更新 | 6.3 |
| DeleteScheduleUseCase | Schedule | スケジュール削除 | 6.4 |
| CreateReturnUseCase | Return | リターン作成 | 7.1-7.3 |
| UpdateReturnUseCase | Return | リターン更新 | 7.4 |
| ApplyParticipationUseCase | Participation | 参加申し込み | 13.1-13.5 |
| GetMyParticipationsUseCase | Participation | 参加予定一覧取得 | 14.1-14.4 |
| SendMessageUseCase | Message | メッセージ送信 | 15.1-15.3 |
| GetMessagesUseCase | Message | メッセージ一覧取得 | 15.4-15.6 |
| ReplyMessageUseCase | Message | メッセージ返信 | 15.5 |
| SearchProjectsUseCase | Project | プロジェクト検索 | 11.1-11.5 |
| GetProjectDetailUseCase | Project | プロジェクト詳細取得 | 12.1-12.4 |
| GetFeaturedProjectsUseCase | Project | ホーム画面プロジェクト取得 | 10.1-10.6 |

---

### Infrastructure Layer

#### ImageUploadService

| Field | Detail |
|-------|--------|
| Intent | 画像アップロード・URL 取得 |
| Requirements | 3.3, 4.2 |

**Dependencies**
- External: Supabase Storage — 画像ホスティング (P0)

**Contracts**: Service [x] / API [x]

##### Service Interface
```typescript
interface ImageUploadService {
  uploadImage(file: File, folder: string): Promise<UploadResult>;
  deleteImage(path: string): Promise<void>;
  getPublicUrl(path: string): string;
}

interface UploadResult {
  path: string;
  publicUrl: string;
}
```

##### API Contract
| Method | Endpoint | Request | Response | Errors |
|--------|----------|---------|----------|--------|
| POST | /api/users/me/avatar | FormData { file } | { avatarUrl: string } | 401, 413, 415, 500 |
| POST | /api/projects/:id/images | FormData { files } | { imageUrls: string[] } | 401, 403, 413, 415, 500 |

---

## Data Models

### Domain Model (ER Diagram)

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

### Physical Data Model (Prisma Schema)

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
  HOST
  GUEST
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

### Index Design

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

## Error Handling

### Error Strategy

Result 型パターンを採用し、例外ではなく明示的なエラー値を返す。

```typescript
type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

type AppError =
  | { code: 'VALIDATION_ERROR'; message: string; fields?: Record<string, string[]> }
  | { code: 'NOT_FOUND'; resource: string }
  | { code: 'UNAUTHORIZED'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'CONFLICT'; message: string }
  | { code: 'INTERNAL_ERROR'; message: string };
```

### Error Categories and Responses

**User Errors (4xx)**:
- 400: バリデーションエラー → Zod スキーマによるフィールドレベルエラー
- 401: 未認証 → ログインページへリダイレクト
- 403: 権限不足 → 操作不可の説明表示
- 404: リソース不存在 → 404 ページ表示
- 409: 競合（重複登録等） → 具体的なエラーメッセージ

**System Errors (5xx)**:
- 500: サーバーエラー → 一般エラーメッセージ、ログ記録

**Business Logic Errors (422)**:
- 定員オーバー → 残席数表示
- 重複申し込み → 既存申し込みへのリンク
- 過去日時設定 → 正しい日時選択の案内
- プロジェクト作成制限 → 既存プロジェクトへのリンク

---

## Testing Strategy

### TDD によるテスト戦略

#### Unit Tests (Jest)

**対象**: ドメイン層、アプリケーション層

- ドメインエンティティのビジネスルール検証
- 値オブジェクトの不変条件テスト
- Zod バリデーションスキーマのテスト
- ユースケースのロジックテスト（リポジトリモック）
- Result 型のエラーハンドリングテスト

```typescript
// TDD 例: Email 値オブジェクト
describe('Email', () => {
  // Red: 失敗するテストを書く
  it('should reject invalid email format', () => {
    expect(() => Email.create('invalid')).toThrow();
  });

  // Green: テストを通す最小限のコードを実装
  // Refactor: 必要に応じてリファクタリング
});
```

#### Integration Tests (Jest + Prisma)

**対象**: インフラストラクチャ層

- リポジトリとデータベースの結合テスト
- NextAuth.js 認証フローのテスト
- API Routes のエンドツーエンドテスト
- Prisma トランザクションのテスト

```typescript
// 統合テスト例
describe('PrismaUserRepository', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it('should create and find user by email', async () => {
    const repository = new PrismaUserRepository(prisma);
    await repository.create({ /* ... */ });
    const found = await repository.findByEmail('test@example.com');
    expect(found).toBeDefined();
  });
});
```

#### Component Tests (React Testing Library)

**対象**: プレゼンテーション層

- フォームコンポーネントの入力・送信テスト
- 条件付きレンダリングのテスト
- エラー表示のテスト

#### E2E Tests (Playwright) - 将来実装

- ユーザー登録・ログインフロー
- プロジェクト作成・公開フロー
- 参加申し込みフロー
- メッセージ送受信フロー

---

## Security Considerations

### Authentication & Authorization

- **NextAuth.js** による JWT セッション管理
- **bcrypt** (ラウンド数: 10) によるパスワードハッシュ
- **httpOnly cookie** によるトークン保存
- **CSRF 対策**: Next.js App Router の標準対策を使用

### Input Validation

- **Zod** によるサーバーサイド・クライアントサイドバリデーション
- **Prisma** によるパラメータ化クエリ（SQL インジェクション対策）
- **React** による自動エスケープ（XSS 対策）

### Data Protection

- メールアドレスの非公開（ユーザー名のみ表示）
- パスワードのハッシュ化保存
- ファイルアップロード: 画像ファイルのみ許可（JPEG, PNG, WebP）、最大 5MB

---

## Performance & Scalability

### Target Metrics

- 初回ページ読み込み: 3 秒以内
- ページ遷移: 1 秒以内
- 同時接続: 100 ユーザー

### Optimization Strategies

- ISR によるプロジェクト一覧・詳細ページの静的生成
- Next.js Image による画像最適化
- Supabase Storage CDN による画像配信
- PostgreSQL インデックス最適化
- Prisma 接続プール管理（Singleton パターン）
- React 19 Server Components による JavaScript バンドルサイズ削減

---

## Infrastructure

### Development Environment

- **Node.js**: 20.x 以上
- **Bun**: 1.x 以上（パッケージマネージャー・ランタイム）
- **PostgreSQL**: 14.x 以上（Docker またはローカルインストール）

### Production Environment

- **Hosting**: Vercel（Next.js 公式推奨）
- **Database**: Supabase PostgreSQL（マネージドサービス）
- **Storage**: Supabase Storage（画像・ファイル）

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Authentication
NEXTAUTH_SECRET="ランダムな秘密鍵"
NEXTAUTH_URL="http://localhost:3000"

# Storage (Supabase)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="public-anon-key"
SUPABASE_SERVICE_ROLE_KEY="service-role-key"
```
