import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { apiGet, apiPost, apiDelete } from "@/src/api";
import {
  Txt,
  Header,
  PrimaryButton,
  OutlineButton,
  Field,
  Loading,
  EmptyState,
  useToast,
  Screen,
} from "@/src/ui";
import { colors, spacing, fontSize, ff } from "@/src/theme";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Table {
  id: string;
  label: string;
  qr_token: string;
}

export default function BranchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [tables, setTables] = useState<Table[]>([]);
  const [branchName, setBranchName] = useState("");
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [qrTable, setQrTable] = useState<Table | null>(null);

  const load = useCallback(async () => {
    try {
      const [branches, t] = await Promise.all([apiGet("/branches"), apiGet(`/branches/${id}/tables`)]);
      const b = branches.find((x: any) => x.id === id);
      setBranchName(b?.name || "");
      setTables(t);
    } catch {
      toast(t as any, "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!label.trim()) {
      toast(t("required"), "error");
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/branches/${id}/tables`, { label: label.trim() });
      setAddModal(false);
      setLabel("");
      toast(t("save"), "success");
      load();
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (tid: string) => {
    try {
      await apiDelete(`/tables/${tid}`);
      toast(t("delete"), "success");
      load();
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    }
  };

  const menuUrl = (token: string) => `${BASE}/m/${token}`;

  const copyLink = async (token: string) => {
    await Clipboard.setStringAsync(menuUrl(token));
    toast(t("copied"), "success");
  };

  const openQr = (table: Table) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setQrTable(table);
  };

  const renderItem = ({ item }: { item: Table }) => (
    <View style={styles.tableCard} testID={`table-card-${item.id}`}>
      <View style={styles.tableHead}>
        <Ionicons name="grid" size={18} color={colors.brand} />
        <Txt weight="bold" size={fontSize.lg} style={{ flex: 1, marginHorizontal: spacing.sm }} numberOfLines={1}>
          {item.label}
        </Txt>
        {isAdmin ? (
          <Pressable testID={`delete-table-${item.id}`} onPress={() => remove(item.id)} hitSlop={10}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        ) : null}
      </View>
      <OutlineButton title={t("view_qr")} icon="qr-code" onPress={() => openQr(item)} testID={`view-qr-${item.id}`} />
    </View>
  );

  return (
    <Screen>
      <Header
        title={branchName || t("tables")}
        subtitle={t("manage_tables")}
        onBack={() => router.back()}
        right={
          isAdmin ? (
            <Pressable testID="add-table-header" onPress={() => setAddModal(true)} hitSlop={10}>
              <Ionicons name="add-circle" size={30} color={colors.brand} />
            </Pressable>
          ) : null
        }
      />
      {loading ? (
        <Loading />
      ) : tables.length === 0 ? (
        <View style={{ flex: 1 }}>
          <EmptyState text={t("no_tables")} icon="grid-outline" />
          {isAdmin ? (
            <View style={{ padding: spacing.lg }}>
              <PrimaryButton testID="add-first-table" title={t("add_table")} onPress={() => setAddModal(true)} icon="add" />
            </View>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={tables}
          keyExtractor={(x) => x.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
        />
      )}

      {/* Add table modal */}
      <Modal visible={addModal} animationType="slide" transparent onRequestClose={() => setAddModal(false)}>
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHead}>
                <Txt weight="bold" size={fontSize.xl}>
                  {t("add_table")}
                </Txt>
                <Pressable testID="close-table-modal" onPress={() => setAddModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={26} color={colors.onSurface} />
                </Pressable>
              </View>
              <Field testID="table-label-input" label={t("table_label")} value={label} onChangeText={setLabel} />
              <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <OutlineButton title={t("cancel")} onPress={() => setAddModal(false)} testID="cancel-table" />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title={t("save")} onPress={create} loading={saving} testID="save-table-button" />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* QR modal */}
      <Modal visible={!!qrTable} animationType="fade" transparent onRequestClose={() => setQrTable(null)}>
        <View style={styles.qrWrap}>
          <View style={styles.qrCard}>
            <View style={styles.sheetHead}>
              <Txt weight="bold" size={fontSize.xl}>
                {t("qr_title")}
              </Txt>
              <Pressable testID="close-qr-modal" onPress={() => setQrTable(null)} hitSlop={10}>
                <Ionicons name="close" size={26} color={colors.onSurface} />
              </Pressable>
            </View>
            <Txt weight="bold" size={fontSize.lg} align="center" style={{ marginVertical: spacing.sm }}>
              {qrTable?.label}
            </Txt>
            <View style={styles.qrBox} testID="qr-image">
              {qrTable ? <QRCode value={menuUrl(qrTable.qr_token)} size={200} /> : null}
            </View>
            <Txt size={fontSize.sm} color={colors.muted} align="center" style={{ marginVertical: spacing.md }}>
              {t("qr_hint")}
            </Txt>
            <Txt size={fontSize.sm} align="center" style={{ fontFamily: ff.mono, marginBottom: spacing.md }} numberOfLines={1}>
              {qrTable ? menuUrl(qrTable.qr_token) : ""}
            </Txt>
            <PrimaryButton
              title={t("copy_link")}
              icon="copy"
              onPress={() => qrTable && copyLink(qrTable.qr_token)}
              testID="copy-qr-link"
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tableCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  tableHead: { flexDirection: "row", alignItems: "center" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopWidth: 3,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  qrWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: spacing.xl },
  qrCard: { backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.borderStrong, padding: spacing.lg },
  qrBox: {
    alignSelf: "center",
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
});
