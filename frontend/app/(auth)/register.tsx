import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { Txt, Field, PrimaryButton, useToast, Header, ScrollView } from "@/src/ui";
import { colors, spacing, fontSize } from "@/src/theme";

export default function Register() {
  const { register } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      toast(t("required"), "error");
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      toast(e.message || t("error_generic"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <Header title={t("register")} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Field
            testID="register-name-input"
            label={t("restaurant_name")}
            value={name}
            onChangeText={setName}
            placeholder={t("restaurant_name")}
          />
          <Field
            testID="register-email-input"
            label={t("email")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@restaurant.com"
          />
          <Field
            testID="register-password-input"
            label={t("password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          <View style={{ marginTop: spacing.md }}>
            <PrimaryButton testID="register-submit-button" title={t("create_account")} onPress={submit} loading={loading} />
          </View>
          <Pressable testID="go-login-link" onPress={() => router.back()} style={{ marginTop: spacing.xl }}>
            <Txt weight="semibold" color={colors.brand} align="center">
              {t("have_account")}
            </Txt>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: spacing.xl, paddingTop: spacing.xxl },
});
