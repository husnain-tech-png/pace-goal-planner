import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";

export const metadata: Metadata = { title: "Pace — Goals into plans", description: "A private AI planner that turns goals into sustainable progress." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
