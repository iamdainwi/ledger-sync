import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LedgerSync — Banking Reconciliation",
  description: "Mini Banking Transaction Reconciliation System",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        style={{ background: "var(--color-page)", color: "var(--color-ink)" }}
      >
        {/* ── Top bar ── */}
        <header
          className="sticky top-0 z-30 flex h-12 items-center gap-6 border-b px-6"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-line)",
          }}
        >
          {/* Brand */}
          <Link
            href="/"
            className="text-[15px] font-semibold tracking-tight"
            style={{ color: "var(--color-ink)" }}
          >
            LedgerSync
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {[
              { href: "/", label: "Dashboard" },
              { href: "/run", label: "New Run" },
              { href: "/runs", label: "History" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-md px-3 py-1.5 text-[13px] transition-colors hover:bg-[var(--color-soft)]"
                style={{ color: "var(--color-ink-2)" }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
