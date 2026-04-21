/**
 * マジックリンク送信完了ページ (#145)
 *
 * NextAuth `pages.verifyRequest` で指定。ユーザーがログインリクエストを
 * 送信した直後のフィードバック画面。
 */
export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-bold">メールを送信しました</h1>
        <p className="text-sm text-gray-700">
          入力されたメールアドレス宛にログインリンクを送信しました。
          10 分以内にリンクをクリックしてください。
        </p>
        <p className="text-xs text-gray-500">
          メールが届かない場合、AdminAccount が未登録または無効化されている可能性があります。
        </p>
      </div>
    </div>
  );
}
