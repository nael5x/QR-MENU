import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { useI18n, LANG_OPTIONS, MENU_LANGS, Lang } from "@/src/i18n";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/src/api";
import {
  Txt,
  Header,
  Card,
  Divider,
  PrimaryButton,
  OutlineButton,
  Field,
  useToast,
  Screen,
  ScrollView,
} from "@/src/ui";
import { colors, spacing, fontSize } from "@/src/theme";

interface Staff {
  id: string;
  name: string;
  email: string;
}

export default function Settings() {
  const { user, restaurant, isAdmin, logout, setRestaurant } = useAuth();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [menuLangs, setMenuLangs] = useState<string[]>(restaurant?.languages || ["ar"]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffModal, setStaffModal] = useState(false);
  const [logsModal, setLogsModal] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [sName, setSName] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sPass, setSPass] = useState("");
  const [saving, setSaving] = useState(false);

  const loadStaff = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setStaff(await apiGet("/staff"));
    } catch {
      /* ignore */
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      loadStaff();
      if (restaurant) setMenuLangs(restaurant.languages);
    }, [loadStaff, restaurant])
  );

  const toggleMenuLang = async (code: string) => {
    if (!isAdmin) return;
    let next = menuLangs.includes(code) ? menuLangs.filter((c) => c !== code) : [...menuLangs, code];
    if (next.length === 0) next = ["ar"];
    setMenuLangs(next);
    try {
      const r = await apiPatch("/restaurant", { languages: next });
      if (restaurant) setRestaurant({ ...restaurant, languages: r.languages });
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
      if (restaurant) setMenuLangs(restaurant.languages);
    }
  };

  const addStaff = async () => {
    if (!sName.trim() || !sEmail.trim() || sPass.length < 6) {
      toast(t("required"), "error");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/staff", { name: sName.trim(), email: sEmail.trim(), password: sPass });
      setStaffModal(false);
      setSName("");
      setSEmail("");
      setSPass("");
      toast(t("save"), "success");
      loadStaff();
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    } finally {
      setSaving(false);
    }
  };

  const removeStaff = async (id: string) => {
    try {
      await apiDelete(`/staff/${id}`);
      toast(t("delete"), "success");
      loadStaff();
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    }
  };

  const openLogs = async () => {
    setLogsModal(true);
    try {
      setLogs(await apiGet("/change-logs"));
    } catch {
      /* ignore */
    }
  };

  const doLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <Screen>
      <Header title={t("settings")} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}>
        {/* Account */}
        <View>
          <SectionLabel text={t("account")} />
          <Card>
            <Txt weight="bold" size={fontSize.lg}>
              {user?.name}
            </Txt>
            <Txt size={fontSize.sm} color={colors.muted}>
              {user?.email}
            </Txt>
            <View style={styles.roleBadge}>
              <Txt weight="bold" size={fontSize.sm} color={colors.onBrand}>
                {user?.role === "admin" ? "ADMIN" : "STAFF"}
              </Txt>
            </View>
          </Card>
        </View>

        {/* App language */}
        <View>
          <SectionLabel text={t("app_language")} />
          <Card style={{ padding: 0 }}>
            {LANG_OPTIONS.map((o, idx) => (
              <View key={o.code}>
                <Pressable
                  testID={`app-lang-${o.code}`}
                  onPress={() => setLang(o.code as Lang)}
                  style={styles.row}
                >
                  <Txt weight="semibold" style={{ flex: 1 }}>
                    {o.label}
                  </Txt>
                  <Ionicons
                    name={lang === o.code ? "radio-button-on" : "radio-button-off"}
                    size={22}
                    color={lang === o.code ? colors.brand : colors.muted}
                  />
                </Pressable>
                {idx < LANG_OPTIONS.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </Card>
        </View>

        {/* Menu languages (admin) */}
        {isAdmin ? (
          <View>
            <SectionLabel text={t("menu_languages")} />
            <Txt size={fontSize.sm} color={colors.muted} style={{ marginBottom: spacing.sm }}>
              {t("menu_languages_hint")}
            </Txt>
            <Card style={{ padding: 0 }}>
              {MENU_LANGS.map((o, idx) => {
                const on = menuLangs.includes(o.code);
                return (
                  <View key={o.code}>
                    <Pressable testID={`menu-lang-${o.code}`} onPress={() => toggleMenuLang(o.code)} style={styles.row}>
                      <Txt weight="semibold" style={{ flex: 1 }}>
                        {o.label}
                      </Txt>
                      <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? colors.brand : colors.muted} />
                    </Pressable>
                    {idx < MENU_LANGS.length - 1 ? <Divider /> : null}
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}

        {/* Staff (admin) */}
        {isAdmin ? (
          <View>
            <View style={styles.sectionHead}>
              <SectionLabel text={t("staff")} noMargin />
              <Pressable testID="add-staff-btn" onPress={() => setStaffModal(true)} hitSlop={10}>
                <Ionicons name="add-circle" size={26} color={colors.brand} />
              </Pressable>
            </View>
            <Card style={{ padding: staff.length ? 0 : spacing.lg }}>
              {staff.length === 0 ? (
                <Txt color={colors.muted}>{t("no_staff")}</Txt>
              ) : (
                staff.map((s, idx) => (
                  <View key={s.id}>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Txt weight="semibold">{s.name}</Txt>
                        <Txt size={fontSize.sm} color={colors.muted}>
                          {s.email}
                        </Txt>
                      </View>
                      <Pressable testID={`delete-staff-${s.id}`} onPress={() => removeStaff(s.id)} hitSlop={10}>
                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                      </Pressable>
                    </View>
                    {idx < staff.length - 1 ? <Divider /> : null}
                  </View>
                ))
              )}
            </Card>
          </View>
        ) : null}

        {/* Change log (admin) */}
        {isAdmin ? (
          <OutlineButton title={t("change_log")} icon="time-outline" onPress={openLogs} testID="open-logs-btn" />
        ) : null}

        <PrimaryButton
          title={t("logout")}
          icon="log-out-outline"
          onPress={doLogout}
          color={colors.surface}
          textColor={colors.error}
          testID="logout-button"
        />
      </ScrollView>

      {/* Staff modal */}
      <Modal visible={staffModal} animationType="slide" transparent onRequestClose={() => setStaffModal(false)}>
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHead}>
                <Txt weight="bold" size={fontSize.xl}>
                  {t("add_staff")}
                </Txt>
                <Pressable testID="close-staff-modal" onPress={() => setStaffModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={26} color={colors.onSurface} />
                </Pressable>
              </View>
              <Field testID="staff-name-input" label={t("staff_name")} value={sName} onChangeText={setSName} />
              <Field
                testID="staff-email-input"
                label={t("email")}
                value={sEmail}
                onChangeText={setSEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field testID="staff-password-input" label={t("password")} value={sPass} onChangeText={setSPass} secureTextEntry />
              <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <OutlineButton title={t("cancel")} onPress={() => setStaffModal(false)} testID="cancel-staff" />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title={t("save")} onPress={addStaff} loading={saving} testID="save-staff-button" />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Logs modal */}
      <Modal visible={logsModal} animationType="slide" transparent onRequestClose={() => setLogsModal(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.sheet, { maxHeight: "80%" }]}>
            <View style={styles.sheetHead}>
              <Txt weight="bold" size={fontSize.xl}>
                {t("change_log")}
              </Txt>
              <Pressable testID="close-logs-modal" onPress={() => setLogsModal(false)} hitSlop={10}>
                <Ionicons name="close" size={26} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView>
              {logs.length === 0 ? (
                <Txt color={colors.muted}>—</Txt>
              ) : (
                logs.map((l) => (
                  <View key={l.id} style={styles.logRow}>
                    <Txt weight="semibold" size={fontSize.sm}>
                      {l.action} · {l.entity}
                    </Txt>
                    <Txt size={fontSize.sm} color={colors.muted}>
                      {l.user_email} · {new Date(l.created_at).toLocaleString()}
                    </Txt>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function SectionLabel({ text, noMargin }: { text: string; noMargin?: boolean }) {
  return (
    <Txt weight="bold" size={fontSize.sm} color={colors.muted} style={{ marginBottom: noMargin ? 0 : spacing.sm, letterSpacing: 1 }}>
      {text.toUpperCase()}
    </Txt>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  roleBadge: { alignSelf: "flex-start", backgroundColor: colors.brand, paddingHorizontal: spacing.sm, paddingVertical: 2, marginTop: spacing.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopWidth: 3, borderColor: colors.borderStrong, padding: spacing.lg },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  logRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
});
