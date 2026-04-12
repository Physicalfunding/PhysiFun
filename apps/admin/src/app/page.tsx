/**
 * 運営管理トップページ
 */
export default function AdminTopPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">運営管理</h1>
      <p className="mt-4 text-gray-600">フィジファン運営管理画面です。</p>

      <nav className="mt-8">
        <ul className="space-y-2">
          {/* TODO: Phase 2 以降で各管理画面へのリンクを追加 */}
          <li className="text-gray-400">（管理メニューは今後追加予定）</li>
        </ul>
      </nav>
    </div>
  );
}
