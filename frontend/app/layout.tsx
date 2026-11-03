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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Nav */}
        <header className="border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center gap-6">
            <Link href="/" className="font-semibold text-lg tracking-tight">
              LedgerSync
            </Link>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link href="/run" className="hover:text-foreground transition-colors">
                New Run
              </Link>
              <Link href="/runs" className="hover:text-foreground transition-colors">
                Run History
              </Link>
            </nav>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <footer className="border-t py-4 text-center text-xs text-muted-foreground">
          LedgerSync — Mini Banking Transaction Reconciliation System
        </footer>
      </body>
    </html>
  );
}
