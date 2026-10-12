import Link from "next/link";
import { Aurora } from "../ui/aurora";
import { Logo } from "../ui/logo";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="relative px-4">
      <Aurora className="opacity-50" />
      <div className="mx-auto max-w-3xl py-8">
        <Link href="/"><Logo /></Link>
        <article className="glass mt-10 rounded-[32px] p-7 sm:p-12">
          <h1 className="font-display text-4xl font-medium">{title}</h1>
          <p className="mt-2 text-sm text-muted">Ultimo aggiornamento: {updated}</p>
          <div className="mt-8 space-y-5 leading-relaxed text-muted [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
        </article>
      </div>
    </div>
  );
}
