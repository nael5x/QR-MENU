import React, { useCallback, useState } from "react";
import { View, StyleSheet, RefreshControl, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useI18n, pick } from "@/src/i18n";
import { useLive, Order } from "@/src/live";
import { apiPatch } from "@/src/api";
import { Txt, Header, EmptyState, useToast, Screen, ScrollView } from "@/src/ui";
import { colors, spacing, fontSize, ff } from "@/src/theme";

const STATUS_META: Record<string, { color: string; next?: string; nextLabel?: string }> = {
  new: { color: colors.info },
  preparing: { color: colors.warning },
  ready: { color: colors.success },
  completed: { color: colors.muted },
  cancelled: { color: colors.error },
};

export default function Orders() {
  const { t, lang } = useI18n();
  const { data, refresh } = useLive();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const setStatus = async (order: Order, status: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiPatch(`/orders/${order.id}/status`, { status });
      await refresh();
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    }
  };

  const ackCall = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiPatch(`/waiter-calls/${id}/ack`, {});
      await refresh();
      toast(t("acknowledge"), "success");
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    }
  };

  const activeOrders = data.orders.filter((o) => o.status !== "completed" && o.status !== "cancelled");
  const doneOrders = data.orders.filter((o) => o.status === "completed" || o.status === "cancelled").slice(0, 10);

  const statusLabel = (s: string) => t(`order_${s}` as any);

  const actions = (o: Order) => {
    if (o.status === "new")
      return [
        { label: t("mark_preparing"), status: "preparing", color: colors.brand },
        { label: t("order_cancelled"), status: "cancelled", color: colors.error, outline: true },
      ];
    if (o.status === "preparing") return [{ label: t("mark_ready"), status: "ready", color: colors.success }];
    if (o.status === "ready") return [{ label: t("mark_completed"), status: "completed", color: colors.onSurface }];
    return [];
  };

  return (
    <Screen>
      <Header title={t("live_orders")} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Waiter calls */}
        {data.waiter_calls.length > 0 ? (
          <View>
            <Txt weight="bold" size={fontSize.sm} color={colors.muted} style={{ marginBottom: spacing.sm, letterSpacing: 1 }}>
              {t("waiter_calls").toUpperCase()}
            </Txt>
            {data.waiter_calls.map((c) => (
              <View key={c.id} style={styles.callCard} testID={`waiter-call-${c.id}`}>
                <Ionicons name="notifications" size={22} color={colors.onBrand} />
                <Txt weight="bold" size={fontSize.lg} color={colors.onBrand} style={{ flex: 1, marginHorizontal: spacing.sm }}>
                  {t("table")} · {c.table_label}
                </Txt>
                <Pressable testID={`ack-call-${c.id}`} onPress={() => ackCall(c.id)} style={styles.ackBtn}>
                  <Txt weight="bold" color={colors.onBrand}>
                    {t("acknowledge")}
                  </Txt>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {/* Active orders */}
        {activeOrders.length === 0 && data.waiter_calls.length === 0 ? (
          <EmptyState text={t("no_orders")} icon="receipt-outline" />
        ) : null}

        {activeOrders.map((o) => (
          <View key={o.id} style={styles.orderCard} testID={`order-${o.id}`}>
            <View style={styles.orderHead}>
              <Txt weight="bold" size={fontSize.lg} style={{ flex: 1 }}>
                {t("table")} · {o.table_label}
              </Txt>
              <View style={[styles.statusPill, { backgroundColor: STATUS_META[o.status]?.color || colors.muted }]}>
                <Txt weight="bold" size={fontSize.sm} color={o.status === "preparing" ? colors.onWarning : colors.onBrand}>
                  {statusLabel(o.status)}
                </Txt>
              </View>
            </View>

            {o.items.map((li, idx) => (
              <View key={idx} style={styles.line}>
                <Txt weight="bold" style={{ fontFamily: ff.mono }}>
                  {li.qty}×
                </Txt>
                <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                  <Txt weight="semibold">
                    {pick(li.name, lang)}
                    {li.size ? ` · ${pick(li.size.name, lang)}` : ""}
                  </Txt>
                  {li.addons?.length ? (
                    <Txt size={fontSize.sm} color={colors.muted}>
                      + {li.addons.map((a) => pick(a.name, lang)).join(", ")}
                    </Txt>
                  ) : null}
                  {li.note ? (
                    <Txt size={fontSize.sm} color={colors.brandSecondary}>
                      {t("note")}: {li.note}
                    </Txt>
                  ) : null}
                </View>
                <Txt style={{ fontFamily: ff.mono }}>{li.line_total}</Txt>
              </View>
            ))}

            {o.note ? (
              <Txt size={fontSize.sm} color={colors.brandSecondary} style={{ marginTop: spacing.xs }}>
                {t("note")}: {o.note}
              </Txt>
            ) : null}

            <View style={styles.totalRow}>
              <Txt weight="bold">{t("total")}</Txt>
              <Txt weight="bold" style={{ fontFamily: ff.mono }} color={colors.brand}>
                {o.total} {t("sar")}
              </Txt>
            </View>

            <View style={styles.actionRow}>
              {actions(o).map((a: any) => (
                <Pressable
                  key={a.status}
                  testID={`order-${o.id}-${a.status}`}
                  onPress={() => setStatus(o, a.status)}
                  style={[
                    styles.actionBtn,
                    a.outline
                      ? { backgroundColor: colors.surface, borderColor: a.color }
                      : { backgroundColor: a.color, borderColor: colors.borderStrong },
                  ]}
                >
                  <Txt weight="bold" size={fontSize.sm} color={a.outline ? a.color : a.color === colors.warning ? colors.onWarning : colors.onBrand}>
                    {a.label}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {doneOrders.length > 0 ? (
          <View>
            <Txt weight="bold" size={fontSize.sm} color={colors.muted} style={{ marginTop: spacing.md, marginBottom: spacing.sm, letterSpacing: 1 }}>
              {t("order_completed").toUpperCase()}
            </Txt>
            {doneOrders.map((o) => (
              <View key={o.id} style={styles.doneRow}>
                <Txt color={colors.muted} style={{ flex: 1 }}>
                  {t("table")} · {o.table_label}
                </Txt>
                <Txt color={colors.muted} style={{ fontFamily: ff.mono }}>
                  {o.total} {t("sar")}
                </Txt>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  callCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  ackBtn: { borderWidth: 2, borderColor: colors.onBrand, paddingHorizontal: spacing.md, paddingVertical: 6 },
  orderCard: { borderWidth: 2, borderColor: colors.border, padding: spacing.md, backgroundColor: colors.surface },
  orderHead: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 3 },
  line: { flexDirection: "row", alignItems: "flex-start", paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.divider },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 2, borderTopColor: colors.border },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1, height: 44, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  doneRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
});
