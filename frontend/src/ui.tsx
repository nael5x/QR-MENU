import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Switch as RNSwitch,
  Animated,
  TextProps,
  ViewStyle,
  StyleProp,
  TextStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize, ff } from "@/src/theme";
import { useI18n } from "@/src/i18n";

// ---------------------------------------------------------------------------
// Txt — font-aware, RTL-aware text
// ---------------------------------------------------------------------------
type Weight = "regular" | "semibold" | "bold" | "mono";
interface TxtProps extends TextProps {
  weight?: Weight;
  size?: number;
  color?: string;
  align?: "auto" | "left" | "right" | "center";
}
const familyFor: Record<Weight, string> = {
  regular: ff.regular,
  semibold: ff.semibold,
  bold: ff.bold,
  mono: ff.mono,
};
export function Txt({ weight = "regular", size = fontSize.base, color = colors.onSurface, align, style, ...rest }: TxtProps) {
  const { isRTL } = useI18n();
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: familyFor[weight],
          fontSize: size,
          color,
          textAlign: align ?? (isRTL ? "right" : "left"),
          writingDirection: isRTL ? "rtl" : "ltr",
        },
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Header (sticky, safe-area aware)
// ---------------------------------------------------------------------------
export function Header({
  title,
  right,
  onBack,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { isRTL } = useI18n();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable testID="back-button" onPress={onBack} style={styles.backBtn} hitSlop={12}>
            <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={26} color={colors.onSurface} />
          </Pressable>
        ) : (
          <View style={{ width: 26 }} />
        )}
        <View style={{ flex: 1, paddingHorizontal: spacing.sm }}>
          <Txt weight="bold" size={fontSize.xl} numberOfLines={1} align="center">
            {title}
          </Txt>
          {subtitle ? (
            <Txt size={fontSize.sm} color={colors.muted} align="center">
              {subtitle}
            </Txt>
          ) : null}
        </View>
        <View style={{ minWidth: 26, alignItems: "flex-end" }}>{right}</View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  testID,
  color = colors.brand,
  textColor = colors.onBrand,
  icon,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  color?: string;
  textColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const dis = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={dis}
      style={({ pressed }) => [
        styles.primaryBtn,
        { backgroundColor: color, opacity: dis ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.btnInner}>
          {icon ? <Ionicons name={icon} size={18} color={textColor} style={{ marginHorizontal: 6 }} /> : null}
          <Txt weight="bold" size={fontSize.lg} color={textColor} align="center">
            {title}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

export function OutlineButton({
  title,
  onPress,
  testID,
  icon,
  color = colors.onSurface,
}: {
  title: string;
  onPress: () => void;
  testID?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.outlineBtn, { opacity: pressed ? 0.7 : 1, borderColor: color }]}
    >
      <View style={styles.btnInner}>
        {icon ? <Ionicons name={icon} size={16} color={color} style={{ marginHorizontal: 4 }} /> : null}
        <Txt weight="semibold" size={fontSize.base} color={color}>
          {title}
        </Txt>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Field (input)
// ---------------------------------------------------------------------------
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  testID,
  multiline,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "decimal-pad";
  autoCapitalize?: "none" | "sentences";
  testID?: string;
  multiline?: boolean;
}) {
  const { isRTL } = useI18n();
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Txt weight="semibold" size={fontSize.sm} color={colors.onSurfaceSecondary} style={{ marginBottom: spacing.xs }}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        style={[
          styles.input,
          {
            textAlign: isRTL ? "right" : "left",
            writingDirection: isRTL ? "rtl" : "ltr",
            height: multiline ? 88 : 52,
            textAlignVertical: multiline ? "top" : "center",
          },
        ]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Toggle row
// ---------------------------------------------------------------------------
export function Switch({ value, onValueChange, testID }: { value: boolean; onValueChange: (v: boolean) => void; testID?: string }) {
  return (
    <RNSwitch
      testID={testID}
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: colors.surfaceTertiary, true: colors.brand }}
      thumbColor={colors.surface}
      ios_backgroundColor={colors.surfaceTertiary}
    />
  );
}

// ---------------------------------------------------------------------------
// Card / Divider / EmptyState
// ---------------------------------------------------------------------------
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function EmptyState({ text, icon = "documents-outline" }: { text: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.muted} />
      <Txt weight="semibold" size={fontSize.base} color={colors.muted} align="center" style={{ marginTop: spacing.md }}>
        {text}
      </Txt>
    </View>
  );
}

export function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.empty}>
      <Ionicons name="warning-outline" size={40} color={colors.error} />
      <Txt weight="semibold" color={colors.error} align="center" style={{ marginVertical: spacing.md }}>
        {text}
      </Txt>
      <OutlineButton title={t("retry")} onPress={onRetry} testID="retry-button" color={colors.error} />
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <SafeAreaView edges={["bottom", "left", "right"]} style={[{ flex: 1, backgroundColor: colors.surface }, style]}>{children}</SafeAreaView>;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
interface ToastState {
  msg: string;
  type: "success" | "error" | "info";
}
const ToastCtx = createContext<(msg: string, type?: ToastState["type"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ToastState | null>(null);
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<any>(null);

  const show = useCallback(
    (msg: string, type: ToastState["type"] = "info") => {
      setState({ msg, type });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setState(null));
      }, 2400);
    },
    [opacity]
  );

  const bg = state?.type === "success" ? colors.success : state?.type === "error" ? colors.error : colors.surfaceInverse;

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {state ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, { top: insets.top + spacing.sm, backgroundColor: bg, opacity }]}
        >
          <Text style={{ color: "#fff", fontFamily: ff.semibold, fontSize: fontSize.base, textAlign: "center" }}>
            {state.msg}
          </Text>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

export { ScrollView };

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.borderStrong,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  backBtn: { padding: 2 },
  primaryBtn: {
    height: 54,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  outlineBtn: {
    height: 44,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  btnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontFamily: ff.regular,
    fontSize: fontSize.lg,
    color: colors.onSurface,
  },
  card: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  divider: { height: 1, backgroundColor: colors.divider },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, minHeight: 220 },
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    zIndex: 9999,
  },
});
