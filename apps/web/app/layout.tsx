import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@turnkey/react-wallet-kit/styles.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cipher",
  description: "AI crypto co-pilot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-zinc-950 text-zinc-50">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
