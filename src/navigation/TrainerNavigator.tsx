// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Navigation (React Navigation v6)
// Bottom Tabs: Home | Clients | Videos | Schedule | Profile
// ─────────────────────────────────────────────────────────────────────────────
// Install:
//   npx expo install @react-navigation/native @react-navigation/bottom-tabs
//   npx expo install @react-navigation/native-stack
//   npx expo install react-native-screens react-native-safe-area-context
// ─────────────────────────────────────────────────────────────────────────────

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Text } from 'react-native';
import { LIFT_TEAL } from '../constants/trainer.constants';

// ── Screens ──
import GymLinkingScreen from '../screens/auth/GymLinkingScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import RegistrationScreen from '../screens/auth/RegistrationScreen';
import SplashScreen from '../screens/auth/SplashScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';

import ClientListScreen from '../screens/clients/ClientListScreen';
import ClientProfileScreen from '../screens/clients/ClientProfileScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import EarningsScreen from '../screens/earnings/EarningsScreen';
import FreelanceOnboardingScreen from '../screens/freelance/FreelanceOnboardingScreen';
import LiveClassScreen from '../screens/live/LiveClassScreen';
import ScheduleScreen from '../screens/live/ScheduleScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import MeasurementsScreen from '../screens/progress/MeasurementsScreen';
import ProgressPhotosScreen from '../screens/progress/ProgressPhotosScreen';
import WeightBMIScreen from '../screens/progress/WeightBMIScreen';
import UploadVideoScreen from '../screens/video/UploadVideoScreen';
import VideoLibraryScreen from '../screens/video/VideoLibraryScreen';
import CreatePlanScreen from '../screens/workout/CreatePlanScreen';
import WorkoutLogsScreen from '../screens/workout/WorkoutLogsScreen';

// ─── Param Lists ──────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Registration: undefined;
  OTP: { phone: string; isNewUser: boolean };
  GymLinking: { trainerId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Clients: undefined;
  Videos: undefined;
  Schedule: undefined;
  Profile: undefined;
};

export type ClientsStackParamList = {
  ClientList: undefined;
  ClientProfile: { clientId: string; clientName: string };
  CreatePlan: { clientId: string; clientName: string; existingPlanId?: string };
  WorkoutLogs: { clientId: string; clientName: string };
  WeightBMI: { clientId: string; clientName: string };
  Measurements: { clientId: string; clientName: string };
  ProgressPhotos: { clientId: string; clientName: string };
  FreelanceOnboarding: undefined;
};

export type VideosStackParamList = {
  VideoLibrary: undefined;
  UploadVideo: { preselectedClientId?: string };
};

export type ScheduleStackParamList = {
  ScheduleList: undefined;
  LiveClass: { classId: string };
  CreateClass: { classId?: string };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Earnings: undefined;
  Notifications: undefined;
};

// ─── Stacks ───────────────────────────────────────────────────────────────────

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const ClientsStack = createNativeStackNavigator<ClientsStackParamList>();
const VideosStack = createNativeStackNavigator<VideosStackParamList>();
const ScheduleStack = createNativeStackNavigator<ScheduleStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const RootStack = createNativeStackNavigator<{ Auth: undefined; Main: undefined }>();

// ─── Tab icon helper ──────────────────────────────────────────────────────────

const TAB_ICONS: Record<string, string> = {
  Home: '🏠',
  Clients: '👥',
  Videos: '▶️',
  Schedule: '📅',
  Profile: '👤',
};

// ─── Nested stacks ───────────────────────────────────────────────────────────

function ClientsStackNavigator() {
  return (
    <ClientsStack.Navigator screenOptions={{ headerShown: false }}>
      <ClientsStack.Screen name="ClientList" component={ClientListScreen} />
      <ClientsStack.Screen name="ClientProfile" component={ClientProfileScreen} />
      <ClientsStack.Screen name="CreatePlan" component={CreatePlanScreen} />
      <ClientsStack.Screen name="WorkoutLogs" component={WorkoutLogsScreen} />
      <ClientsStack.Screen name="WeightBMI" component={WeightBMIScreen} />
      <ClientsStack.Screen name="Measurements" component={MeasurementsScreen} />
      <ClientsStack.Screen name="ProgressPhotos" component={ProgressPhotosScreen} />
      <ClientsStack.Screen name="FreelanceOnboarding" component={FreelanceOnboardingScreen} />
    </ClientsStack.Navigator>
  );
}

function VideosStackNavigator() {
  return (
    <VideosStack.Navigator screenOptions={{ headerShown: false }}>
      <VideosStack.Screen name="VideoLibrary" component={VideoLibraryScreen} />
      <VideosStack.Screen name="UploadVideo" component={UploadVideoScreen} />
    </VideosStack.Navigator>
  );
}

function ScheduleStackNavigator() {
  return (
    <ScheduleStack.Navigator screenOptions={{ headerShown: false }}>
      <ScheduleStack.Screen name="ScheduleList" component={ScheduleScreen} />
      <ScheduleStack.Screen name="LiveClass" component={LiveClassScreen} />
    </ScheduleStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="Earnings" component={EarningsScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
    </ProfileStack.Navigator>
  );
}

// ─── Main Tab Navigator ───────────────────────────────────────────────────────

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: LIFT_TEAL,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
          backgroundColor: '#FFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
        },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>
            {TAB_ICONS[route.name]}
          </Text>
        ),
        tabBarLabel: route.name,
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Clients" component={ClientsStackNavigator} />
      <Tab.Screen name="Videos" component={VideosStackNavigator} />
      <Tab.Screen name="Schedule" component={ScheduleStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

// ─── Auth Stack ───────────────────────────────────────────────────────────────

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Splash" component={SplashScreen} />
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Registration" component={RegistrationScreen} />
      <AuthStack.Screen name="OTP" component={OTPScreen} />
      <AuthStack.Screen name="GymLinking" component={GymLinkingScreen} />
    </AuthStack.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────

export default function TrainerNavigator() {
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Auth" component={AuthStackNavigator} />
        <RootStack.Screen name="Main" component={MainTabNavigator} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
