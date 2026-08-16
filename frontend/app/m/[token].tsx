import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiPublic, apiPublicPost, fileUrl } from "@/src/api";
import { colors, spacing, fontSize, ff } from "@/src/theme";
import { ToastProvider, useToast, ScrollView } from "@/src/ui";

const STR: Record<string, Record<string, string>> = {
  ar: {
    unavailable: "غير متوفر", call_waiter: "نداء النادل", waiter_called: "تم إرسال النداء للنادل",
    orders_off: "الطلب غير متاح حالياً — يمكنك تصفح المنيو", not_found: "الطاولة غير موجودة أو الرمز غير صحيح",
    retry: "إعادة المحاولة", sar: "ر.س", empty: "لا توجد أصناف", size: "الحجم", addons: "الإضافات",
    add_to_cart: "أضف للسلة", cart: "السلة", send_order: "إرسال الطلب", order_sent: "تم إرسال طلبك بنجاح",
    view_cart: "عرض السلة", order_note: "ملاحظة على الطلب (اختياري)", item_note: "ملاحظة (اختياري)",
    qty: "الكمية", total: "الإجمالي", offers: "عروض", order_status: "حالة طلبك", remove: "إزالة",
    st_new: "تم الاستلام", st_preparing: "قيد التحضير", st_ready: "جاهز", st_completed: "تم التسليم", st_cancelled: "ملغي",
    close: "إغلاق",
  },
  en: {
    unavailable: "Out of stock", call_waiter: "Call Waiter", waiter_called: "Waiter has been notified",
    orders_off: "Ordering unavailable — browse the menu", not_found: "Table not found or invalid code",
    retry: "Retry", sar: "SAR", empty: "No items", size: "Size", addons: "Add-ons",
    add_to_cart: "Add to cart", cart: "Cart", send_order: "Send Order", order_sent: "Your order was sent",
    view_cart: "View cart", order_note: "Order note (optional)", item_note: "Note (optional)",
    qty: "Qty", total: "Total", offers: "OFFERS", order_status: "Your order status", remove: "Remove",
    st_new: "Received", st_preparing: "Preparing", st_ready: "Ready", st_completed: "Delivered", st_cancelled: "Cancelled",
    close: "Close",
  },
  fr: { unavailable: "Épuisé", call_waiter: "Appeler le serveur", waiter_called: "Le serveur a été prévenu", orders_off: "Commande indisponible — consultez le menu", not_found: "Table introuvable", retry: "Réessayer", sar: "SAR", empty: "Aucun article", size: "Taille", addons: "Suppléments", add_to_cart: "Ajouter", cart: "Panier", send_order: "Envoyer", order_sent: "Commande envoyée", view_cart: "Voir le panier", order_note: "Note (optionnel)", item_note: "Note (optionnel)", qty: "Qté", total: "Total", offers: "OFFRES", order_status: "Statut", remove: "Retirer", st_new: "Reçue", st_preparing: "En préparation", st_ready: "Prête", st_completed: "Livrée", st_cancelled: "Annulée", close: "Fermer" },
  tr: { unavailable: "Tükendi", call_waiter: "Garson Çağır", waiter_called: "Garson bilgilendirildi", orders_off: "Sipariş kapalı — menüye göz atın", not_found: "Masa bulunamadı", retry: "Tekrar dene", sar: "SAR", empty: "Ürün yok", size: "Boyut", addons: "Ekstralar", add_to_cart: "Sepete ekle", cart: "Sepet", send_order: "Gönder", order_sent: "Sipariş gönderildi", view_cart: "Sepeti gör", order_note: "Not (isteğe bağlı)", item_note: "Not (isteğe bağlı)", qty: "Adet", total: "Toplam", offers: "FIRSATLAR", order_status: "Durum", remove: "Kaldır", st_new: "Alındı", st_preparing: "Hazırlanıyor", st_ready: "Hazır", st_completed: "Teslim edildi", st_cancelled: "İptal", close: "Kapat" },
  ur: { unavailable: "دستیاب نہیں", call_waiter: "ویٹر کو بلائیں", waiter_called: "ویٹر کو اطلاع دے دی گئی", orders_off: "آرڈر دستیاب نہیں — مینو دیکھیں", not_found: "میز نہیں ملی", retry: "دوبارہ کوشش", sar: "SAR", empty: "کوئی آئٹم نہیں", size: "سائز", addons: "اضافے", add_to_cart: "کارٹ میں شامل کریں", cart: "کارٹ", send_order: "آرڈر بھیجیں", order_sent: "آرڈر بھیج دیا گیا", view_cart: "کارٹ دیکھیں", order_note: "نوٹ (اختیاری)", item_note: "نوٹ (اختیاری)", qty: "تعداد", total: "کل", offers: "آفرز", order_status: "آرڈر کی حالت", remove: "ہٹائیں", st_new: "موصول", st_preparing: "تیاری میں", st_ready: "تیار", st_completed: "پہنچا دیا", st_cancelled: "منسوخ", close: "بند کریں" },
};

