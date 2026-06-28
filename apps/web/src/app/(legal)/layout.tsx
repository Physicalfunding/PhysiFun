export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-gray-700">
      {children}
    </article>
  );
}
