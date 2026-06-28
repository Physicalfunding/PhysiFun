import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー | フィジファン",
  description: "フィジファンのプライバシーポリシー。個人情報の取扱いについてご確認ください。",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">プライバシーポリシー</h1>

      <div className="space-y-10 text-sm leading-relaxed text-gray-700">
        <p>
          〇〇株式会社（以下「当社」といいます）は、スキル・時間でプロジェクトを支援する
          マッチングプラットフォーム「フィジファン」（以下「本サービス」といいます）の運営
          において、ユーザーの個人情報の保護を重要な責務と認識し、個人情報の保護に関する
          法律（以下「個人情報保護法」といいます）その他の関連法令を遵守します。
        </p>
        <p>
          本プライバシーポリシー（以下「本ポリシー」といいます）は、本サービスにおける
          個人情報の取扱いについて定めるものです。
        </p>

        {/* ── 第1条 定義 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">第1条（定義）</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left">
                <th className="py-2 pr-4 font-medium">用語</th>
                <th className="py-2 font-medium">意味</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="py-2 pr-4 align-top whitespace-nowrap">個人情報</td>
                <td className="py-2">
                  生存する個人に関する情報であって、氏名・メールアドレス等により特定の個人を識別できるもの、または個人識別符号が含まれるもの
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 align-top whitespace-nowrap">個人データ</td>
                <td className="py-2">
                  個人情報データベース等を構成する個人情報
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 align-top whitespace-nowrap">保有個人データ</td>
                <td className="py-2">
                  当社が開示・訂正・利用停止等の権限を有する個人データ
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 align-top whitespace-nowrap">ユーザー</td>
                <td className="py-2">
                  本サービスを利用するすべての個人（応募者・リーダー・サポーターを含む）
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ── 第2条 取得する個人情報 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第2条（取得する個人情報の項目）
          </h2>
          <p className="mb-3">
            当社は、本サービスの提供にあたり、以下の個人情報を取得します。
          </p>

          <h3 className="mt-4 mb-2 font-semibold text-gray-800">
            1. ユーザーが直接提供する情報
          </h3>

          <h4 className="mt-3 mb-1 text-gray-800 font-medium">（1）アカウント情報</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>表示名（ニックネーム）</li>
            <li>メールアドレス</li>
            <li>パスワード</li>
            <li>電話番号（任意）</li>
            <li>プロフィール画像（任意）</li>
            <li>自己紹介文（任意）</li>
            <li>SNS リンク — X・Instagram・Facebook・ウェブサイト（任意）</li>
          </ul>

          <h4 className="mt-3 mb-1 text-gray-800 font-medium">（2）リーダー応募情報</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>表示名・メールアドレス・電話番号</li>
            <li>プロジェクトタイトル・概要・ストーリー・カテゴリー</li>
            <li>プロジェクトの進行フェーズ・募集種別</li>
            <li>参加者が得られる体験・活動内容</li>
            <li>活動場所・実施時期・募集人数（条件による）</li>
            <li>必要なスキル/モノ・提供期限・リターン内容（条件による）</li>
            <li>活動地域（都道府県・市区町村）</li>
            <li>SNS リンク（任意）</li>
          </ul>

          <h4 className="mt-3 mb-1 text-gray-800 font-medium">
            （3）お問い合わせ情報
          </h4>
          <p>
            お問い合わせフォーム等を通じて送信された氏名・メールアドレス・お問い合わせ内容。
          </p>

          <h3 className="mt-4 mb-2 font-semibold text-gray-800">
            2. 自動的に取得する情報
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>IP アドレス（セキュリティ・不正利用防止）</li>
            <li>ブラウザの種類・バージョン（サービスの互換性確保）</li>
            <li>アクセス日時・ページ閲覧履歴（サービス改善）</li>
            <li>Cookie — セッション管理用・CSRF 対策用（認証・セキュリティ）</li>
            <li>Cloudflare Turnstile のトークン情報（ボット対策）</li>
          </ul>
        </section>

        {/* ── 第3条 取得方法 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">第3条（取得方法）</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              ユーザーが本サービス上のフォーム（リーダー応募フォーム、プロフィール編集画面、
              お問い合わせフォーム等）に入力した情報を、ユーザー本人から直接取得します。
            </li>
            <li>
              ユーザーが本サービスにアクセスした際に、Cookie
              およびサーバーログを通じて自動的に取得します。
            </li>
            <li>
              当社は、要配慮個人情報（人種・信条・病歴等）を取得しません。ただし、法令に
              基づく場合はこの限りではありません。
            </li>
          </ol>
        </section>

        {/* ── 第4条 利用目的 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">第4条（利用目的）</h2>
          <p className="mb-2">
            当社は、取得した個人情報を以下の目的のために利用します。
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>アカウントの作成・認証・管理</li>
            <li>リーダー応募の受付・審査・結果の通知</li>
            <li>プロジェクトの作成・編集・公開審査</li>
            <li>本サービスの提供・運営・維持</li>
            <li>ユーザーからのお問い合わせへの対応</li>
            <li>利用規約違反行為の調査・対応</li>
            <li>不正アクセス・不正利用の検知・防止</li>
            <li>
              サービスの改善・新機能の検討のための統計分析（個人を特定しない形で）
            </li>
            <li>本サービスに関する重要な通知・お知らせの送信</li>
            <li>法令に基づく対応</li>
          </ol>
        </section>

        {/* ── 第5条 利用目的の変更 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第5条（利用目的の変更）
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              当社は、利用目的を変更する場合、変更前の利用目的と関連性を有すると合理的に
              認められる範囲で行います。
            </li>
            <li>
              利用目的を変更した場合、変更後の利用目的を本サービス上での掲示またはメール
              にて通知します。
            </li>
          </ol>
        </section>

        {/* ── 第6条 第三者提供 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第6条（第三者提供の制限）
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              当社は、以下のいずれかに該当する場合を除き、あらかじめユーザー本人の同意を
              得ることなく、個人データを第三者に提供しません。
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>法令に基づく場合</li>
                <li>
                  人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を
                  得ることが困難であるとき
                </li>
                <li>
                  公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、
                  本人の同意を得ることが困難であるとき
                </li>
                <li>
                  国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を
                  遂行することに対して協力する必要がある場合であって、本人の同意を得ることに
                  より当該事務の遂行に支障を及ぼすおそれがあるとき
                </li>
              </ul>
            </li>
            <li>
              初回リリース時点では、リーダーとサポーター間でのユーザー情報の共有は発生
              しません。一般公開時にマッチング機能を実装する際、共有範囲を本ポリシーに
              追記します。
            </li>
          </ol>
        </section>

        {/* ── 第7条 委託 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">第7条（委託）</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              当社は、利用目的の達成に必要な範囲内で、個人情報の取扱いの全部または一部を
              外部の事業者に委託する場合があります。
            </li>
            <li>
              委託先に対しては、契約等により個人情報の安全管理について適切な監督を行います。
            </li>
            <li>
              初回リリース時点における主な委託先の業務内容は以下のとおりです。
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-left">
                    <th className="py-2 pr-4 font-medium">業務内容</th>
                    <th className="py-2 font-medium">委託先サービス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-2 pr-4">データベース・認証基盤の運用</td>
                    <td className="py-2">Supabase</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">トランザクションメールの配信</td>
                    <td className="py-2">Resend</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">ボット対策（CAPTCHA）</td>
                    <td className="py-2">Cloudflare Turnstile</td>
                  </tr>
                </tbody>
              </table>
            </li>
          </ol>
        </section>

        {/* ── 第8条 越境移転 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第8条（外国にある第三者への提供）
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              当社が利用する一部の外部サービスは、日本国外にサーバーを設置している場合が
              あります。この場合、ユーザーの個人データが当該外国に所在するサーバーに保存
              されることがあります。
            </li>
            <li>
              当社は、外国にある第三者に個人データを提供する場合、個人情報保護法第28条に
              基づき、当該第三者が適切な体制を整備していることの確認、またはユーザー本人の
              同意の取得を行います。
            </li>
            <li>
              提供先の外国における個人情報保護制度については、ユーザーからの求めに応じて
              情報提供します。
            </li>
          </ol>
        </section>

        {/* ── 第9条 安全管理 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第9条（安全管理措置）
          </h2>
          <p className="mb-3">
            当社は、個人データの漏えい・滅失・毀損の防止その他の安全管理のために、以下の
            措置を講じます。
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <span className="font-medium">組織的安全管理措置</span>
              — 個人データの取扱いに関する責任者の設置、取扱状況の定期的な把握、
              漏えい等の事案に対応する体制の整備
            </li>
            <li>
              <span className="font-medium">人的安全管理措置</span>
              — 個人データを取り扱う従業者に対する教育の実施、秘密保持に関する事項の
              就業規則等への明記
            </li>
            <li>
              <span className="font-medium">物理的安全管理措置</span>
              — 個人データを取り扱う区域の管理、機器および電子媒体等の盗難防止
            </li>
            <li>
              <span className="font-medium">技術的安全管理措置</span>
              — アクセス制御による権限管理、パスワードのハッシュ化による保存、
              通信の暗号化（TLS）、不正アクセスの検知
            </li>
          </ol>
        </section>

        {/* ── 第10条 Cookie ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第10条（Cookie およびアクセスログ）
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              本サービスでは、以下の目的で Cookie を使用します。
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-left">
                    <th className="py-2 pr-4 font-medium">Cookie の種類</th>
                    <th className="py-2 pr-4 font-medium">目的</th>
                    <th className="py-2 font-medium">有効期間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-2 pr-4">セッション Cookie</td>
                    <td className="py-2 pr-4">ログイン状態の維持</td>
                    <td className="py-2">最大30日間</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">CSRF 対策 Cookie</td>
                    <td className="py-2 pr-4">セキュリティ</td>
                    <td className="py-2">セッション中</td>
                  </tr>
                </tbody>
              </table>
            </li>
            <li>
              初回リリース時点では、広告配信目的の Cookie やサードパーティ Cookie は
              使用しません。
            </li>
            <li>
              ユーザーは、ブラウザの設定により Cookie
              を拒否することができます。ただし、Cookie
              を拒否した場合、本サービスの一部機能が利用できなくなる場合があります。
            </li>
          </ol>
        </section>

        {/* ── 第11条 保存期間 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第11条（個人データの保存期間）
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              当社は、利用目的の達成に必要な期間に限り、個人データを保存します。
            </li>
            <li>
              保存期間を経過した個人データは、速やかに削除または匿名化します。
            </li>
            <li>
              法令に基づき保存が義務付けられている場合は、当該法令に定める期間、保存します。
            </li>
          </ol>
        </section>

        {/* ── 第12条 ユーザーの権利 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第12条（開示等の請求）
          </h2>
          <p className="mb-2">
            ユーザーは、当社に対し、当社が保有する自己の保有個人データについて、以下の
            請求を行うことができます。
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              <span className="font-medium">利用目的の通知の請求</span>
            </li>
            <li>
              <span className="font-medium">開示の請求</span>
              — 電磁的記録による提供を含め、ユーザーが開示方法を指定できます。
            </li>
            <li>
              <span className="font-medium">訂正・追加・削除の請求</span>
              — 内容が事実でない場合に請求できます。
            </li>
            <li>
              <span className="font-medium">利用停止・消去の請求</span>
              — 利用目的の範囲を超えて取り扱われているとき、不正の手段により取得された
              ものであるとき、利用する必要がなくなったとき、漏えい等が生じたとき、
              ユーザーの権利または正当な利益が害されるおそれがあるときに請求できます。
            </li>
            <li>
              <span className="font-medium">第三者提供の停止の請求</span>
            </li>
          </ol>
        </section>

        {/* ── 第13条 請求手続 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第13条（請求手続）
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              前条の請求は、第18条に定めるお問い合わせ窓口に、本人確認書類を添えて
              申し出てください。
            </li>
            <li>
              当社は、請求者が本人であることを確認のうえ、合理的な期間内に対応します。
            </li>
          </ol>
        </section>

        {/* ── 第14条 漏えい対応 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第14条（漏えい等発生時の対応）
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              当社は、個人データの漏えい・滅失・毀損等（以下「漏えい等」といいます）が
              発生した場合、速やかに事実関係の調査および原因の究明、被害の拡大防止措置、
              個人情報保護委員会への報告、ならびに影響を受けるユーザー本人への通知を行います。
            </li>
            <li>
              前項の報告・通知は、要配慮個人情報が含まれる漏えい等、財産的被害のおそれが
              ある漏えい等、不正の目的をもって行われたおそれがある漏えい等、または
              1,000人を超えるユーザーに影響が及ぶ漏えい等が発生した場合に行います。
            </li>
          </ol>
        </section>

        {/* ── 第15条 未成年者 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第15条（未成年者の個人情報）
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>本サービスの利用資格は満18歳以上です。</li>
            <li>
              当社は、18歳未満の方から意図的に個人情報を取得することはありません。
            </li>
            <li>
              18歳未満の方が個人情報を提供したことが判明した場合、当社は速やかに当該情報を
              削除します。
            </li>
          </ol>
        </section>

        {/* ── 第16条 変更 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第16条（本ポリシーの変更）
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              当社は、法令の改正・サービス内容の変更その他必要に応じて、本ポリシーを変更
              することがあります。
            </li>
            <li>
              重要な変更を行う場合は、本サービス上での掲示またはメールにて、変更内容と
              効力発生日を事前に通知します。
            </li>
            <li>
              変更後の本ポリシーは、本サービス上に掲示した時点から効力を生じます。
            </li>
          </ol>
        </section>

        {/* ── 第17条 準拠法 ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第17条（準拠法）
          </h2>
          <p>本ポリシーの準拠法は日本法とします。</p>
        </section>

        {/* ── 第18条 お問い合わせ ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            第18条（お問い合わせ窓口）
          </h2>
          <p>
            個人情報の取扱いに関するお問い合わせ・苦情・開示等の請求は、以下の窓口まで
            ご連絡ください。
          </p>
          <div className="mt-3 rounded-md bg-gray-50 p-4 text-sm text-gray-600">
            <p>事業者名: 〇〇株式会社</p>
            <p>メールアドレス: privacy@example.com</p>
          </div>
        </section>

        {/* ── 施行日 ── */}
        <section className="border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-500">施行日: 未定（初回リリース日）</p>
        </section>
      </div>
    </div>
  );
}
