import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mb-8 text-2xl font-bold text-gray-900">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-10 mb-3 text-lg font-semibold text-gray-900">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-6 mb-2 font-semibold text-gray-800">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="mt-4 mb-1 font-medium text-gray-800">{children}</h4>
    ),
    p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="my-2 list-disc pl-5 space-y-1">{children}</ul>,
    ol: ({ children }) => (
      <ol className="my-2 list-decimal pl-5 space-y-1">{children}</ol>
    ),
    li: ({ children }) => <li>{children}</li>,
    table: ({ children }) => (
      <table className="my-3 w-full border-collapse text-sm">{children}</table>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    tbody: ({ children }) => (
      <tbody className="divide-y divide-gray-200">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="border-b border-gray-200">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="py-2 pr-4 text-left font-medium">{children}</th>
    ),
    td: ({ children }) => <td className="py-2 pr-4">{children}</td>,
    hr: () => <hr className="my-8 border-gray-200" />,
    a: ({ href, children }) => (
      <a href={href} className="text-orange-600 hover:underline">
        {children}
      </a>
    ),
    ...components,
  };
}
