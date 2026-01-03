# Requirements Document

## Introduction

**Campfire Experience（キャンプファイア・エクスペリエンス）** は、体験を提供したい人（ホスト）と体験を求める人（ゲスト）を繋ぐプラットフォームである。焚き火を囲むように、みんなで温かく応援し合える場所を目指す。

本MVPでは、ホストがプロジェクトを立ち上げ、ゲストが体験に参加申し込みするまでの基本フローを実現する。

**主要な目標:**
- ホストがプロジェクト（古民家再生、米作り、DIYなど）を立ち上げ、手伝いを募集できる
- ゲストが体験参加を通じてプロジェクトを支援し、日常では経験できない体験を得られる
- 双方にメリットがある仕組みを提供する

---

## Requirements

### Requirement 1: ユーザー登録

**Objective:** As a 新規ユーザー, I want アカウントを作成したい, so that プラットフォームの機能（プロジェクト作成や体験参加）を利用できる

#### Acceptance Criteria
1. When ユーザーがメールアドレスとパスワードを入力して登録ボタンをクリックした時, the System shall 新規アカウントを作成してログイン状態にする
2. When ユーザーが登録フォームを送信した時, the System shall ユーザー名（表示名）とユーザータイプ（ホスト/ゲスト/両方）を保存する
3. If 無効なメールアドレス形式が入力された場合, then the System shall バリデーションエラーを表示する
4. If パスワードが8文字未満の場合, then the System shall パスワード要件エラーを表示する
5. If 既存のメールアドレスで登録しようとした場合, then the System shall 重複登録エラーを表示する

---

### Requirement 2: ログイン・ログアウト

**Objective:** As a 登録済みユーザー, I want ログインしたい, so that 自分のアカウントにアクセスして機能を利用できる

#### Acceptance Criteria
1. When ユーザーが正しいメールアドレスとパスワードを入力した時, the System shall 認証してセッションを開始する
2. If 認証情報が無効な場合, then the System shall 適切なエラーメッセージを表示する
3. While ユーザーがログイン中, the System shall セッションを一定期間保持する
4. When ユーザーがログアウトボタンをクリックした時, the System shall セッションを終了してログイン画面にリダイレクトする

---

### Requirement 3: プロフィール管理

**Objective:** As a ログインユーザー, I want プロフィールを閲覧・編集したい, so that 最新の情報を反映させられる

#### Acceptance Criteria
1. When ユーザーがプロフィールページにアクセスした時, the System shall ユーザー名、メールアドレス、自己紹介文、プロフィール画像、ユーザータイプを表示する
2. When ユーザーがプロフィールを編集して保存した時, the System shall 変更内容を保存して更新されたプロフィールを表示する
3. When ユーザーがプロフィール画像をアップロードした時, the System shall 画像を保存してプロフィールに反映する

---

### Requirement 4: プロジェクト作成

**Objective:** As a ホスト, I want 新しいプロジェクトを作成したい, so that 自分のプロジェクトを他のユーザーに知ってもらい、手伝ってもらえる

#### Acceptance Criteria
1. When ホストがプロジェクト作成ページにアクセスした時, the System shall プロジェクト作成フォームを表示する
2. When ホストがプロジェクト情報（タイトル、概要、詳細説明、カテゴリ、画像、開催場所）を入力して保存した時, the System shall プロジェクトを下書き状態で保存する
3. If 必須項目（タイトル、概要、詳細説明）が未入力の場合, then the System shall バリデーションエラーを表示する
4. The System shall ホスト1アカウントにつき同時に立ち上げられるプロジェクトを1つのみに制限する

---

### Requirement 5: プロジェクト編集・公開

**Objective:** As a ホスト, I want 作成したプロジェクトを編集・公開したい, so that 情報を更新しゲストに閲覧してもらえる

#### Acceptance Criteria
1. When ホストが自分のプロジェクト一覧から編集対象を選択した時, the System shall プロジェクト編集フォームを表示する
2. When ホストがプロジェクトを公開した時, the System shall プロジェクトを公開状態に変更してプロジェクト一覧に表示する
3. When ホストが公開前にプレビューボタンをクリックした時, the System shall プロジェクトのプレビューを表示する
4. When ホストがプロジェクトを非公開にした時, the System shall プロジェクトを下書き状態に戻す
5. When プロジェクトが公開された時, the System shall プロジェクト詳細ページにアクセスできるURLを発行する

---

### Requirement 6: 体験スケジュール管理

**Objective:** As a ホスト, I want プロジェクトに紐づく体験スケジュールを作成・管理したい, so that ゲストが参加できる具体的な日程と内容を提示できる

