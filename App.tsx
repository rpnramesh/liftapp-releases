// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — App.tsx (Root)
// Wires: AuthProvider · i18n · Error Boundary · FCM · Navigation
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GlobalErrorBoundary } from './src/components/common/ErrorBoundary';
import { LIFT_TEAL } from './src/constants/trainer.constants';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { initI18n } from './src/i18n/i18n';
import TrainerNavigator from './src/navigation/TrainerNavigator';
import { logAppOpen } from './src/services/analytics';
import { setupNotifications } from './src/services/notifications';

// ─── Inner app (has access to AuthContext) ───────────────────────────────────

function InnerApp() {
  const { trainerId, token, gymId, isFreelance, isLoading } = useAuth();
  const notifCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!trainerId || !token) return;

    // Navigation ref is provided via TrainerNavigator internally
    setupNotifications(trainerId, token, { navigate: () => {} }).then(cleanup => {
      notifCleanupRef.current = cleanup;
    });

    logAppOpen(trainerId, gymId, isFreelance);

    return () => { notifCleanupRef.current?.(); };
  }, [trainerId, token]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }}>
        <ActivityIndicator color={LIFT_TEAL} size="large" />
      </View>
    );
  }

  return <TrainerNavigator />;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }}>
        <ActivityIndicator color={LIFT_TEAL} size="large" />
      </View>
    );
  }

  return (
    <GlobalErrorBoundary
      onError={(error, info) => {
        if (__DEV__) console.error('[ErrorBoundary]', error, info);
        // Wire Sentry / Crashlytics here
      }}
    >
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
        <AuthProvider>
          <InnerApp />
        </AuthProvider>
      </SafeAreaProvider>
    </GlobalErrorBoundary>
  );
}
