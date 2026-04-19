"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { key: "home", label: "ホーム" },
  { key: "support", label: "サポート募集" },
  { key: "report", label: "活動報告" },
  { key: "supporters", label: "サポーター" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface Props {
  home: ReactNode;
  support: ReactNode;
  report: ReactNode;
  supporters: ReactNode;
}

/**
 * ProjectPublicView のタブ切り替え UI を担う Client Component。
 * 親 (Server Component) が完成済みの各タブコンテンツ ReactNode を props で渡す。
 */
export function ProjectPublicTabs({ home, support, report, supporters }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("home");

  const panels: Record<TabKey, ReactNode> = {
    home,
    support,
    report,
    supporters,
  };

  return (
    <>
      {/* タブ */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px" role="tablist" aria-label="プロジェクト情報">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`tabpanel-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
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
