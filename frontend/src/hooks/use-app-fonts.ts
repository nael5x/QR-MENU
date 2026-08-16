import { useFonts } from "expo-font";

// Bundled locally so there is no network dependency at boot.
export const useAppFonts = (): readonly [boolean, Error | null] =>
  useFonts({
    "IBMPlexSansArabic": require("../../assets/fonts/IBMPlexSansArabic-Regular.ttf"),
    "IBMPlexSansArabic-SemiBold": require("../../assets/fonts/IBMPlexSansArabic-SemiBold.ttf"),
    "IBMPlexSansArabic-Bold": require("../../assets/fonts/IBMPlexSansArabic-Bold.ttf"),
    "IBMPlexMono": require("../../assets/fonts/IBMPlexMono-Medium.ttf"),
  });
