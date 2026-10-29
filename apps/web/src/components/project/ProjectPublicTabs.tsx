"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/common";

const TABS = [
  { key: "home", label: "ホーム" },
  { key: "support", label: "サポート募集" },
  { key: "report", label: "活動報告" },
  { key: "supporters", label: "サポーター" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * タブの中身からタブを切り替えるための Context。
 * 親の Server Component から関数は渡せないので、パネルの中に置く Client 部品（SelectTabButton）が
 * ここから `selectTab` を受け取る。ProjectPublicTabs の外では null（ボタンは何もしない）。
 */
const ProjectTabsContext = createContext<{ selectTab: (tab: TabKey) => void } | null>(null);

/**
 * 押すと指定したタブに切り替えるボタン（例: 「ホーム」タブの「サポート募集を見る」）。
 * ProjectPublicTabs のパネルの中で使う。切り替えたあとは、そのタブのボタンにフォーカスを移す
 * （ページの下の方で押しても、切り替わったタブが見える位置に戻るように）。
 */
export function SelectTabButton({ tab, children }: { tab: TabKey; children: ReactNode }) {
  const tabs = useContext(ProjectTabsContext);
  return (
    <Button
      type="button"
      variant="primary"
      size="lg"
      fullWidth
      onClick={() => tabs?.selectTab(tab)}
    >
      {children}
    </Button>
  );
}

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
 * プロジェクトページのタブ切り替え UI を担う Client Component。
 * 公開ページ（ProjectPublicView: Server Component）とマイページ（ProjectDetail: Client Component）で共有する。
 * 親が完成済みの各タブコンテンツ ReactNode を props で渡す。
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

  const selectTab = (tab: TabKey) => {
    shouldFocusRef.current = true;
    setActiveTab(tab);
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
    <ProjectTabsContext.Provider value={{ selectTab }}>
      {/* タブ */}
      <div className="border-b border-gray-200">
        {/* スマホ幅（375px）で 4 つのタブが折り返さないよう、余白を詰めて 1 行に収める。収まらない幅ではタブの中だけ横に流す */}
        <nav
          className="flex gap-0 -mb-px overflow-x-auto"
          role="tablist"
          aria-label="プロジェクト情報"
        >
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
              className={`whitespace-nowrap px-2.5 py-2 text-sm font-medium border-b-2 transition-colors sm:px-4 ${
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
          hidden={activeTab !== tab.key}
        >
          {panels[tab.key]}
        </div>
      ))}
    </ProjectTabsContext.Provider>
  );
}
