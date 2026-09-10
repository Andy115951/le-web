"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicUser } from "@/lib/types";

export type QuotaBucket = {
  readings: number;
  messages: number;
};

export type QuotaSnapshot = {
  user: PublicUser | null;
  usage: QuotaBucket;
  quota: QuotaBucket;
  remaining: QuotaBucket;
  loading: boolean;
  error: string | null;
};

const EMPTY: QuotaBucket = { readings: 0, messages: 0 };

export function useQuota(): QuotaSnapshot & { refresh: () => Promise<void> } {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [usage, setUsage] = useState<QuotaBucket>(EMPTY);
  const [quota, setQuota] = useState<QuotaBucket>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) throw new Error("额度暂不可用");
      const data = await res.json();
      const nextUsage = (data.usage ?? EMPTY) as QuotaBucket;
      const nextQuota = (data.quota ?? EMPTY) as QuotaBucket;
      setUser(data.user ?? null);
      setUsage(nextUsage);
      setQuota(nextQuota);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "额度暂不可用");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    user,
    usage,
    quota,
    remaining: {
      readings: Math.max(0, quota.readings - usage.readings),
      messages: Math.max(0, quota.messages - usage.messages),
    },
    loading,
    error,
    refresh,
  };
}
