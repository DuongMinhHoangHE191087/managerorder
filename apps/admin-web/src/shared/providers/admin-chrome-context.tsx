"use client";

import { createContext, useContext } from "react";

const AdminChromeContext = createContext(false);

export function AdminChromeProvider({ children }: { children: React.ReactNode }) {
  return <AdminChromeContext.Provider value>{children}</AdminChromeContext.Provider>;
}

export function useAdminChrome() {
  return useContext(AdminChromeContext);
}
