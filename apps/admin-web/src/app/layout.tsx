import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ConditionalProviders } from "@/app/providers/conditional-providers";
import { vi } from "@/shared/messages/vi";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${vi.navigation.brand.title} | ${vi.navigation.brand.subtitle}`,
  description: vi.navigation.brand.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className="scroll-smooth"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased text-slate-900" suppressHydrationWarning>
        <ConditionalProviders>{children}</ConditionalProviders>
      </body>
    </html>
  );
}
