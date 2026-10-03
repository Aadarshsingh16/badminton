import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { BottomTabBar } from "@/components/BottomTabBar";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Badminton | Round-Robin Tournament Manager",
  description:
    "Mobile-first app for round-robin badminton tournaments with live tables, finals, and a running day table across multiple sessions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F7F9FD",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="bg-[#EEF1F7] font-outfit antialiased text-slate-900 selection:bg-blue-100 selection:text-blue-900">
        {/* Mobile viewport container */}
        <div className="relative min-h-screen max-w-md mx-auto bg-[#F7F9FD] flex flex-col shadow-2xl border-x border-slate-200/60 overflow-x-hidden">
          {/* Subtle soft pastel ambient aura */}
          <div className="fixed inset-0 max-w-md mx-auto pointer-events-none overflow-hidden">
            <div className="absolute -top-12 -left-12 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl" />
            <div className="absolute top-1/3 -right-16 w-64 h-64 bg-purple-300/15 rounded-full blur-3xl" />
          </div>

          {/* Scrollable content area above the tab bar */}
          <main className="flex-1 overflow-y-auto pb-24 relative">
            {children}
          </main>

          {/* Bottom tab bar */}
          <BottomTabBar />
        </div>
      </body>
    </html>
  );
}
