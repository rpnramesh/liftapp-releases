// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — i18n Setup
//
// Install:
//   npm install i18next react-i18next
//   npx expo install expo-localization
//
// Usage in any component:
//   const { t } = useTranslation();
//   <Text>{t('dashboard.todaySchedule')}</Text>
//
// Language toggle (persisted to AsyncStorage):
//   const { setLanguage, language } = useLocale();
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import ml from './ml.json';

export const SUPPORTED_LANGUAGES = ['en', 'ml'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

const LANGUAGE_KEY = 'lift_trainer_language';

// ─── Detect saved or device language ─────────────────────────────────────────

const detectLanguage = async (): Promise<SupportedLanguage> => {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.includes(saved as SupportedLanguage)) {
      return saved as SupportedLanguage;
    }
  } catch {}

  // Fall back to device locale
  const deviceLocale = (Localization as any).locale?.split('-')[0] ?? 'en';
  return SUPPORTED_LANGUAGES.includes(deviceLocale as SupportedLanguage)
    ? (deviceLocale as SupportedLanguage)
    : 'en';
};

// ─── Init (called once in App.tsx before render) ─────────────────────────────

export const initI18n = async (): Promise<void> => {
  const language = await detectLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ml: { translation: ml },
    },
    lng: language,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already handles XSS
    },
    compatibilityJSON: 'v4',
  });
};

// ─── Persist language change ─────────────────────────────────────────────────

export const changeLanguage = async (lang: SupportedLanguage): Promise<void> => {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  await i18n.changeLanguage(lang);
};

export default i18n;
