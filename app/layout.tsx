import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "API Autopsy — Root Cause & Code Impact for API Contract Changes",
  description:
    "An AI-powered incident investigation platform connecting external API contract changes to the exact lines of application code that depend on them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07080a] text-slate-100 antialiased selection:bg-rose-500/20 selection:text-rose-200">
        {children}
      </body>
    </html>
  );
}
