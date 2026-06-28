import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <article
      className={[
        "mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-gray-700",
        "[&_h1]:mb-8 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-gray-900",
        "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900",
        "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-gray-800",
        "[&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:font-medium [&_h4]:text-gray-800",
        "[&_p]:my-2",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
        "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
        "[&_tbody]:divide-y [&_tbody]:divide-gray-200",
        "[&_tr]:border-b [&_tr]:border-gray-200",
        "[&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-medium",
        "[&_td]:py-2 [&_td]:pr-4 [&_td]:align-top",
        "[&_hr]:my-8 [&_hr]:border-gray-200",
        "[&_a]:text-orange-600 hover:[&_a]:underline",
        "[&_strong]:font-semibold",
      ].join(" ")}
    >
      {children}
    </article>
  );
}

export function InternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href}>{children}</Link>;
}
