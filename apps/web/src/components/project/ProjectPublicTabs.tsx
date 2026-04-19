"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

const TABS = [
  { key: "home", label: "ホーム" },
  { key: "support", label: "サポート募集" },
  { key: "report", label: "活動報告" },
  { key: "supporters", label: "サポーター" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * ProjectPublicTabs の Props.
 *
 * 各 ReactNode フィールドは親 Server Component で構築された JSX ツリー。
 * タブキーごとのパネル内容を分けることで、将来のタブ追加時に props と TABS 定数の
 * 対応が静的型でチェックされるようにしている。
 *
 * 将来この子コンポーネント自体が Server Component のデータを直接参照したくなった
 * 場合は、各パネルを更に細かい Server/Client 分離するのが望ましい (この層は
 * あくまでタブ切替 UI 専用)。
 */
interface Props {
  home: ReactNode;
  support: ReactNode;
  report: ReactNode;
  supporters: ReactNode;
}

/**
 * ProjectPublicView のタブ切り替え UI を担う Client Component。
 * 親 (Server Component) が完成済みの各タブコンテンツ ReactNode を props で渡す。
 *
 * WAI-ARIA Tab Panel パターンに準拠:
 * - 左右矢印キーでタブ移動 (循環)
 * - Home/End キーで最初/最後のタブへジャンプ
 * - 非アクティブタブは tabIndex={-1}、アクティブタブは tabIndex={0}
 * - アクティブタブ変更時は対応する tab ボタンにフォーカスを当てる
 */
export function ProjectPublicTabs({ home, support, report, supporters }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // ユーザーのキーボード操作起因のタブ変更のみフォーカス移動したいので、操作種別を追跡
  const shouldFocusRef = useRef(false);

  useEffect(() => {
    if (!shouldFocusRef.current) return;
    const index = TABS.findIndex((t) => t.key === activeTab);
    tabRefs.current[index]?.focus();
    shouldFocusRef.current = false;
  }, [activeTab]);

  const panels: Record<TabKey, ReactNode> = {
    home,
    support,
    report,
    supporters,
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      shouldFocusRef.current = true;
      setActiveTab(TABS[nextIndex].key);
    }
  };

  return (
    <>
      {/* タブ */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px" role="tablist" aria-label="プロジェクト情報">
          {/*
            TODO: 現状は全タブパネルを `hidden` 属性でトグルしているため、初期レンダリング時に
            全タブの DOM が生成される。将来パネル内容が重くなった場合は、条件レンダリング
            (アクティブタブのみマウント) や Intersection Observer によるレイジーマウントなど
            遅延描画戦略を検討する。
          */}
          {TABS.map((tab, index) => (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`tabpanel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* タブコンテンツ */}
      {TABS.map((tab) => (
        <div
          key={tab.key}
          id={`tabpanel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.key}`}
          className={tab.key === "home" ? "space-y-6" : undefined}
          hidden={activeTab !== tab.key}
        >
          {panels[tab.key]}
        </div>
      ))}
    </>
  );
}
