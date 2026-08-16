import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { storage } from "@/src/utils/storage";

export type Lang = "ar" | "en";

export const LANG_OPTIONS: { code: Lang; label: string }[] = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
];

// Master list of menu languages a restaurant can enable.
export const MENU_LANGS: { code: string; label: string }[] = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "tr", label: "Türkçe" },
  { code: "ur", label: "اردو" },
];

const STRINGS = {
  ar: {
    app_name: "منيو QR",
    // auth
    login: "تسجيل الدخول",
    register: "إنشاء حساب مطعم",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    restaurant_name: "اسم المطعم",
    no_account: "ليس لديك حساب؟ أنشئ مطعمك",
    have_account: "لديك حساب؟ سجّل الدخول",
    login_subtitle: "لوحة إدارة المطعم",
    create_account: "إنشاء الحساب",
    // tabs
    dashboard: "الرئيسية",
    branches: "الفروع",
    menu: "المنيو",
    settings: "الإعدادات",
    // dashboard
    overview: "نظرة عامة",
    orders_status: "استقبال الطلبات",
    orders_on: "مفعّل",
    orders_off: "متوقف",
    orders_paused_hint: "المنيو يبقى مرئياً للزبائن حتى عند إيقاف الطلبات",
    kpi_branches: "الفروع",
    kpi_tables: "الطاولات",
    kpi_items: "الأصناف",
    kpi_categories: "الأقسام",
    kpi_unavailable: "أصناف غير متوفرة",
    welcome: "مرحباً",
    // branches
    add_branch: "إضافة فرع",
    branch_name: "اسم الفرع",
    address: "العنوان",
    phone: "الهاتف",
    no_branches: "لا توجد فروع بعد",
    tables: "الطاولات",
    table_count: "طاولة",
    manage_tables: "إدارة الطاولات",
    add_table: "إضافة طاولة",
    table_label: "اسم/رقم الطاولة",
    no_tables: "لا توجد طاولات",
    view_qr: "عرض رمز QR",
    qr_title: "رمز QR للطاولة",
    qr_hint: "امسح الرمز لفتح منيو هذه الطاولة",
    copy_link: "نسخ الرابط",
    copied: "تم نسخ الرابط",
    // menu
    select_branch: "اختر الفرع",
    add_category: "إضافة قسم",
    category_name: "اسم القسم",
    add_item: "إضافة صنف",
    item_name: "اسم الصنف",
    item_desc: "الوصف",
    price: "السعر",
    available: "متوفر",
    unavailable: "غير متوفر",
    visible: "ظاهر",
    hidden: "مخفي",
    no_menu: "المنيو فارغ. أضف قسماً أولاً",
    image: "الصورة",
    pick_image: "اختر صورة",
    edit: "تعديل",
    delete: "حذف",
    save: "حفظ",
    cancel: "إلغاء",
    confirm_delete: "تأكيد الحذف؟",
    // settings
    app_language: "لغة التطبيق",
    menu_languages: "لغات المنيو للزبائن",
    menu_languages_hint: "اللغات التي ستظهر للزبون عند فتح المنيو",
    staff: "الموظفون",
    add_staff: "إضافة موظف",
    staff_name: "اسم الموظف",
    no_staff: "لا يوجد موظفون",
    change_log: "سجل التغييرات",
    logout: "تسجيل الخروج",
    account: "الحساب",
    admin_only: "متاح للمسؤول فقط",
    // generic
    retry: "إعادة المحاولة",
    error_generic: "حدث خطأ، حاول مرة أخرى",
    loading: "جارٍ التحميل...",
    required: "هذا الحقل مطلوب",
    // customer web
    menu_of: "منيو",
    call_waiter: "نداء النادل",
    orders_disabled_notice: "الطلب غير متاح حالياً — يمكنك تصفح المنيو",
    sar: "ر.س",
  },
  en: {
    app_name: "QR Menu",
    login: "Sign In",
    register: "Create Restaurant",
    email: "Email",
    password: "Password",
    restaurant_name: "Restaurant Name",
    no_account: "No account? Create your restaurant",
    have_account: "Have an account? Sign in",
    login_subtitle: "Restaurant Admin Panel",
    create_account: "Create Account",
    dashboard: "Home",
    branches: "Branches",
    menu: "Menu",
    settings: "Settings",
    overview: "Overview",
    orders_status: "Accepting Orders",
    orders_on: "ON",
    orders_off: "PAUSED",
    orders_paused_hint: "Menu stays visible to customers even when orders are paused",
    kpi_branches: "Branches",
    kpi_tables: "Tables",
    kpi_items: "Items",
    kpi_categories: "Categories",
    kpi_unavailable: "Out of stock items",
    welcome: "Welcome",
    add_branch: "Add Branch",
    branch_name: "Branch Name",
    address: "Address",
    phone: "Phone",
    no_branches: "No branches yet",
    tables: "Tables",
    table_count: "tables",
    manage_tables: "Manage Tables",
    add_table: "Add Table",
    table_label: "Table Name / Number",
    no_tables: "No tables",
    view_qr: "View QR",
    qr_title: "Table QR Code",
    qr_hint: "Scan to open this table's menu",
    copy_link: "Copy Link",
    copied: "Link copied",
    select_branch: "Select Branch",
    add_category: "Add Category",
    category_name: "Category Name",
    add_item: "Add Item",
    item_name: "Item Name",
    item_desc: "Description",
    price: "Price",
    available: "Available",
    unavailable: "Out of stock",
    visible: "Visible",
    hidden: "Hidden",
    no_menu: "Menu empty. Add a category first",
    image: "Image",
    pick_image: "Pick image",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    confirm_delete: "Confirm delete?",
    app_language: "App Language",
    menu_languages: "Customer Menu Languages",
    menu_languages_hint: "Languages shown to the customer in the menu",
    staff: "Staff",
    add_staff: "Add Staff",
    staff_name: "Staff Name",
    no_staff: "No staff",
    change_log: "Change Log",
    logout: "Sign Out",
    account: "Account",
    admin_only: "Admin only",
    retry: "Retry",
    error_generic: "Something went wrong, try again",
    loading: "Loading...",
    required: "This field is required",
    menu_of: "Menu",
    call_waiter: "Call Waiter",
    orders_disabled_notice: "Ordering unavailable — browse the menu",
    sar: "SAR",
  },
};

type Dict = typeof STRINGS.ar;

interface I18nCtx {
  lang: Lang;
  isRTL: boolean;
  t: (k: keyof Dict) => string;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<I18nCtx>({
  lang: "ar",
  isRTL: true,
  t: (k) => STRINGS.ar[k],
  setLang: () => {},
});

const KEY = "app_lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(KEY, "ar");
      if (saved === "ar" || saved === "en") setLangState(saved);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.setItem(KEY, l);
  }, []);

  const t = useCallback((k: keyof Dict) => STRINGS[lang][k] ?? String(k), [lang]);

  return (
    <Ctx.Provider value={{ lang, isRTL: lang === "ar", t, setLang }}>
      {children}
    </Ctx.Provider>
  );
}

export const useI18n = () => useContext(Ctx);

// Pick a localized string from a {langCode: value} map with sensible fallback.
export function pick(map: Record<string, string> | undefined, lang: string): string {
  if (!map) return "";
  return map[lang] || map["ar"] || map["en"] || Object.values(map)[0] || "";
}
