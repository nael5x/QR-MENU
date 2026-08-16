import React, { useCallback, useState } from "react";
import { View, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { apiGet, apiPatch } from "@/src/api";
import { Txt, Header, Card, Switch, Loading, ErrorState, useToast, ScrollView, Screen } from "@/src/ui";
import { colors, spacing, fontSize, ff } from "@/src/theme";

interface Stats {
  branches: number;
  tables: number;
  categories: number;
  items: number;
  unavailable_items: number;
  orders_enabled: boolean;
}

export default function Dashboard() {
  const { user, restaurant, isAdmin, setRestaurant } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [ordersOn, setOrdersOn] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiGet("/dashboard");
      setStats(data);
      setOrdersOn(data.orders_enabled);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleOrders = async (v: boolean) => {
    if (!isAdmin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setOrdersOn(v);
    try {
      const r = await apiPatch("/restaurant", { orders_enabled: v });
      if (restaurant) setRestaurant({ ...restaurant, orders_enabled: r.orders_enabled });
      toast(v ? t("orders_on") : t("orders_off"), v ? "success" : "info");
    } catch (e: any) {
      setOrdersOn(!v);
      toast(e.message || t("error_generic"), "error");
    }
  };

  const kpis = stats
    ? [
        { label: t("kpi_branches"), value: stats.branches, icon: "business" as const },
        { label: t("kpi_tables"), value: stats.tables, icon: "grid" as const },
        { label: t("kpi_categories"), value: stats.categories, icon: "list" as const },
        { label: t("kpi_items"), value: stats.items, icon: "fast-food" as const },
      ]
    : [];

  return (
    <Screen>
      <Header title={restaurant?.name || t("app_name")} subtitle={t("overview")} />
      {status === "loading" ? (
        <Loading />
      ) : status === "error" ? (
        <ErrorState text={t("error_generic")} onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          <Txt weight="semibold" color={colors.muted} style={{ marginBottom: spacing.md }}>
            {t("welcome")}، {user?.name}
          </Txt>

          {/* Orders master switch */}
          <Card style={{ marginBottom: spacing.lg, backgroundColor: ordersOn ? colors.surface : colors.brandTertiary }}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Txt weight="bold" size={fontSize.lg}>
                  {t("orders_status")}
                </Txt>
                <Txt size={fontSize.sm} color={ordersOn ? colors.success : colors.brandSecondary} weight="bold">
                  {ordersOn ? t("orders_on") : t("orders_off")}
                </Txt>
              </View>
              <Switch testID="orders-toggle" value={ordersOn} onValueChange={toggleOrders} />
            </View>
            <Txt size={fontSize.sm} color={colors.muted} style={{ marginTop: spacing.sm }}>
              {t("orders_paused_hint")}
            </Txt>
          </Card>

          {/* KPI grid */}
          <View style={styles.grid}>
            {kpis.map((k) => (
              <Card key={k.label} style={styles.kpi}>
                <Ionicons name={k.icon} size={22} color={colors.brand} />
                <Txt weight="bold" size={fontSize.xxxl} style={{ marginTop: spacing.sm, fontFamily: ff.mono }}>
                  {k.value}
                </Txt>
                <Txt size={fontSize.sm} color={colors.muted}>
                  {k.label}
                </Txt>
              </Card>
            ))}
          </View>

          {stats && stats.unavailable_items > 0 ? (
            <Card style={{ marginTop: spacing.lg, borderColor: colors.brand }}>
              <View style={styles.switchRow}>
                <Ionicons name="alert-circle" size={22} color={colors.brand} style={{ marginHorizontal: 6 }} />
                <Txt weight="semibold" style={{ flex: 1 }}>
                  {stats.unavailable_items} {t("kpi_unavailable")}
                </Txt>
              </View>
            </Card>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  kpi: { width: "47.5%", alignItems: "flex-start" },
});
