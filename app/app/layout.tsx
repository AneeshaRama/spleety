import type { Metadata } from "next";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: "SPLEETY - Split It Retro Style! 🎮",
  description: "Split expenses on Solana with retro gaming vibes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="scanlines">
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
