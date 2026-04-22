import type { ReactNode } from "react";

// Minimal layout for public short link pages — no admin nav, no auth
export default function ShortLinkLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 antialiased">
      {children}
    </div>
  );
}
