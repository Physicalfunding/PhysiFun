"use client";

interface GridProps {
  children: React.ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4;
  gap?: "sm" | "md" | "lg";
}

/**
 * Grid
 * レスポンシブ対応のグリッドコンポーネント
 */
export function Grid({ children, className = "", cols = 3, gap = "md" }: GridProps) {
  const colsStyles = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  const gapStyles = {
    sm: "gap-3 sm:gap-4",
    md: "gap-4 sm:gap-6",
    lg: "gap-6 sm:gap-8",
  };

  return (
    <div className={`grid ${colsStyles[cols]} ${gapStyles[gap]} ${className}`}>{children}</div>
  );
}

/**
 * TwoColumnLayout
 * 2カラムレイアウト（サイドバー + メインコンテンツ）
 */
interface TwoColumnLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  sidebarPosition?: "left" | "right";
  sidebarWidth?: "sm" | "md" | "lg";
  className?: string;
}

export function TwoColumnLayout({
  children,
  sidebar,
  sidebarPosition = "left",
  sidebarWidth = "md",
  className = "",
}: TwoColumnLayoutProps) {
  const sidebarWidthStyles = {
    sm: "lg:w-64",
    md: "lg:w-80",
    lg: "lg:w-96",
  };

  return (
    <div className={`lg:flex lg:gap-8 ${className}`}>
      {/* サイドバー（モバイルでは上部に表示） */}
      <aside
        className={`mb-6 lg:mb-0 ${sidebarWidthStyles[sidebarWidth]} lg:flex-shrink-0 ${
          sidebarPosition === "right" ? "lg:order-2" : "lg:order-1"
        }`}
      >
        {sidebar}
      </aside>

      {/* メインコンテンツ */}
      <main
        className={`flex-1 min-w-0 ${sidebarPosition === "right" ? "lg:order-1" : "lg:order-2"}`}
      >
        {children}
      </main>
    </div>
  );
}

/**
 * Stack
 * 垂直方向のスタックレイアウト
 */
interface StackProps {
  children: React.ReactNode;
  className?: string;
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
}

export function Stack({ children, className = "", gap = "md" }: StackProps) {
  const gapStyles = {
    xs: "space-y-1",
    sm: "space-y-2",
    md: "space-y-4",
    lg: "space-y-6",
    xl: "space-y-8",
  };

  return <div className={`${gapStyles[gap]} ${className}`}>{children}</div>;
}

/**
 * Flex
 * フレックスボックスラッパー
 */
interface FlexProps {
  children: React.ReactNode;
  className?: string;
  direction?: "row" | "col";
  justify?: "start" | "center" | "end" | "between" | "around";
  align?: "start" | "center" | "end" | "stretch";
  wrap?: boolean;
  gap?: "xs" | "sm" | "md" | "lg";
}

export function Flex({
  children,
  className = "",
  direction = "row",
  justify = "start",
  align = "center",
  wrap = false,
  gap = "md",
}: FlexProps) {
  const directionStyles = {
    row: "flex-row",
    col: "flex-col",
  };

  const justifyStyles = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
    around: "justify-around",
  };

  const alignStyles = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
  };

  const gapStyles = {
    xs: "gap-1",
    sm: "gap-2",
    md: "gap-4",
    lg: "gap-6",
  };

  return (
    <div
      className={`flex ${directionStyles[direction]} ${justifyStyles[justify]} ${alignStyles[align]} ${
        wrap ? "flex-wrap" : ""
      } ${gapStyles[gap]} ${className}`}
    >
      {children}
    </div>
  );
}