const LANG_LABEL: Record<string, string> = { ar: "ع", en: "EN", fr: "FR", tr: "TR", ur: "اردو" };
const RTL_LANGS = ["ar", "ur"];

function pickL(map: Record<string, string> | undefined, lang: string): string {
  if (!map) return "";
  return map[lang] || map["ar"] || map["en"] || Object.values(map)[0] || "";
}

interface Size { name: Record<string, string>; price: number }
interface Addon { name: Record<string, string>; price: number }
interface Item {
  id: string; name: Record<string, string>; description: Record<string, string>;
  price: number; image_url: string | null; available: boolean; sizes?: Size[]; addons?: Addon[];
}
interface MenuData {
  restaurant: { name: string; languages: string[] };
  branch: { name: string; orders_enabled: boolean };
  table: { label: string };
  categories: { id: string; name: Record<string, string>; items: Item[] }[];
  offers: { id: string; title: Record<string, string>; description: Record<string, string> }[];
}
interface CartLine {
  key: string; item: Item; size: Size | null; addons: Addon[]; qty: number; note: string; unit: number;
}

function CustomerMenu() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const toast = useToast();
  const [data, setData] = useState<MenuData | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [lang, setLang] = useState("ar");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [sending, setSending] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ id: string; status: string } | null>(null);

  // customization state
  const [cust, setCust] = useState<{ item: Item; sizeIdx: number; addons: Set<number>; qty: number; note: string } | null>(null);

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

  useEffect(() => { load(); }, [load]);

  // poll last order status
  useEffect(() => {
    if (!lastOrder) return;
    const id = setInterval(async () => {
      try {
        const s = await apiPublic(`/public/order-status/${lastOrder.id}`);
        setLastOrder((prev) => (prev ? { ...prev, status: s.status } : prev));
        if (s.status === "completed" || s.status === "cancelled") clearInterval(id);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(id);
  }, [lastOrder?.id]);

  const s = (k: string) => (STR[lang] || STR.ar)[k];
  const isRTL = RTL_LANGS.includes(lang);
  const dir = isRTL ? "rtl" : "ltr";
  const ta: "right" | "left" = isRTL ? "right" : "left";
  const canOrder = !!data?.branch.orders_enabled;

  const cartCount = cart.reduce((n, l) => n + l.qty, 0);
  const cartTotal = cart.reduce((n, l) => n + l.unit * l.qty, 0);

  const custUnit = useMemo(() => {
    if (!cust) return 0;
    const size = cust.item.sizes?.[cust.sizeIdx];
    const addonsSum = Array.from(cust.addons).reduce((n, i) => n + (cust.item.addons?.[i]?.price || 0), 0);
    return cust.item.price + (size?.price || 0) + addonsSum;
  }, [cust]);

  const openCustomize = (item: Item) => {
    if (!canOrder || !item.available) return;
    Haptics.selectionAsync();
    setCust({ item, sizeIdx: 0, addons: new Set(), qty: 1, note: "" });
  };

  const addToCart = () => {
    if (!cust) return;
    const size = cust.item.sizes?.[cust.sizeIdx] || null;
    const addons = Array.from(cust.addons).map((i) => cust.item.addons![i]);
    const line: CartLine = {
      key: `${cust.item.id}-${Date.now()}`,
      item: cust.item, size, addons, qty: cust.qty, note: cust.note, unit: custUnit,
    };
    setCart((p) => [...p, line]);
    setCust(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeLine = (key: string) => setCart((p) => p.filter((l) => l.key !== key));

  const sendOrder = async () => {
    if (cart.length === 0) return;
    setSending(true);
    try {
      const payload = {
        items: cart.map((l) => ({
          item_id: l.item.id,
          name: l.item.name,
          unit_price: l.unit,
          qty: l.qty,
          size: l.size ? { name: l.size.name, price: l.size.price } : null,
          addons: l.addons.map((a) => ({ name: a.name, price: a.price })),
          note: l.note,
        })),
        note: orderNote,
      };
      const res = await apiPublicPost(`/public/order/${token}`, payload);
      setCart([]);
      setOrderNote("");
      setCartOpen(false);
      setLastOrder({ id: res.id, status: res.status });
      toast(s("order_sent"), "success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      toast(e.message || "error", "error");
      load();
    } finally {
      setSending(false);
    }
  };

  const callWaiter = async () => {
    try {
      await apiPublicPost(`/public/waiter-call/${token}`);
      toast(s("waiter_called"), "success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      toast(e.message || "error", "error");
    }
  };

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
        <Text style={styles.errTxt}>{STR.ar.not_found}</Text>
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
          <Text style={[styles.rName, { textAlign: ta, writingDirection: dir }]} numberOfLines={1}>{data.restaurant.name}</Text>
          <Text style={[styles.branch, { textAlign: ta, writingDirection: dir }]} numberOfLines={1}>
            {data.branch.name} · {data.table.label}
          </Text>
        </View>
        <View style={styles.langRow}>
          {(data.restaurant.languages || ["ar"]).map((lc) => {
            const active = lc === lang;
            return (
              <Pressable key={lc} testID={`lang-${lc}`} onPress={() => setLang(lc)} style={[styles.langChip, { backgroundColor: active ? colors.brand : colors.surface }]}>
                <Text style={[styles.langTxt, { color: active ? colors.onBrand : colors.onSurface }]}>{LANG_LABEL[lc] || lc}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Order status pill */}
      {lastOrder ? (
        <View style={styles.statusBar} testID="order-status-bar">
          <Ionicons name="time" size={16} color={colors.onSurfaceInverse} />
          <Text style={styles.statusTxt}>{s("order_status")}: {s(`st_${lastOrder.status}`)}</Text>
        </View>
      ) : null}

      {!canOrder ? (
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={16} color={colors.onWarning} />
          <Text style={[styles.noticeTxt, { textAlign: ta }]}>{s("orders_off")}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: cartCount > 0 ? 150 : 90 }}>
        {/* Offers banner */}
        {data.offers?.length ? (
          <View style={styles.offerBox} testID="offers-banner">
            <View style={styles.offerTag}>
              <Ionicons name="pricetag" size={14} color={colors.onBrand} />
              <Text style={styles.offerTagTxt}>{s("offers")}</Text>
            </View>
            {data.offers.map((o) => (
              <View key={o.id} style={{ marginTop: spacing.xs }}>
                <Text style={[styles.offerTitle, { textAlign: ta, writingDirection: dir }]}>{pickL(o.title, lang)}</Text>
                {pickL(o.description, lang) ? (
                  <Text style={[styles.offerDesc, { textAlign: ta, writingDirection: dir }]}>{pickL(o.description, lang)}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {data.categories.length === 0 ? (
          <View style={styles.center}><Text style={styles.errTxt}>{s("empty")}</Text></View>
        ) : (
          data.categories.map((cat) => (
            <View key={cat.id}>
              <Text style={[styles.catTitle, { textAlign: ta, writingDirection: dir }]}>{pickL(cat.name, lang)}</Text>
              {cat.items.map((item) => (
                <Pressable
                  key={item.id}
                  testID={`menu-item-${item.id}`}
                  onPress={() => openCustomize(item)}
                  style={styles.itemRow}
                >
                  {item.image_url ? (
                    <Image source={{ uri: fileUrl(item.image_url) }} style={styles.thumb} contentFit="cover" transition={120} recyclingKey={item.id} />
                  ) : null}
                  <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
                    <Text style={[styles.itemName, { textAlign: ta, writingDirection: dir, color: item.available ? colors.onSurface : colors.muted }]}>{pickL(item.name, lang)}</Text>
                    {pickL(item.description, lang) ? (
                      <Text style={[styles.itemDesc, { textAlign: ta, writingDirection: dir }]} numberOfLines={2}>{pickL(item.description, lang)}</Text>
                    ) : null}
                    {!item.available ? <Text style={[styles.unavail, { textAlign: ta }]}>{s("unavailable")}</Text> : null}
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={styles.price}>{item.price} {s("sar")}</Text>
                    {canOrder && item.available ? <Ionicons name="add-circle" size={26} color={colors.brand} style={{ marginTop: 4 }} /> : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Bottom bar: cart + waiter */}
      <View style={styles.bottomBar}>
        <Pressable testID="call-waiter-btn" onPress={callWaiter} style={styles.waiterBtn}>
          <Ionicons name="notifications" size={22} color={colors.onSurface} />
        </Pressable>
        {canOrder && cartCount > 0 ? (
          <Pressable testID="view-cart-btn" onPress={() => setCartOpen(true)} style={styles.cartBar}>
            <View style={styles.cartBadge}><Text style={styles.cartBadgeTxt}>{cartCount}</Text></View>
            <Text style={styles.cartBarTxt}>{s("view_cart")}</Text>
            <Text style={styles.cartBarTotal}>{cartTotal} {s("sar")}</Text>
          </Pressable>
        ) : (
          <View style={[styles.cartBar, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
            <Text style={[styles.cartBarTxt, { color: colors.muted }]}>{s("call_waiter")}</Text>
          </View>
        )}
      </View>

      {/* Customize sheet */}
      <Modal visible={!!cust} transparent animationType="slide" onRequestClose={() => setCust(null)}>
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHead}>
                <Text style={[styles.rName, { textAlign: ta }]}>{cust ? pickL(cust.item.name, lang) : ""}</Text>
                <Pressable testID="close-customize" onPress={() => setCust(null)} hitSlop={10}>
                  <Ionicons name="close" size={26} color={colors.onSurface} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
                {cust && cust.item.sizes && cust.item.sizes.length > 0 ? (
                  <View style={{ marginBottom: spacing.md }}>
                    <Text style={styles.sectLabel}>{s("size")}</Text>
                    {cust.item.sizes.map((sz, i) => (
                      <Pressable key={i} testID={`size-${i}`} onPress={() => setCust({ ...cust, sizeIdx: i })} style={styles.optRow}>
                        <Ionicons name={cust.sizeIdx === i ? "radio-button-on" : "radio-button-off"} size={20} color={cust.sizeIdx === i ? colors.brand : colors.muted} />
                        <Text style={[styles.optTxt, { textAlign: ta }]}>{pickL(sz.name, lang)}</Text>
                        <Text style={styles.optPrice}>{sz.price ? `+${sz.price}` : ""}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {cust && cust.item.addons && cust.item.addons.length > 0 ? (
                  <View style={{ marginBottom: spacing.md }}>
                    <Text style={styles.sectLabel}>{s("addons")}</Text>
                    {cust.item.addons.map((ad, i) => {
                      const on = cust.addons.has(i);
                      return (
                        <Pressable
                          key={i}
                          testID={`addon-${i}`}
                          onPress={() => {
                            const next = new Set(cust.addons);
                            on ? next.delete(i) : next.add(i);
                            setCust({ ...cust, addons: next });
                          }}
                          style={styles.optRow}
                        >
                          <Ionicons name={on ? "checkbox" : "square-outline"} size={20} color={on ? colors.brand : colors.muted} />
                          <Text style={[styles.optTxt, { textAlign: ta }]}>{pickL(ad.name, lang)}</Text>
                          <Text style={styles.optPrice}>{ad.price ? `+${ad.price}` : ""}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                {/* qty */}
                <View style={styles.qtyRow}>
                  <Text style={styles.sectLabel}>{s("qty")}</Text>
                  <View style={styles.qtyCtrl}>
                    <Pressable testID="qty-minus" onPress={() => cust && setCust({ ...cust, qty: Math.max(1, cust.qty - 1) })} style={styles.qtyBtn}>
                      <Ionicons name="remove" size={20} color={colors.onSurface} />
                    </Pressable>
                    <Text style={styles.qtyNum}>{cust?.qty}</Text>
                    <Pressable testID="qty-plus" onPress={() => cust && setCust({ ...cust, qty: cust.qty + 1 })} style={styles.qtyBtn}>
                      <Ionicons name="add" size={20} color={colors.onSurface} />
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
              <Pressable testID="add-to-cart-btn" onPress={addToCart} style={styles.addBtn}>
                <Text style={styles.addBtnTxt}>{s("add_to_cart")} · {custUnit * (cust?.qty || 1)} {s("sar")}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Cart sheet */}
      <Modal visible={cartOpen} transparent animationType="slide" onRequestClose={() => setCartOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.rName}>{s("cart")}</Text>
              <Pressable testID="close-cart" onPress={() => setCartOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={26} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 340 }}>
              {cart.map((l) => (
                <View key={l.key} style={styles.cartLine} testID={`cart-line-${l.key}`}>
                  <Text style={styles.qtyNumSm}>{l.qty}×</Text>
                  <View style={{ flex: 1, paddingHorizontal: spacing.sm }}>
                    <Text style={[styles.itemName, { textAlign: ta, fontSize: fontSize.base }]}>
                      {pickL(l.item.name, lang)}{l.size ? ` · ${pickL(l.size.name, lang)}` : ""}
                    </Text>
                    {l.addons.length ? (
                      <Text style={[styles.itemDesc, { textAlign: ta }]}>+ {l.addons.map((a) => pickL(a.name, lang)).join(", ")}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.linePrice}>{l.unit * l.qty}</Text>
                  <Pressable testID={`remove-line-${l.key}`} onPress={() => removeLine(l.key)} hitSlop={8} style={{ marginStart: spacing.sm }}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <View style={styles.cartTotalRow}>
              <Text style={styles.rName}>{s("total")}</Text>
              <Text style={[styles.rName, { color: colors.brand }]}>{cartTotal} {s("sar")}</Text>
            </View>
            <Pressable testID="send-order-btn" onPress={sendOrder} style={[styles.addBtn, { opacity: sending ? 0.6 : 1 }]} disabled={sending}>
              {sending ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.addBtnTxt}>{s("send_order")}</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: colors.borderStrong, gap: spacing.sm },
  rName: { fontFamily: ff.bold, fontSize: fontSize.xl, color: colors.onSurface },
  branch: { fontFamily: ff.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  langRow: { flexDirection: "row", gap: 4 },
  langChip: { minWidth: 34, height: 30, paddingHorizontal: 6, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  langTxt: { fontFamily: ff.bold, fontSize: fontSize.sm },
  statusBar: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceInverse, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  statusTxt: { fontFamily: ff.semibold, fontSize: fontSize.sm, color: colors.onSurfaceInverse },
  notice: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.warning, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  noticeTxt: { flex: 1, fontFamily: ff.semibold, fontSize: fontSize.sm, color: colors.onWarning },
  offerBox: { margin: spacing.lg, marginBottom: 0, borderWidth: 2, borderColor: colors.brand, backgroundColor: colors.brandTertiary, padding: spacing.md },
  offerTag: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: colors.brand, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  offerTagTxt: { fontFamily: ff.bold, fontSize: fontSize.sm, color: colors.onBrand },
  offerTitle: { fontFamily: ff.bold, fontSize: fontSize.lg, color: colors.brandSecondary },
  offerDesc: { fontFamily: ff.regular, fontSize: fontSize.sm, color: colors.onBrandTertiary },
  catTitle: { fontFamily: ff.bold, fontSize: fontSize.lg, color: colors.onBrand, backgroundColor: colors.surfaceInverse, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.lg },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  thumb: { width: 64, height: 64, borderWidth: 1, borderColor: colors.border },
  itemName: { fontFamily: ff.semibold, fontSize: fontSize.lg, color: colors.onSurface },
  itemDesc: { fontFamily: ff.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  unavail: { fontFamily: ff.bold, fontSize: fontSize.sm, color: colors.error, marginTop: 2 },
  price: { fontFamily: ff.mono, fontSize: fontSize.base, color: colors.brand, fontWeight: "700" },
  bottomBar: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, flexDirection: "row", gap: spacing.sm },
  waiterBtn: { width: 54, height: 54, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  cartBar: { flex: 1, height: 54, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, gap: spacing.sm },
  cartBadge: { minWidth: 26, height: 26, backgroundColor: colors.onBrand, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  cartBadgeTxt: { fontFamily: ff.bold, color: colors.brand, fontSize: fontSize.base },
  cartBarTxt: { fontFamily: ff.bold, fontSize: fontSize.lg, color: colors.onBrand, flex: 1 },
  cartBarTotal: { fontFamily: ff.mono, fontSize: fontSize.lg, color: colors.onBrand, fontWeight: "700" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopWidth: 3, borderColor: colors.borderStrong, padding: spacing.lg },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  sectLabel: { fontFamily: ff.bold, fontSize: fontSize.sm, color: colors.muted, marginBottom: spacing.sm, letterSpacing: 1 },
  optRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: spacing.sm },
  optTxt: { flex: 1, fontFamily: ff.semibold, fontSize: fontSize.base, color: colors.onSurface },
  optPrice: { fontFamily: ff.mono, fontSize: fontSize.base, color: colors.brand },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md },
  qtyCtrl: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: colors.border },
  qtyBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  qtyNum: { width: 44, textAlign: "center", fontFamily: ff.bold, fontSize: fontSize.lg },
  qtyNumSm: { fontFamily: ff.bold, fontSize: fontSize.base, color: colors.onSurface },
  addBtn: { height: 54, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  addBtnTxt: { fontFamily: ff.bold, fontSize: fontSize.lg, color: colors.onBrand },
  cartLine: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  linePrice: { fontFamily: ff.mono, fontSize: fontSize.base, color: colors.onSurface },
  cartTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md, borderTopWidth: 2, borderTopColor: colors.border, marginTop: spacing.sm },
  errTxt: { fontFamily: ff.semibold, fontSize: fontSize.base, color: colors.muted, marginVertical: spacing.md, textAlign: "center" },
  retryBtn: { borderWidth: 2, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryTxt: { fontFamily: ff.bold, color: colors.onSurface },
});
