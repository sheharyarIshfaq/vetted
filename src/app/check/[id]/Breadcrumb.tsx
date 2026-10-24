import Link from "next/link";

export function Breadcrumb({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted">
      <Link href="/" className="font-semibold">
        New check
      </Link>
      <span aria-hidden="true">/</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}
