import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { apiGet, apiPost, apiDelete } from "@/src/api";
import {
  Txt,
  Header,
  Card,
  PrimaryButton,
  OutlineButton,
  Field,
  Loading,
  ErrorState,
  EmptyState,
  useToast,
  Screen,
  ScrollView,
} from "@/src/ui";
import { colors, spacing, fontSize } from "@/src/theme";

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  table_count: number;
  orders_enabled: boolean;
}

export default function Branches() {
  const { isAdmin } = useAuth();
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setBranches(await apiGet("/branches"));
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

  const create = async () => {
    if (!name.trim()) {
      toast(t("required"), "error");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/branches", { name: name.trim(), address: address.trim(), phone: phone.trim() });
      setModal(false);
      setName("");
      setAddress("");
      setPhone("");
      toast(t("save"), "success");
      load();
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: Branch) => {
    try {
      await apiDelete(`/branches/${b.id}`);
      toast(t("delete"), "success");
      load();
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    }
  };

  const renderItem = ({ item }: { item: Branch }) => (
    <Pressable
      testID={`branch-card-${item.id}`}
      onPress={() => router.push(`/branch/${item.id}`)}
      style={({ pressed }) => [styles.branchCard, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.iconBox}>
        <Ionicons name="business" size={22} color={colors.onBrand} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
        <Txt weight="bold" size={fontSize.lg} numberOfLines={1}>
          {item.name}
        </Txt>
        {item.address ? (
          <Txt size={fontSize.sm} color={colors.muted} numberOfLines={1}>
            {item.address}
          </Txt>
        ) : null}
        <Txt size={fontSize.sm} color={colors.brand} weight="semibold" style={{ marginTop: 2 }}>
          {item.table_count} {t("table_count")}
        </Txt>
      </View>
      {isAdmin ? (
        <Pressable testID={`delete-branch-${item.id}`} onPress={() => remove(item)} hitSlop={10} style={styles.trash}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      ) : null}
      <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={22} color={colors.muted} />
    </Pressable>
  );

  return (
    <Screen>
      <Header
        title={t("branches")}
        right={
          isAdmin ? (
            <Pressable testID="add-branch-header" onPress={() => setModal(true)} hitSlop={10}>
              <Ionicons name="add-circle" size={30} color={colors.brand} />
            </Pressable>
          ) : null
        }
      />
      {status === "loading" ? (
        <Loading />
      ) : status === "error" ? (
        <ErrorState text={t("error_generic")} onRetry={load} />
      ) : branches.length === 0 ? (
        <View style={{ flex: 1 }}>
          <EmptyState text={t("no_branches")} icon="business-outline" />
          {isAdmin ? (
            <View style={{ padding: spacing.lg }}>
              <PrimaryButton testID="add-first-branch" title={t("add_branch")} onPress={() => setModal(true)} icon="add" />
            </View>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={branches}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
        />
      )}

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHead}>
                <Txt weight="bold" size={fontSize.xl}>
                  {t("add_branch")}
                </Txt>
                <Pressable testID="close-branch-modal" onPress={() => setModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={26} color={colors.onSurface} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Field testID="branch-name-input" label={t("branch_name")} value={name} onChangeText={setName} />
                <Field testID="branch-address-input" label={t("address")} value={address} onChangeText={setAddress} />
                <Field
                  testID="branch-phone-input"
                  label={t("phone")}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <OutlineButton title={t("cancel")} onPress={() => setModal(false)} testID="cancel-branch" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title={t("save")} onPress={create} loading={saving} testID="save-branch-button" />
                  </View>
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
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  iconBox: {
    width: 44,
    height: 44,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  trash: { padding: 6, marginHorizontal: 4 },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopWidth: 3,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
    maxHeight: "85%",
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
});
