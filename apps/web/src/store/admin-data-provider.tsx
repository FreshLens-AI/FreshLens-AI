"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  mockAlerts,
  mockProducts,
  mockShelfLifeRules,
  mockTenants,
} from "@/data/mock-data";
import type {
  Alert,
  AlertInput,
  Product,
  ProductInput,
  ShelfLifeRule,
  Tenant,
  TenantInput,
} from "@/types/domain";

interface AdminDataContextValue {
  tenants: Tenant[];
  products: Product[];
  alerts: Alert[];
  shelfLifeRules: ShelfLifeRule[];
  updateTenant: (id: string, input: TenantInput) => void;
  createProduct: (input: ProductInput) => Product;
  updateProduct: (id: string, input: ProductInput) => void;
  createAlert: (input: AlertInput) => Alert;
  updateAlert: (id: string, input: AlertInput) => void;
  dismissAlert: (id: string) => void;
  acknowledgeAlert: (id: string) => void;
  updateShelfLifeRule: (id: string, days: number) => void;
  resetDemoData: () => void;
}

interface PersistedState {
  tenants: Tenant[];
  products: Product[];
  alerts: Alert[];
  shelfLifeRules: ShelfLifeRule[];
}

const STORAGE_KEY = "freshlens-admin-demo-v1";
const AdminDataContext = createContext<AdminDataContextValue | null>(null);

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>(mockTenants);
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [shelfLifeRules, setShelfLifeRules] =
    useState<ShelfLifeRule[]>(mockShelfLifeRules);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let restored: PersistedState | null = null;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        restored = JSON.parse(saved) as PersistedState;
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    const hydrationFrame = window.requestAnimationFrame(() => {
      if (restored) {
        setTenants(restored.tenants ?? mockTenants);
        setProducts(restored.products ?? mockProducts);
        setAlerts(restored.alerts ?? mockAlerts);
        setShelfLifeRules(restored.shelfLifeRules ?? mockShelfLifeRules);
      }
      setStorageReady(true);
    });

    return () => window.cancelAnimationFrame(hydrationFrame);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const state: PersistedState = {
      tenants,
      products,
      alerts,
      shelfLifeRules,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [alerts, products, shelfLifeRules, storageReady, tenants]);

  const value = useMemo<AdminDataContextValue>(
    () => ({
      tenants,
      products,
      alerts,
      shelfLifeRules,
      updateTenant(id, input) {
        setTenants((items) =>
          items.map((tenant) =>
            tenant.id === id ? { ...tenant, ...input } : tenant,
          ),
        );
      },
      createProduct(input) {
        const product: Product = {
          id: makeId("prd"),
          ...input,
          tenantCoverage: 0,
          scansThisMonth: 0,
          updatedAt: now(),
        };
        setProducts((items) => [product, ...items]);
        return product;
      },
      updateProduct(id, input) {
        setProducts((items) =>
          items.map((product) =>
            product.id === id
              ? { ...product, ...input, updatedAt: now() }
              : product,
          ),
        );
      },
      createAlert(input) {
        const alert: Alert = {
          id: makeId("alt"),
          ...input,
          createdAt: now(),
          updatedAt: now(),
        };
        setAlerts((items) => [alert, ...items]);
        return alert;
      },
      updateAlert(id, input) {
        setAlerts((items) =>
          items.map((alert) =>
            alert.id === id
              ? { ...alert, ...input, updatedAt: now() }
              : alert,
          ),
        );
      },
      dismissAlert(id) {
        setAlerts((items) =>
          items.map((alert) =>
            alert.id === id
              ? { ...alert, status: "dismissed", updatedAt: now() }
              : alert,
          ),
        );
      },
      acknowledgeAlert(id) {
        setAlerts((items) =>
          items.map((alert) =>
            alert.id === id
              ? { ...alert, status: "acknowledged", updatedAt: now() }
              : alert,
          ),
        );
      },
      updateShelfLifeRule(id, days) {
        setShelfLifeRules((items) =>
          items.map((rule) =>
            rule.id === id
              ? { ...rule, defaultDays: days, updatedAt: now() }
              : rule,
          ),
        );
      },
      resetDemoData() {
        setTenants(mockTenants);
        setProducts(mockProducts);
        setAlerts(mockAlerts);
        setShelfLifeRules(mockShelfLifeRules);
        window.localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [alerts, products, shelfLifeRules, tenants],
  );

  if (!storageReady) {
    return (
      <div className="workspace-boot" aria-busy="true" aria-live="polite">
        <span className="workspace-boot__mark" aria-hidden="true">FL</span>
        <div>
          <strong>Loading FreshLens Admin</strong>
          <p>Preparing the local demo workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <AdminDataContext.Provider value={value}>
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
