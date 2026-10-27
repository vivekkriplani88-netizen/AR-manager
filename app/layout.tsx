import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AsOfPicker } from "@/components/as-of-picker";
import { MainNav, NavLinks } from "@/components/main-nav";
import { SELLER } from "@/lib/seller";
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
  title: "AR Manager · Brightwater Advisory",
  description: "Accounts receivable for Brightwater Advisory Pvt. Ltd.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white print:hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
            <Link href="/" className="leading-tight">
              <span className="block font-semibold">AR Manager</span>
              <span className="block text-xs text-zinc-500">{SELLER.name}</span>
            </Link>
            <Suspense fallback={<NavLinks asOf={null} pathname={null} />}>
              <MainNav />
            </Suspense>
            <div className="ml-auto">
              <Suspense fallback={null}>
                <AsOfPicker />
              </Suspense>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
