import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { apiPublic, fileUrl } from "@/src/api";
import { colors, spacing, fontSize, ff } from "@/src/theme";
import { ToastProvider, useToast, ScrollView } from "@/src/ui";

const STR: Record<string, Record<string, string>> = {
  ar: {
    menu: "المنيو",
    unavailable: "غير متوفر",
    call_waiter: "نداء النادل",
    waiter_called: "تم إرسال النداء للنادل",
    orders_off: "الطلب غير متاح حالياً — يمكنك تصفح المنيو",
    not_found: "الطاولة غير موجودة أو الرمز غير صحيح",
    retry: "إعادة المحاولة",
    sar: "ر.س",
    empty: "لا توجد أصناف",
  },
  en: {
    menu: "Menu",
    unavailable: "Out of stock",
    call_waiter: "Call Waiter",
    waiter_called: "Waiter has been notified",
    orders_off: "Ordering unavailable — browse the menu",
    not_found: "Table not found or invalid code",
    retry: "Retry",
    sar: "SAR",
    empty: "No items",
  },
  fr: { menu: "Menu", unavailable: "Épuisé", call_waiter: "Appeler le serveur", waiter_called: "Le serveur a été prévenu", orders_off: "Commande indisponible — consultez le menu", not_found: "Table introuvable", retry: "Réessayer", sar: "SAR", empty: "Aucun article" },
  tr: { menu: "Menü", unavailable: "Tükendi", call_waiter: "Garson Çağır", waiter_called: "Garson bilgilendirildi", orders_off: "Sipariş şu anda kapalı — menüye göz atın", not_found: "Masa bulunamadı", retry: "Tekrar dene", sar: "SAR", empty: "Ürün yok" },
  ur: { menu: "مینو", unavailable: "دستیاب نہیں", call_waiter: "ویٹر کو بلائیں", waiter_called: "ویٹر کو اطلاع دے دی گئی", orders_off: "آرڈر دستیاب نہیں — مینو دیکھیں", not_found: "میز نہیں ملی", retry: "دوبارہ کوشش کریں", sar: "SAR", empty: "کوئی آئٹم نہیں" },
};

const LANG_LABEL: Record<string, string> = { ar: "ع", en: "EN", fr: "FR", tr: "TR", ur: "اردو" };
const RTL_LANGS = ["ar", "ur"];

function pickL(map: Record<string, string> | undefined, lang: string): string {
  if (!map) return "";
  return map[lang] || map["ar"] || map["en"] || Object.values(map)[0] || "";
}

interface MenuData {
  restaurant: { name: string; languages: string[] };
  branch: { name: string; orders_enabled: boolean };
  table: { label: string };
  categories: {
    id: string;
    name: Record<string, string>;
    items: { id: string; name: Record<string, string>; description: Record<string, string>; price: number; image_url: string | null; available: boolean }[];
  }[];
}

