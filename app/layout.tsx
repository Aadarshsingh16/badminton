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
  themeColor: "#0A0A14",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="bg-slate-950 font-outfit antialiased">
        {/* Max-width container for larger screens */}
        <div className="relative min-h-screen max-w-lg mx-auto flex flex-col">
          {/* Subtle gradient bg */}
          <div className="fixed inset-0 max-w-lg mx-auto pointer-events-none">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl" />
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
