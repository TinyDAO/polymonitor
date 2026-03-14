import type { Metadata } from "next";
import { Sora, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { Web3Provider } from "@/providers/web3-provider";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlex = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Polymonitor - Polymarket Account Monitor",
  description: "Monitor Polymarket account balances and positions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sora.variable} ${ibmPlex.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Web3Provider>
          {children}
          <Toaster theme="dark" position="top-center" />
        </Web3Provider>
      </body>
    </html>
  );
}