#### Acceptance Criteria
1. When ホストが体験スケジュールを作成した時, the System shall 体験タイトル、開催日時、所要時間、体験内容、募集人数、持ち物・注意事項を保存する
2. The System shall プロジェクトに対して複数の体験スケジュールを作成できるようにする
3. When ホストが体験スケジュールを編集した時, the System shall 変更内容を保存する
4. When 参加申し込みがある体験スケジュールを削除しようとした時, the System shall 警告を表示する
5. If 開催日時が過去の日時で設定された場合, then the System shall バリデーションエラーを表示する

---

### Requirement 7: リターン設定

**Objective:** As a ホスト, I want プロジェクトに対するリターン（特典）を設定したい, so that ゲストに提供できる価値を明確にできる

#### Acceptance Criteria
1. When ホストがリターンを設定した時, the System shall リターン名、説明、提供予定時期、数量制限を保存する
2. The System shall プロジェクトに対して複数のリターンを設定できるようにする
3. When リターンが設定された時, the System shall プロジェクトページにリターン情報を表示する
4. When ホストがリターンを編集・削除した時, the System shall 変更を保存してプロジェクトページに反映する

---

### Requirement 8: 参加者管理

**Objective:** As a ホスト, I want 体験スケジュールへの参加申し込み者を確認したい, so that 参加者の人数や情報を把握し準備を行える

#### Acceptance Criteria
1. When ホストが参加者管理ページにアクセスした時, the System shall 各体験スケジュールの参加申し込み者一覧を表示する
2. The System shall 参加者のユーザー名、申し込み日時、参加人数を表示する
3. The System shall 現在の申し込み人数と募集人数を表示する
4. When ホストが参加者へのメッセージ送信をリクエストした時, the System shall メッセージ作成画面を表示する

---

### Requirement 9: マイプロジェクト一覧

**Objective:** As a ホスト, I want 自分が作成したプロジェクト一覧を確認したい, so that 管理しているプロジェクトに素早くアクセスできる

#### Acceptance Criteria
1. When ホストがマイプロジェクトページにアクセスした時, the System shall 自分が作成した全てのプロジェクトを一覧表示する
2. The System shall 各プロジェクトの公開中/下書きのステータスを表示する
3. The System shall 各プロジェクトの参加申し込み数を表示する
4. When ホストがプロジェクトを選択した時, the System shall 編集ページにナビゲートする

---

### Requirement 10: ホームページ表示

**Objective:** As a 訪問者, I want ホームページでプラットフォームの魅力的なプロジェクトを発見したい, so that 自分に合ったプロジェクトを効率的に見つけられる

#### Acceptance Criteria
1. The System shall 未ログインユーザーでもホームページにアクセスできるようにする
2. The System shall ピックアッププロジェクト（運営が選定したプロジェクト）を表示する
3. The System shall 人気ランキング（参加者数などに基づく）を表示する
4. While ゲストがログイン中, the System shall ユーザーの関心に基づくおすすめプロジェクトを表示する
5. When ユーザーがカテゴリをクリックした時, the System shall 該当カテゴリのプロジェクトに絞り込む
6. When ユーザーが地域をクリックした時, the System shall 該当地域のプロジェクトに絞り込む

---

### Requirement 11: プロジェクト一覧・検索

**Objective:** As a ゲスト, I want 公開されているプロジェクトを閲覧・検索したい, so that 興味のあるプロジェクトを探せる

#### Acceptance Criteria
1. When ユーザーがプロジェクト一覧ページにアクセスした時, the System shall 公開中の全てのプロジェクトを一覧表示する
2. The System shall 各プロジェクトのタイトル、画像、概要、カテゴリ、開催場所を表示する
3. When ユーザーがキーワードで検索した時, the System shall 検索結果を一覧表示する
4. When ユーザーがカテゴリや地域で絞り込んだ時, the System shall フィルタリングされた結果を表示する
5. When ユーザーが検索条件をクリアした時, the System shall 全てのプロジェクトを再表示する

---

### Requirement 12: プロジェクト詳細表示

**Objective:** As a ゲスト, I want プロジェクトの詳細情報を閲覧したい, so that 参加を検討するために必要な情報を確認できる

#### Acceptance Criteria
1. When ユーザーがプロジェクトを選択した時, the System shall プロジェクトの全情報（タイトル、画像、概要、詳細説明、カテゴリ、開催場所、ホスト情報）を表示する
2. The System shall 設定されているリターン一覧を表示する
3. The System shall 体験スケジュール一覧を表示する
4. The System shall ホストへのメッセージ送信リンクを表示する

---

### Requirement 13: 体験参加申し込み

**Objective:** As a ゲスト, I want 興味のある体験スケジュールに参加申し込みをしたい, so that 実際にプロジェクトの体験に参加できる

