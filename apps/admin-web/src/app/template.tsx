import type { ReactNode } from "react";

export default function Template({ children }: { readonly children: ReactNode }) {
  return <div className="w-full min-h-[calc(100vh-4rem)]">{children}</div>;
}
