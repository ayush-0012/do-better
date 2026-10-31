import { createContext, useContext, useState, type ReactNode } from "react";
import type { RunConfiguration } from "@/lib/run-types";

export interface HeaderEntry { id: string; name: string; value: string }
export interface RequestDraft extends RunConfiguration { body: string; headers: HeaderEntry[] }

const defaultDraft: RequestDraft = {
  url: "http://localhost:8080/api/orders", pattern: "constant", rate: 20, rateUnit: "per_second",
  durationSeconds: 30, concurrency: 10,
  body: '{\n  "productId": "sku_1042",\n  "quantity": 2,\n  "currency": "USD"\n}',
  headers: [{ id: "content-type", name: "Content-Type", value: "application/json" }],
};

const DraftContext = createContext<{
  draft: RequestDraft; updateDraft: (changes: Partial<RequestDraft>) => void;
  loadConfiguration: (configuration: RunConfiguration) => void; resetDraft: () => void;
} | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  // Payloads and credentials deliberately remain in memory, never browser storage.
  const [draft, setDraft] = useState(defaultDraft);
  const updateDraft = (changes: Partial<RequestDraft>) => setDraft((current) => ({ ...current, ...changes }));
  const loadConfiguration = (configuration: RunConfiguration) => setDraft({
    ...configuration, body: "", headers: [],
  });
  return <DraftContext.Provider value={{ draft, updateDraft, loadConfiguration, resetDraft: () => setDraft(defaultDraft) }}>{children}</DraftContext.Provider>;
}

export function useRequestDraft() {
  const context = useContext(DraftContext);
  if (!context) throw new Error("DraftProvider is required");
  return context;
}
