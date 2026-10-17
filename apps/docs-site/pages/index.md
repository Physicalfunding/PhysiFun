---
layout: home

hero:
  name: PhysiFun
  text: DB ドキュメント
  tagline: テーブル定義書・ER 図・設計の意図を 1 か所に。atlas/schema.sql から自動生成しています。
  actions:
    - theme: brand
      text: テーブル定義書
      link: /db/README
    - theme: alt
      text: 動く ER 図
      link: https://physicalfunding.github.io/PhysiFun/er/
      target: _self
    - theme: alt
      text: 設計の意図（データモデル）
      link: /specs/03_data-model

features:
  - title: テーブル定義書
    details: 全テーブル・全列の型・制約・インデックスと、日本語の説明。列の説明は schema.sql の COMMENT ON から作っています。
    link: /db/README
  - title: 領域別の ER 図
    details: アカウントと応募、プロジェクトと公開審査など、領域ごとに分けた ER 図。主キー・外部キーとその説明だけを載せています。
    link: /db/viewpoint-project
  - title: 動く ER 図
    details: DB 全体をズーム・検索できる ER 図（Liam ERD）。テーブルを選ぶと、関係するテーブルと列の説明が出ます。
    link: https://physicalfunding.github.io/PhysiFun/er/
  - title: 設計の意図
    details: 領域の分け方・削除時の挙動・インデックスの狙い（03）と、集約の境界・状態遷移・ルールの置き場所（02）。
    link: /specs/03_data-model
---
