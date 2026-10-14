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
  themeColor: "#14161B",
};

import { SessionGate } from "@/components/SessionGate";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="bg-[#BAC7B8] font-outfit antialiased text-[#F3F4EE] selection:bg-[#FF5E48] selection:text-white min-h-screen flex justify-center">
        {/* Mobile viewport container */}
        <div className="relative min-h-screen w-full max-w-md mx-auto bg-[#14161B] text-[#F3F4EE] flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.35)] sm:my-4 sm:min-h-[calc(100vh-2rem)] sm:rounded-[40px] sm:border sm:border-black/30 overflow-x-hidden">
          <SessionGate>
            {/* Scrollable content area above the tab bar */}
            <main className="flex-1 overflow-y-auto pb-24 relative">
              {children}
            </main>

            {/* Bottom tab bar */}
            <BottomTabBar />
          </SessionGate>
        </div>
      </body>
    </html>
  );
}
