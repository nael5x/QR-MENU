import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { apiGet } from "@/src/api";
import { useToast } from "@/src/ui";

export interface OrderLine {
  item_id: string;
  name: Record<string, string>;
  unit_price: number;
  qty: number;
  size?: { name: Record<string, string>; price: number } | null;
  addons: { name: Record<string, string>; price: number }[];
  note?: string;
  line_total: number;
}
export interface Order {
  id: string;
  table_label: string;
  items: OrderLine[];
  total: number;
  note: string;
  status: string;
  created_at: string;
}
export interface WaiterCall {
  id: string;
  table_label: string;
  status: string;
  created_at: string;
}

interface LiveData {
  orders: Order[];
  waiter_calls: WaiterCall[];
  new_orders_count: number;
  pending_calls_count: number;
  alert_count: number;
}

interface LiveCtx {
  data: LiveData;
  alertCount: number;
  refresh: () => Promise<void>;
}

const empty: LiveData = { orders: [], waiter_calls: [], new_orders_count: 0, pending_calls_count: 0, alert_count: 0 };
const Ctx = createContext<LiveCtx>({ data: empty, alertCount: 0, refresh: async () => {} });

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [data, setData] = useState<LiveData>(empty);
  const prev = useRef({ orders: 0, calls: 0 });
  const started = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const d: LiveData = await apiGet("/live");
      setData(d);
      if (started.current) {
        if (d.new_orders_count > prev.current.orders) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast(t("new_order_arrived"), "success");
        } else if (d.pending_calls_count > prev.current.calls) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          toast(t("waiter_call_arrived"), "info");
        }
      }
      prev.current = { orders: d.new_orders_count, calls: d.pending_calls_count };
      started.current = true;
    } catch {
      /* ignore poll errors */
    }
  }, [user, toast, t]);

  useEffect(() => {
    if (!user) {
      setData(empty);
      started.current = false;
      prev.current = { orders: 0, calls: 0 };
      return;
    }
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [user, refresh]);

  return <Ctx.Provider value={{ data, alertCount: data.alert_count, refresh }}>{children}</Ctx.Provider>;
}

export const useLive = () => useContext(Ctx);
