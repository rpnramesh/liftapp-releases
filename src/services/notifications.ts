// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — FCM Notification Handler
//
// Handles Firebase push notifications for the Trainer app.
// Supports deep-linking to the correct screen when a notification is tapped.
//
// Install:
//   npx expo install @react-native-firebase/app @react-native-firebase/messaging
//   npx expo install @notifee/react-native    (for foreground display on Android)
//
// Wire-up: call setupNotifications() once in App.tsx after the user logs in.
// ─────────────────────────────────────────────────────────────────────────────

import { Alert } from 'react-native';
import { NotificationType } from '../types/trainer.types';

// ─── Deep-link resolver ───────────────────────────────────────────────────────
// Maps notification type → navigation action.
// Pass the navigation ref from App.tsx.

interface NavigationRef {
  navigate: (screen: string, params?: object) => void;
  reset?: (state: object) => void;
}

export function resolveDeepLink(
  type: NotificationType,
  payload: Record<string, string>,
  navigation: NavigationRef,
): void {
  try {
    switch (type) {
      // Trainer opens workout log for the relevant client
      case 'workout_logged':
        navigation.navigate('Clients', {
          screen: 'WorkoutLogs',
          params: {
            clientId: payload.clientId,
            clientName: payload.clientName ?? 'Client',
          },
        });
        break;

      // New freelance client accepted invite → open client profile
      case 'client_invited_accepted':
        navigation.navigate('Clients', {
          screen: 'ClientProfile',
          params: {
            clientId: payload.clientId,
            clientName: payload.clientName ?? 'Client',
          },
        });
        break;

      // Membership due → open earnings / dues list
      case 'membership_due':
        navigation.navigate('Profile', { screen: 'Earnings' });
        break;

      // Client watched a personal video → open video library
      case 'video_watched':
        navigation.navigate('Videos', { screen: 'VideoLibrary' });
        break;

      // Member RSVPed to a class → open schedule
      case 'class_rsvp':
        navigation.navigate('Schedule', {
          screen: 'LiveClass',
          params: { classId: payload.classId },
        });
        break;

      // Class starts soon → open schedule
      case 'class_reminder':
        navigation.navigate('Schedule', {
          screen: 'LiveClass',
          params: { classId: payload.classId },
        });
        break;

      // Payment received / failed → open earnings
      case 'payment_received':
      case 'payment_failed':
        navigation.navigate('Profile', { screen: 'Earnings' });
        break;

      // Client reassigned by gym admin → refresh client list
      case 'client_reassigned':
        navigation.navigate('Clients', { screen: 'ClientList' });
        break;

      // Generic system notification → home
      case 'system':
      default:
        navigation.navigate('Home');
        break;
    }
  } catch {
    // If the deeplink target no longer exists, navigate to the section root
    navigation.navigate('Home');
  }
}

// ─── Permission request ───────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    // With @react-native-firebase/messaging:
    // const authStatus = await messaging().requestPermission();
    // return authStatus === AuthorizationStatus.AUTHORIZED ||
    //        authStatus === AuthorizationStatus.PROVISIONAL;

    // Stub — returns true; replace with real implementation
    return true;
  } catch {
    return false;
  }
}

// ─── FCM token registration ───────────────────────────────────────────────────

export async function registerFCMToken(
  trainerId: string,
  accessToken: string,
): Promise<void> {
  try {
    // With @react-native-firebase/messaging:
    // const fcmToken = await messaging().getToken();
    // await AuthAPI.registerFCM(fcmToken, accessToken);

    // Listen for token refreshes
    // messaging().onTokenRefresh(async (newToken) => {
    //   await AuthAPI.registerFCM(newToken, accessToken);
    // });
  } catch (err) {
    if (__DEV__) console.warn('[FCM] Token registration failed:', err);
  }
}

// ─── Foreground message handler ───────────────────────────────────────────────
// Shows an in-app notification banner when the app is open.

export function setupForegroundHandler(navigation: NavigationRef): () => void {
  // With @react-native-firebase/messaging:
  // const unsubscribe = messaging().onMessage(async remoteMessage => {
  //   const { type, ...payload } = remoteMessage.data ?? {};
  //   // Show in-app banner (e.g., via notifee or a custom Toast)
  //   // On tap: resolveDeepLink(type as NotificationType, payload, navigation);
  // });
  // return unsubscribe;

  return () => {}; // Stub cleanup
}

// ─── Background / quit state handler ─────────────────────────────────────────
// Call once at the top level (outside any component) in App.tsx.

export function setupBackgroundHandler(): void {
  // With @react-native-firebase/messaging:
  // messaging().setBackgroundMessageHandler(async remoteMessage => {
  //   // Background processing — do not navigate here
  //   // Navigation happens in the onNotificationOpenedApp listener below
  // });
}

// ─── Opened-from-notification handler ────────────────────────────────────────
// Fires when user taps a notification while the app is in background or quit.

export function setupOpenedAppHandler(navigation: NavigationRef): void {
  // With @react-native-firebase/messaging:
  //
  // // App in background → tapped notification
  // messaging().onNotificationOpenedApp(remoteMessage => {
  //   const { type, ...payload } = remoteMessage.data ?? {};
  //   resolveDeepLink(type as NotificationType, payload, navigation);
  // });
  //
  // // App quit → tapped notification on launch
  // messaging().getInitialNotification().then(remoteMessage => {
  //   if (remoteMessage) {
  //     const { type, ...payload } = remoteMessage.data ?? {};
  //     // Slight delay so navigator is mounted
  //     setTimeout(() => resolveDeepLink(type as NotificationType, payload, navigation), 500);
  //   }
  // });
}

// ─── Master setup (call once after auth) ─────────────────────────────────────

export async function setupNotifications(
  trainerId: string,
  accessToken: string,
  navigation: NavigationRef,
): Promise<() => void> {
  const granted = await requestNotificationPermission();

  if (!granted) {
    // Per TS-018 edge case: show in-app prompt explaining why notifications matter
    Alert.alert(
      'Enable Notifications',
      'Turn on notifications to get instant alerts when clients log workouts, pay fees, or join your live classes.',
    );
    return () => {};
  }

  await registerFCMToken(trainerId, accessToken);

  setupBackgroundHandler();
  setupOpenedAppHandler(navigation);
  const unsubscribeForeground = setupForegroundHandler(navigation);

  return unsubscribeForeground;
}
