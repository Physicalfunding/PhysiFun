"use client";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

/**
 * Container
 * レスポンシブ対応のコンテナコンポーネント
 */
export function Container({
  children,
  className = "",
  size = "lg",
}: ContainerProps) {
  const sizeStyles = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    full: "max-w-full",
  };

  return (
    <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${sizeStyles[size]} ${className}`}>
      {children}
    </div>
  );
}

/**
 * PageContainer
 * ページ用コンテナ（デフォルトパディング付き）
 */
export function PageContainer({
  children,
  className = "",
  size = "lg",
}: ContainerProps) {
  return (
    <Container size={size} className={`py-6 sm:py-8 lg:py-12 ${className}`}>
      {children}
    </Container>
  );
}

/**
 * SectionContainer
 * セクション用コンテナ
 */
interface SectionContainerProps extends ContainerProps {
  title?: string;
  description?: string;
}

export function SectionContainer({
  children,
  className = "",
  size = "lg",
  title,
  description,
}: SectionContainerProps) {
  return (
    <section className={`py-8 sm:py-12 lg:py-16 ${className}`}>
      <Container size={size}>
        {(title || description) && (
          <div className="mb-6 sm:mb-8 lg:mb-10 text-center">
            {title && (
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}
