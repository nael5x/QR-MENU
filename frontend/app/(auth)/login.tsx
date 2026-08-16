import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { Txt, Field, PrimaryButton, useToast, ScrollView } from "@/src/ui";
import { colors, spacing, fontSize } from "@/src/theme";

export default function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      toast(t("required"), "error");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logoBox}>
            <Ionicons name="qr-code" size={44} color={colors.onBrand} />
          </View>
          <Txt weight="bold" size={fontSize.xxxl} align="center">
            {t("app_name")}
          </Txt>
          <Txt size={fontSize.base} color={colors.muted} align="center" style={{ marginBottom: spacing.xxl }}>
            {t("login_subtitle")}
          </Txt>

          <Field
            testID="login-email-input"
            label={t("email")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="admin@demo.com"
          />
          <Field
            testID="login-password-input"
            label={t("password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />

          <View style={{ marginTop: spacing.md }}>
            <PrimaryButton testID="login-submit-button" title={t("login")} onPress={submit} loading={loading} />
          </View>

          <Pressable testID="go-register-link" onPress={() => router.push("/(auth)/register")} style={{ marginTop: spacing.xl }}>
            <Txt weight="semibold" color={colors.brand} align="center">
              {t("no_account")}
            </Txt>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  logoBox: {
    width: 84,
    height: 84,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
});
