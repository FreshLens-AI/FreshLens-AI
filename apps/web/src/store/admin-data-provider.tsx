"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AdminDataSnapshot } from "@/types/domain";

const AdminDataContext = createContext<AdminDataSnapshot | null>(null);

export function AdminDataProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData: AdminDataSnapshot;
}) {
  return (
    <AdminDataContext.Provider value={initialData}>
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error("useAdminData must be used inside AdminDataProvider");
  }
  return context;
}