function CustomerMenu() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const toast = useToast();
  const [data, setData] = useState<MenuData | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [lang, setLang] = useState("ar");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const d: MenuData = await apiPublic(`/public/menu/${token}`);
      setData(d);
      setLang(d.restaurant.languages?.[0] || "ar");
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const s = (k: string) => (STR[lang] || STR.ar)[k];
  const isRTL = RTL_LANGS.includes(lang);
  const dir = isRTL ? "rtl" : "ltr";
  const ta: "right" | "left" = isRTL ? "right" : "left";

  if (status === "loading") {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </SafeAreaView>
    );
  }

  if (status === "error" || !data) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.error} />
        <Text style={[styles.errTxt]}>{STR.ar.not_found}</Text>
        <Pressable testID="menu-retry" onPress={load} style={styles.retryBtn}>
          <Text style={styles.retryTxt}>{STR.ar.retry}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} testID="customer-menu">
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rName, { textAlign: ta, writingDirection: dir }]} numberOfLines={1}>
            {data.restaurant.name}
          </Text>
          <Text style={[styles.branch, { textAlign: ta, writingDirection: dir }]} numberOfLines={1}>
            {data.branch.name} · {data.table.label}
          </Text>
        </View>
        {/* Language switcher */}
        <View style={styles.langRow}>
          {(data.restaurant.languages || ["ar"]).map((lc) => {
            const active = lc === lang;
            return (
              <Pressable
                key={lc}
                testID={`lang-${lc}`}
                onPress={() => setLang(lc)}
                style={[styles.langChip, { backgroundColor: active ? colors.brand : colors.surface }]}
              >
                <Text style={[styles.langTxt, { color: active ? colors.onBrand : colors.onSurface }]}>{LANG_LABEL[lc] || lc}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {!data.branch.orders_enabled ? (
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={16} color={colors.onWarning} />
          <Text style={[styles.noticeTxt, { textAlign: ta }]}>{s("orders_off")}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        {data.categories.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.errTxt}>{s("empty")}</Text>
          </View>
        ) : (
          data.categories.map((cat) => (
            <View key={cat.id}>
              <Text style={[styles.catTitle, { textAlign: ta, writingDirection: dir }]}>{pickL(cat.name, lang)}</Text>
              {cat.items.map((item) => (
                <View key={item.id} style={styles.itemRow} testID={`menu-item-${item.id}`}>
                  {item.image_url ? (
                    <Image source={{ uri: fileUrl(item.image_url) }} style={styles.thumb} contentFit="cover" transition={120} recyclingKey={item.id} />
                  ) : null}
                  <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
                    <Text style={[styles.itemName, { textAlign: ta, writingDirection: dir, color: item.available ? colors.onSurface : colors.muted }]}>
                      {pickL(item.name, lang)}
                    </Text>
                    {pickL(item.description, lang) ? (
                      <Text style={[styles.itemDesc, { textAlign: ta, writingDirection: dir }]} numberOfLines={2}>
                        {pickL(item.description, lang)}
                      </Text>
                    ) : null}
                    {!item.available ? (
                      <Text style={[styles.unavail, { textAlign: ta }]}>{s("unavailable")}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.price}>
                    {item.price} {s("sar")}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Call waiter (fixed bottom) */}
      <Pressable
        testID="call-waiter-btn"
        onPress={() => toast(s("waiter_called"), "success")}
        style={styles.waiterBtn}
      >
        <Ionicons name="notifications" size={20} color={colors.onBrand} />
        <Text style={styles.waiterTxt}>{s("call_waiter")}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

export default function CustomerMenuScreen() {
  return (
    <ToastProvider>
      <CustomerMenu />
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, padding: spacing.xl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.borderStrong,
    gap: spacing.sm,
  },
  rName: { fontFamily: ff.bold, fontSize: fontSize.xl, color: colors.onSurface },
  branch: { fontFamily: ff.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  langRow: { flexDirection: "row", gap: 4 },
  langChip: { minWidth: 34, height: 30, paddingHorizontal: 6, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  langTxt: { fontFamily: ff.bold, fontSize: fontSize.sm },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  noticeTxt: { flex: 1, fontFamily: ff.semibold, fontSize: fontSize.sm, color: colors.onWarning },
  catTitle: {
    fontFamily: ff.bold,
    fontSize: fontSize.lg,
    color: colors.onBrand,
    backgroundColor: colors.surfaceInverse,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  thumb: { width: 64, height: 64, borderWidth: 1, borderColor: colors.border },
  itemName: { fontFamily: ff.semibold, fontSize: fontSize.lg, color: colors.onSurface },
  itemDesc: { fontFamily: ff.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  unavail: { fontFamily: ff.bold, fontSize: fontSize.sm, color: colors.error, marginTop: 2 },
  price: { fontFamily: ff.mono, fontSize: fontSize.base, color: colors.brand, fontWeight: "700" },
  waiterBtn: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    height: 54,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  waiterTxt: { fontFamily: ff.bold, fontSize: fontSize.lg, color: colors.onBrand },
  errTxt: { fontFamily: ff.semibold, fontSize: fontSize.base, color: colors.muted, marginVertical: spacing.md, textAlign: "center" },
  retryBtn: { borderWidth: 2, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryTxt: { fontFamily: ff.bold, color: colors.onSurface },
});