#### Acceptance Criteria
1. When ゲストが体験スケジュールを選択して参加人数を指定した時, the System shall 申し込み確認画面を表示する
2. When ゲストが申し込みを確定した時, the System shall 申し込みを保存して確認メッセージを表示する
3. If 募集人数に達している場合, then the System shall 申し込みを受け付けずにメッセージを表示する
4. If 同一ゲストが同じスケジュールに既に申し込んでいる場合, then the System shall 重複申し込みエラーを表示する
5. When 申し込みが完了した時, the System shall マイページの参加予定一覧に反映する

---

### Requirement 14: マイページ - 参加予定一覧

**Objective:** As a ゲスト, I want 自分が参加申し込みした体験の一覧を確認したい, so that 今後の予定を把握できる

#### Acceptance Criteria
1. When ゲストがマイページにアクセスした時, the System shall 参加申し込みした体験スケジュール一覧を表示する
2. The System shall 各体験のプロジェクトタイトル、体験タイトル、開催日時、開催場所、申し込み日時を表示する
3. The System shall 開催日が近い順に並び替えて表示する
4. The System shall 過去の体験と今後の体験を区別して表示する

---

### Requirement 15: メッセージ機能

**Objective:** As a ユーザー, I want ホストとゲスト間でメッセージを送受信したい, so that 体験の詳細や当日の準備について質問や相談ができる

#### Acceptance Criteria
1. When ゲストが参加申し込みをしたプロジェクトのホストにメッセージを送信した時, the System shall メッセージを保存して送信確認を表示する
2. If ゲストが参加申し込みをしていないプロジェクトのホストにメッセージを送信しようとした場合, then the System shall 送信を拒否してエラーメッセージを表示する
3. When ホストが自分のプロジェクトに参加申し込みしたゲストにメッセージを送信した時, the System shall メッセージを保存して送信確認を表示する
4. When ユーザーが受信メッセージ一覧を表示した時, the System shall 送信者、件名、受信日時、未読/既読状態を表示する
5. When ユーザーがメッセージに返信した時, the System shall 返信を保存してメッセージスレッドに表示する
6. The System shall 未読メッセージ数を表示する

---

## Non-Functional Requirements

### パフォーマンス
- The System shall 初回ページ読み込みを3秒以内、遷移時を1秒以内に完了する
- The System shall 100ユーザーの同時アクセスに対応する
- The System shall Next.js Imageコンポーネントによる画像最適化を行う
- The System shall 公開プロジェクト一覧・詳細ページでISRを活用する

### セキュリティ
- The System shall NextAuth.jsによるセッション管理・JWT認証を実装する
- The System shall bcryptによるパスワードハッシュ化を行う
- The System shall Zodによるサーバーサイド・クライアントサイド両方でのバリデーションを行う
- The System shall httpOnly cookieによるトークン保存を行う

### ユーザビリティ
- The System shall モバイル・タブレット・デスクトップに対応したレスポンシブデザインを提供する
- The System shall WCAG 2.1 AAレベルのアクセシビリティを目標とする
- The System shall 操作後の成功・エラーフィードバックを明確に提示する
- The System shall 非同期処理中のローディング表示を行う

### 保守性
- The System shall TypeScriptによる型安全性を確保する
- The System shall クリーンアーキテクチャ + DDDによる関心の分離を実現する
- The System shall ユニットテスト、統合テスト、E2Eテストを実装する

---

## Constraints

### 技術的制約
- ホスト1アカウントにつき同時に立ち上げられるプロジェクトは1つのみ
- MVP段階では体験参加は無料申し込みのみ（決済機能なし）
- リアルタイムチャットではなく非同期メッセージ機能のみ

### ビジネスルール
- 同一ゲストが同じスケジュールに複数回申し込み不可
- 募集人数を超える申し込みは不可
- ゲストは参加申し込みをしたプロジェクトのホストにのみメッセージ送信可能
- ホストは自分のプロジェクトに参加申し込みしたゲストにのみメッセージ送信可能
- 開催日時は未来の日時のみ設定可能

---

## Glossary

| 用語 | 定義 |
|------|------|
| ホスト (Host) | プロジェクトを立ち上げ、体験を提供する側のユーザー |
| ゲスト (Guest) | 体験に参加し、プロジェクトを支援する側のユーザー |
| プロジェクト (Project) | ホストが立ち上げる、体験を提供するための企画 |
| 体験スケジュール (Experience Schedule) | プロジェクトに紐づく具体的な体験の日程・内容 |
| リターン (Return) | ゲストが体験参加の対価として受け取る特典 |
| 参加申し込み (Participation) | ゲストが体験スケジュールに参加を申し込むこと |
| 下書き (Draft) | プロジェクトが公開前の状態 |
| 公開 (Published) | プロジェクトがゲストに閲覧可能な状態 |
| 募集人数 (Capacity) | 体験スケジュールに参加できる最大人数 |
