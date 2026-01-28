import React from "react";
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

// 👇【超重要】これがないと全てのデザインが死にます
import "./globals.css"; 

import AppWalletProvider from "@/components/AppWalletProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'VaultBank',
  description: 'Secure Banking Dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        <AppWalletProvider>
             {children}
        </AppWalletProvider>
      </body>
    </html>
  );
}