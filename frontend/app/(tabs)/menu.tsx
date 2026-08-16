import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { useI18n, pick } from "@/src/i18n";
import { apiGet, apiPost, apiPatch, apiDelete, uploadImage, fileUrl } from "@/src/api";
import {
  Txt,
  Header,
  PrimaryButton,
  OutlineButton,
  Field,
  Switch,
  Loading,
  EmptyState,
  useToast,
  Screen,
  ScrollView,
} from "@/src/ui";
import { colors, spacing, fontSize, ff } from "@/src/theme";

interface Branch {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name: Record<string, string>;
  visible: boolean;
}
interface Item {
  id: string;
  category_id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  price: number;
  image_url: string | null;
  visible: boolean;
  available: boolean;
}

export default function Menu() {
  const { restaurant, isAdmin } = useAuth();
  const { t, lang } = useI18n();
  const toast = useToast();
  const menuLangs = restaurant?.languages?.length ? restaurant.languages : ["ar"];
  const primaryLang = menuLangs[0];

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const [catModal, setCatModal] = useState(false);
  const [catName, setCatName] = useState<Record<string, string>>({});
  const [savingCat, setSavingCat] = useState(false);

  const [itemModal, setItemModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [iName, setIName] = useState<Record<string, string>>({});
  const [iDesc, setIDesc] = useState<Record<string, string>>({});
  const [iPrice, setIPrice] = useState("");
  const [iImage, setIImage] = useState<string | null>(null);
  const [iCat, setICat] = useState<string | null>(null);
  const [iVisible, setIVisible] = useState(true);
  const [iAvailable, setIAvailable] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [iSizes, setISizes] = useState<{ name: string; price: string }[]>([]);
  const [iAddons, setIAddons] = useState<{ name: string; price: string }[]>([]);

  // offers
  const [offersModal, setOffersModal] = useState(false);
  const [offers, setOffers] = useState<{ id: string; title: Record<string, string>; description: Record<string, string>; active: boolean }[]>([]);
  const [oTitle, setOTitle] = useState("");
  const [oDesc, setODesc] = useState("");
  const [savingOffer, setSavingOffer] = useState(false);

  const loadBranches = useCallback(async () => {
    try {
      const b = await apiGet("/branches");
      setBranches(b);
      setBranchId((prev) => prev || (b[0]?.id ?? null));
      if (b.length === 0) setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  const loadMenu = useCallback(async (bid: string) => {
    setStatus("loading");
    try {
      const [c, i] = await Promise.all([apiGet(`/branches/${bid}/categories`), apiGet(`/branches/${bid}/items`)]);
      setCategories(c);
      setItems(i);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBranches();
    }, [loadBranches])
  );

  useFocusEffect(
    useCallback(() => {
      if (branchId) loadMenu(branchId);
    }, [branchId, loadMenu])
  );

  // ----- category -----
  const createCategory = async () => {
    const hasName = Object.values(catName).some((v) => v?.trim());
    if (!hasName || !branchId) {
      toast(t("required"), "error");
      return;
    }
    setSavingCat(true);
    try {
      await apiPost("/categories", { branch_id: branchId, name: catName, sort_order: categories.length });
      setCatModal(false);
      setCatName({});
      toast(t("save"), "success");
      loadMenu(branchId);
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    } finally {
      setSavingCat(false);
    }
  };

  const toggleCategoryVisible = async (c: Category) => {
    try {
      await apiPatch(`/categories/${c.id}`, { visible: !c.visible });
      loadMenu(branchId!);
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await apiDelete(`/categories/${id}`);
      toast(t("delete"), "success");
      loadMenu(branchId!);
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    }
  };

  // ----- item -----
  const openNewItem = (categoryId: string) => {
    setEditing(null);
    setIName({});
    setIDesc({});
    setIPrice("");
    setIImage(null);
    setICat(categoryId);
    setIVisible(true);
    setIAvailable(true);
    setISizes([]);
    setIAddons([]);
    setItemModal(true);
  };

  const openEditItem = (item: Item) => {
    setEditing(item);
    setIName(item.name || {});
    setIDesc(item.description || {});
    setIPrice(String(item.price));
    setIImage(item.image_url);
    setICat(item.category_id);
    setIVisible(item.visible);
    setIAvailable(item.available);
    setISizes(((item as any).sizes || []).map((s: any) => ({ name: pick(s.name, primaryLang), price: String(s.price ?? "") })));
    setIAddons(((item as any).addons || []).map((a: any) => ({ name: pick(a.name, primaryLang), price: String(a.price ?? "") })));
    setItemModal(true);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast(t("error_generic"), "error");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const name = asset.fileName || `menu-${Date.now()}.jpg`;
      const type = asset.mimeType || "image/jpeg";
      const url = await uploadImage(asset.uri, name, type);
      setIImage(url);
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    } finally {
      setUploading(false);
    }
  };

  const saveItem = async () => {
    const hasName = Object.values(iName).some((v) => v?.trim());
    const priceNum = parseFloat(iPrice);
    if (!hasName || isNaN(priceNum) || !iCat) {
      toast(t("required"), "error");
      return;
    }
    setSavingItem(true);
    const toDict = (arr: { name: string; price: string }[]) =>
      arr
        .filter((x) => x.name.trim())
        .map((x) => ({ name: { [primaryLang]: x.name.trim() }, price: parseFloat(x.price) || 0 }));
    const sizesPayload = toDict(iSizes);
    const addonsPayload = toDict(iAddons);
    try {
      if (editing) {
        await apiPatch(`/items/${editing.id}`, {
          name: iName,
          description: iDesc,
          price: priceNum,
          image_url: iImage,
          category_id: iCat,
          sizes: sizesPayload,
          addons: addonsPayload,
        });
        if (iVisible !== editing.visible) await apiPatch(`/items/${editing.id}/visibility`, { value: iVisible });
        if (iAvailable !== editing.available) await apiPatch(`/items/${editing.id}/availability`, { value: iAvailable });
      } else {
        await apiPost("/items", {
          branch_id: branchId,
          category_id: iCat,
          name: iName,
          description: iDesc,
          price: priceNum,
          image_url: iImage,
          visible: iVisible,
          available: iAvailable,
          sizes: sizesPayload,
          addons: addonsPayload,
        });
      }
      setItemModal(false);
      toast(t("save"), "success");
      loadMenu(branchId!);
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    } finally {
      setSavingItem(false);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await apiDelete(`/items/${id}`);
      toast(t("delete"), "success");
      loadMenu(branchId!);
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    }
  };

  const toggleAvailability = async (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiPatch(`/items/${item.id}/availability`, { value: !item.available });
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, available: !x.available } : x)));
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    }
  };

  // ----- offers -----
  const openOffers = async () => {
    setOffersModal(true);
    if (!branchId) return;
    try {
      setOffers(await apiGet(`/branches/${branchId}/offers`));
    } catch {
      /* ignore */
    }
  };

  const createOffer = async () => {
    if (!oTitle.trim() || !branchId) {
      toast(t("required"), "error");
      return;
    }
    setSavingOffer(true);
    try {
      await apiPost("/offers", {
        branch_id: branchId,
        title: { [primaryLang]: oTitle.trim() },
        description: oDesc.trim() ? { [primaryLang]: oDesc.trim() } : {},
      });
      setOTitle("");
      setODesc("");
      toast(t("save"), "success");
      setOffers(await apiGet(`/branches/${branchId}/offers`));
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    } finally {
      setSavingOffer(false);
    }
  };

  const toggleOffer = async (id: string, active: boolean) => {
    try {
      await apiPatch(`/offers/${id}`, { active: !active });
      setOffers(await apiGet(`/branches/${branchId}/offers`));
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    }
  };

  const deleteOffer = async (id: string) => {
    try {
      await apiDelete(`/offers/${id}`);
      setOffers(await apiGet(`/branches/${branchId}/offers`));
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    }
  };

  return (
    <Screen>
      <Header
        title={t("menu")}
        right={
          isAdmin && branchId ? (
            <Pressable testID="open-offers-btn" onPress={openOffers} hitSlop={10}>
              <Ionicons name="pricetag" size={26} color={colors.brand} />
            </Pressable>
          ) : null
        }
      />

      {/* Branch chip row (sticky header chrome) */}
      {branches.length > 0 ? (
        <View style={styles.chipRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}
          >
            {branches.map((b) => {
              const active = b.id === branchId;
              return (
                <Pressable
                  key={b.id}
                  testID={`branch-chip-${b.id}`}
                  onPress={() => setBranchId(b.id)}
                  style={[styles.chip, { backgroundColor: active ? colors.brand : colors.surface, borderColor: active ? colors.brand : colors.border }]}
                >
                  <Txt weight="bold" size={fontSize.sm} color={active ? colors.onBrand : colors.onSurface}>
                    {b.name}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {status === "loading" ? (
        <Loading />
      ) : branches.length === 0 ? (
        <EmptyState text={t("no_branches")} icon="business-outline" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }}>
          {isAdmin ? (
            <OutlineButton title={t("add_category")} icon="add" onPress={() => setCatModal(true)} testID="add-category-btn" />
          ) : null}

          {categories.length === 0 ? (
            <EmptyState text={t("no_menu")} icon="restaurant-outline" />
          ) : (
            categories.map((cat) => {
              const catItems = items.filter((i) => i.category_id === cat.id);
              return (
                <View key={cat.id}>
                  <View style={styles.catHead}>
                    <Txt weight="bold" size={fontSize.lg} style={{ flex: 1 }} color={cat.visible ? colors.onSurface : colors.muted}>
                      {pick(cat.name, lang) || "—"}
                    </Txt>
                    {isAdmin ? (
                      <>
                        <Pressable testID={`toggle-cat-${cat.id}`} onPress={() => toggleCategoryVisible(cat)} hitSlop={8} style={styles.catAction}>
                          <Ionicons name={cat.visible ? "eye" : "eye-off"} size={20} color={cat.visible ? colors.onSurface : colors.muted} />
                        </Pressable>
                        <Pressable testID={`delete-cat-${cat.id}`} onPress={() => deleteCategory(cat.id)} hitSlop={8} style={styles.catAction}>
                          <Ionicons name="trash-outline" size={20} color={colors.error} />
                        </Pressable>
                      </>
                    ) : null}
                  </View>

                  {catItems.map((item) => (
                    <View key={item.id} style={styles.itemRow} testID={`item-row-${item.id}`}>
                      {item.image_url ? (
                        <Image source={{ uri: fileUrl(item.image_url) }} style={styles.thumb} contentFit="cover" transition={150} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                          <Ionicons name="fast-food-outline" size={22} color={colors.muted} />
                        </View>
                      )}
                      <Pressable style={{ flex: 1, paddingHorizontal: spacing.md }} onPress={() => isAdmin && openEditItem(item)}>
                        <Txt weight="semibold" numberOfLines={1} color={item.available ? colors.onSurface : colors.muted}>
                          {pick(item.name, lang) || "—"}
                        </Txt>
                        <Txt weight="bold" size={fontSize.sm} color={colors.brand} style={{ fontFamily: ff.mono, marginTop: 2 }}>
                          {item.price} {t("sar")}
                        </Txt>
                        {!item.available ? (
                          <Txt size={fontSize.sm} color={colors.error} weight="bold">
                            {t("unavailable")}
                          </Txt>
                        ) : null}
                      </Pressable>
                      {isAdmin ? (
                        <Switch testID={`avail-toggle-${item.id}`} value={item.available} onValueChange={() => toggleAvailability(item)} />
                      ) : null}
                      {isAdmin ? (
                        <Pressable testID={`delete-item-${item.id}`} onPress={() => deleteItem(item.id)} hitSlop={8} style={{ marginStart: spacing.sm }}>
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}

                  {isAdmin ? (
                    <Pressable testID={`add-item-${cat.id}`} onPress={() => openNewItem(cat.id)} style={styles.addItemRow}>
                      <Ionicons name="add" size={18} color={colors.brand} />
                      <Txt weight="semibold" color={colors.brand} style={{ marginStart: 4 }}>
                        {t("add_item")}
                      </Txt>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Category modal */}
      <Modal visible={catModal} animationType="slide" transparent onRequestClose={() => setCatModal(false)}>
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHead}>
                <Txt weight="bold" size={fontSize.xl}>
                  {t("add_category")}
                </Txt>
                <Pressable testID="close-cat-modal" onPress={() => setCatModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={26} color={colors.onSurface} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                {menuLangs.map((lc) => (
                  <Field
                    key={lc}
                    testID={`cat-name-${lc}`}
                    label={`${t("category_name")} (${lc.toUpperCase()})`}
                    value={catName[lc] || ""}
                    onChangeText={(v) => setCatName((p) => ({ ...p, [lc]: v }))}
                  />
                ))}
                <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <OutlineButton title={t("cancel")} onPress={() => setCatModal(false)} testID="cancel-cat" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title={t("save")} onPress={createCategory} loading={savingCat} testID="save-cat-button" />
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Item modal */}
      <Modal visible={itemModal} animationType="slide" transparent onRequestClose={() => setItemModal(false)}>
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.sheet, { maxHeight: "90%" }]}>
              <View style={styles.sheetHead}>
                <Txt weight="bold" size={fontSize.xl}>
                  {editing ? t("edit") : t("add_item")}
                </Txt>
                <Pressable testID="close-item-modal" onPress={() => setItemModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={26} color={colors.onSurface} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                {/* Image */}
                <Pressable testID="pick-image-btn" onPress={pickImage} style={styles.imagePicker}>
                  {uploading ? (
                    <ActivityIndicator color={colors.brand} />
                  ) : iImage ? (
                    <Image source={{ uri: fileUrl(iImage) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <View style={{ alignItems: "center" }}>
                      <Ionicons name="camera-outline" size={28} color={colors.muted} />
                      <Txt size={fontSize.sm} color={colors.muted}>
                        {t("pick_image")}
                      </Txt>
                    </View>
                  )}
                </Pressable>

                {menuLangs.map((lc) => (
                  <Field
                    key={`n-${lc}`}
                    testID={`item-name-${lc}`}
                    label={`${t("item_name")} (${lc.toUpperCase()})`}
                    value={iName[lc] || ""}
                    onChangeText={(v) => setIName((p) => ({ ...p, [lc]: v }))}
                  />
                ))}
                {menuLangs.map((lc) => (
                  <Field
                    key={`d-${lc}`}
                    testID={`item-desc-${lc}`}
                    label={`${t("item_desc")} (${lc.toUpperCase()})`}
                    value={iDesc[lc] || ""}
                    onChangeText={(v) => setIDesc((p) => ({ ...p, [lc]: v }))}
                    multiline
                  />
                ))}
                <Field testID="item-price-input" label={t("price")} value={iPrice} onChangeText={setIPrice} keyboardType="decimal-pad" />

                {/* Sizes editor */}
                <View style={{ marginBottom: spacing.md }}>
                  <View style={styles.editorHead}>
                    <Txt weight="semibold" size={fontSize.sm} color={colors.onSurfaceSecondary}>
                      {t("sizes")}
                    </Txt>
                    <Pressable testID="add-size-row" onPress={() => setISizes((p) => [...p, { name: "", price: "" }])} hitSlop={8}>
                      <Ionicons name="add-circle" size={22} color={colors.brand} />
                    </Pressable>
                  </View>
                  {iSizes.map((sz, idx) => (
                    <View key={idx} style={styles.optEditorRow}>
                      <View style={{ flex: 2 }}>
                        <Field testID={`size-name-${idx}`} value={sz.name} onChangeText={(v) => setISizes((p) => p.map((x, i) => (i === idx ? { ...x, name: v } : x)))} placeholder={t("size")} />
                      </View>
                      <View style={{ flex: 1, marginStart: spacing.sm }}>
                        <Field testID={`size-price-${idx}`} value={sz.price} onChangeText={(v) => setISizes((p) => p.map((x, i) => (i === idx ? { ...x, price: v } : x)))} placeholder="+0" keyboardType="decimal-pad" />
                      </View>
                      <Pressable testID={`remove-size-${idx}`} onPress={() => setISizes((p) => p.filter((_, i) => i !== idx))} style={styles.rowTrash} hitSlop={8}>
                        <Ionicons name="close-circle" size={22} color={colors.error} />
                      </Pressable>
                    </View>
                  ))}
                </View>

                {/* Addons editor */}
                <View style={{ marginBottom: spacing.md }}>
                  <View style={styles.editorHead}>
                    <Txt weight="semibold" size={fontSize.sm} color={colors.onSurfaceSecondary}>
                      {t("addons")}
                    </Txt>
                    <Pressable testID="add-addon-row" onPress={() => setIAddons((p) => [...p, { name: "", price: "" }])} hitSlop={8}>
                      <Ionicons name="add-circle" size={22} color={colors.brand} />
                    </Pressable>
                  </View>
                  {iAddons.map((ad, idx) => (
                    <View key={idx} style={styles.optEditorRow}>
                      <View style={{ flex: 2 }}>
                        <Field testID={`addon-name-${idx}`} value={ad.name} onChangeText={(v) => setIAddons((p) => p.map((x, i) => (i === idx ? { ...x, name: v } : x)))} placeholder={t("addons")} />
                      </View>
                      <View style={{ flex: 1, marginStart: spacing.sm }}>
                        <Field testID={`addon-price-${idx}`} value={ad.price} onChangeText={(v) => setIAddons((p) => p.map((x, i) => (i === idx ? { ...x, price: v } : x)))} placeholder="+0" keyboardType="decimal-pad" />
                      </View>
                      <Pressable testID={`remove-addon-${idx}`} onPress={() => setIAddons((p) => p.filter((_, i) => i !== idx))} style={styles.rowTrash} hitSlop={8}>
                        <Ionicons name="close-circle" size={22} color={colors.error} />
                      </Pressable>
                    </View>
                  ))}
                </View>

                <View style={styles.toggleRow}>
                  <Txt weight="semibold" style={{ flex: 1 }}>
                    {t("available")}
                  </Txt>
                  <Switch testID="item-available-toggle" value={iAvailable} onValueChange={setIAvailable} />
                </View>
                <View style={styles.toggleRow}>
                  <Txt weight="semibold" style={{ flex: 1 }}>
                    {t("visible")}
                  </Txt>
                  <Switch testID="item-visible-toggle" value={iVisible} onValueChange={setIVisible} />
                </View>

                <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <OutlineButton title={t("cancel")} onPress={() => setItemModal(false)} testID="cancel-item" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title={t("save")} onPress={saveItem} loading={savingItem} testID="save-item-button" />
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Offers modal */}
      <Modal visible={offersModal} animationType="slide" transparent onRequestClose={() => setOffersModal(false)}>
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.sheet, { maxHeight: "88%" }]}>
              <View style={styles.sheetHead}>
                <Txt weight="bold" size={fontSize.xl}>
                  {t("offers")}
                </Txt>
                <Pressable testID="close-offers-modal" onPress={() => setOffersModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={26} color={colors.onSurface} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Field testID="offer-title-input" label={t("offer_title")} value={oTitle} onChangeText={setOTitle} />
                <Field testID="offer-desc-input" label={t("offer_desc")} value={oDesc} onChangeText={setODesc} multiline />
                <PrimaryButton title={t("add_offer")} icon="add" onPress={createOffer} loading={savingOffer} testID="save-offer-button" />

                <View style={{ marginTop: spacing.lg }}>
                  {offers.length === 0 ? (
                    <Txt color={colors.muted}>{t("no_offers")}</Txt>
                  ) : (
                    offers.map((o) => (
                      <View key={o.id} style={styles.offerRow} testID={`offer-${o.id}`}>
                        <View style={{ flex: 1 }}>
                          <Txt weight="bold" color={o.active ? colors.onSurface : colors.muted}>
                            {pick(o.title, primaryLang)}
                          </Txt>
                          {pick(o.description, primaryLang) ? (
                            <Txt size={fontSize.sm} color={colors.muted}>
                              {pick(o.description, primaryLang)}
                            </Txt>
                          ) : null}
                        </View>
                        <Switch testID={`offer-toggle-${o.id}`} value={o.active} onValueChange={() => toggleOffer(o.id, o.active)} />
                        <Pressable testID={`delete-offer-${o.id}`} onPress={() => deleteOffer(o.id)} hitSlop={8} style={{ marginStart: spacing.sm }}>
                          <Ionicons name="trash-outline" size={20} color={colors.error} />
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    height: 56,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  chip: {
    height: 36,
    borderWidth: 2,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  catHead: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: -2,
  },
  catAction: { padding: 4, marginStart: spacing.sm },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderTopWidth: 0,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  thumb: { width: 52, height: 52, borderWidth: 1, borderColor: colors.border },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  addItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderStyle: "dashed",
    paddingVertical: spacing.sm,
  },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopWidth: 3, borderColor: colors.borderStrong, padding: spacing.lg },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  imagePicker: {
    height: 140,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },
  editorHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  optEditorRow: { flexDirection: "row", alignItems: "flex-start" },
  rowTrash: { paddingTop: 14, paddingHorizontal: 4 },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
});
