// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Navigator
// ─────────────────────────────────────────────────────────────────────────────

import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import GymLinkingScreen from '../screens/auth/GymLinkingScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import RegistrationScreen from '../screens/auth/RegistrationScreen';
import SplashScreen from '../screens/auth/SplashScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import ClientListScreen, { ClientProfileScreen } from '../screens/clients/ClientListScreen';
import MemberDetailsScreen from '../screens/clients/MemberDetailsScreen';
import PendingInvitesScreen from '../screens/clients/PendingInvitesScreen';
import PhoneInviteScreen from '../screens/clients/PhoneInviteScreen';
import TrainerChatScreen from '../screens/clients/TrainerChatScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import EarningsScreen from '../screens/earnings/EarningsScreen';
import FreelanceOnboardingScreen from '../screens/freelance/FreelanceOnboardingScreen';
import CreateExerciseScreen from '../screens/library/CreateExerciseScreen';
import CreateWorkoutScreen from '../screens/library/CreateWorkoutScreen';
import LibraryScreen from '../screens/library/LibraryScreen';
import WorkoutsListScreen from '../screens/library/WorkoutsListScreen';
import LiveClassScreen from '../screens/live/LiveClassScreen';
import ScheduleScreen from '../screens/live/ScheduleScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import MeasurementsScreen from '../screens/progress/MeasurementsScreen';
import ProgressDashboardScreen from '../screens/progress/ProgressDashboardScreen';
import ProgressPhotosScreen from '../screens/progress/ProgressPhotosScreen';
import WeightBMIScreen from '../screens/progress/WeightBMIScreen';
import UploadVideoScreen from '../screens/video/UploadVideoScreen';
import CreatePlanScreen from '../screens/workout/CreatePlanScreen';
import WorkoutLogsScreen from '../screens/workout/WorkoutLogsScreen';

// ─── Param lists ──────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Registration: undefined;
  OTP: { phone?: string; isNewUser?: boolean; registrationData?: any };
  GymLinking: { trainerId: string };
};

export type ClientsStackParamList = {
  ClientList: undefined;
  ClientProfile: { clientId: string; clientName: string };
  MemberDetails: { clientId: string; clientName: string };
  CreatePlan: { clientId: string; clientName: string };
  WorkoutLogs: { clientId: string; clientName: string };
  WeightBMI: { clientId: string; clientName: string };
  Measurements: { clientId: string; clientName: string };
  ProgressPhotos: { clientId: string; clientName: string };
  ProgressDashboard: { clientId: string; clientName: string };
  FreelanceOnboarding: undefined;
  TrainerChat: { clientId: string; clientName: string; clientPhone?: string; clientPhotoUrl?: string | null };
  PhoneInvite: undefined;
  PendingInvites: undefined;
};

export type LibraryStackParamList = {
  LibraryHub: undefined;
  WorkoutsList: undefined;
  CreateWorkout: { workout?: any } | undefined;
  CreateExercise: { exercise?: any } | undefined;
  UploadVideo: undefined;
};

export type ScheduleStackParamList = {
  ScheduleList: undefined;
  LiveClass: { classId?: string } | undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Earnings: undefined;
  Notifications: undefined;
};

// ─── Stack navigators ─────────────────────────────────────────────────────────

const AuthStack     = createNativeStackNavigator<AuthStackParamList>();
const ClientsStack  = createNativeStackNavigator<ClientsStackParamList>();
const LibraryStack  = createNativeStackNavigator<LibraryStackParamList>();
const ScheduleStack = createNativeStackNavigator<ScheduleStackParamList>();
const ProfileStack  = createNativeStackNavigator<ProfileStackParamList>();
const Tab           = createBottomTabNavigator();
const RootStack     = createNativeStackNavigator();

// ─── Clients stack ────────────────────────────────────────────────────────────

function ClientsStackNavigator() {
  return (
    <ClientsStack.Navigator id="clients" screenOptions={{ headerShown: false }}>
      <ClientsStack.Screen name="ClientList"          component={ClientListScreen} />
      <ClientsStack.Screen name="ClientProfile"       component={ClientProfileScreen} />
      <ClientsStack.Screen name="MemberDetails"       component={MemberDetailsScreen} />
      <ClientsStack.Screen name="CreatePlan"          component={CreatePlanScreen} />
      <ClientsStack.Screen name="WorkoutLogs"         component={WorkoutLogsScreen} />
      <ClientsStack.Screen name="WeightBMI"           component={WeightBMIScreen} />
      <ClientsStack.Screen name="Measurements"        component={MeasurementsScreen} />
      <ClientsStack.Screen name="ProgressPhotos"      component={ProgressPhotosScreen} />
      <ClientsStack.Screen name="ProgressDashboard"   component={ProgressDashboardScreen} />
      <ClientsStack.Screen name="FreelanceOnboarding" component={FreelanceOnboardingScreen} />
      <ClientsStack.Screen name="TrainerChat"         component={TrainerChatScreen} />
      <ClientsStack.Screen name="PhoneInvite"         component={PhoneInviteScreen} />
      <ClientsStack.Screen name="PendingInvites"      component={PendingInvitesScreen} />
    </ClientsStack.Navigator>
  );
}

// ─── Library stack ────────────────────────────────────────────────────────────

function LibraryStackNavigator() {
  return (
    <LibraryStack.Navigator id="library" screenOptions={{ headerShown: false }}>
      <LibraryStack.Screen name="LibraryHub"     component={LibraryScreen} />
      <LibraryStack.Screen name="WorkoutsList"   component={WorkoutsListScreen} />
      <LibraryStack.Screen name="CreateWorkout"  component={CreateWorkoutScreen} />
      <LibraryStack.Screen name="CreateExercise" component={CreateExerciseScreen} />
      <LibraryStack.Screen name="UploadVideo"    component={UploadVideoScreen} />
    </LibraryStack.Navigator>
  );
}

// ─── Schedule stack ───────────────────────────────────────────────────────────

function ScheduleStackNavigator() {
  return (
    <ScheduleStack.Navigator id="schedule" screenOptions={{ headerShown: false }}>
      <ScheduleStack.Screen name="ScheduleList" component={ScheduleScreen} />
      <ScheduleStack.Screen name="LiveClass"    component={LiveClassScreen} />
    </ScheduleStack.Navigator>
  );
}

// ─── Profile stack ────────────────────────────────────────────────────────────

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator id="profile" screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain"   component={ProfileScreen} />
      <ProfileStack.Screen name="Earnings"      component={EarningsScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
    </ProfileStack.Navigator>
  );
}

// ─── Auth stack ───────────────────────────────────────────────────────────────

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator id="auth" screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Splash"       component={SplashScreen} />
      <AuthStack.Screen name="Welcome"      component={WelcomeScreen} />
      <AuthStack.Screen name="Registration" component={RegistrationScreen} />
      <AuthStack.Screen name="OTP"          component={OTPScreen} />
      <AuthStack.Screen name="GymLinking"   component={GymLinkingScreen} />
    </AuthStack.Navigator>
  );
}

// ─── Main tab navigator ───────────────────────────────────────────────────────

function MainTabNavigator() {
  return (
    <Tab.Navigator id="main-tab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1A56DB',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: { paddingBottom: 8, height: 60 },
        tabBarIcon: ({ color, size, focused }) => {
          const iconMap: Record<string, { filled: string; outline: string }> = {
            Home:     { filled: 'home',              outline: 'home-outline' },
            Clients:  { filled: 'people',            outline: 'people-outline' },
            Library:  { filled: 'library',           outline: 'library-outline' },
            Schedule: { filled: 'calendar',          outline: 'calendar-outline' },
            Profile:  { filled: 'person-circle',     outline: 'person-circle-outline' },
          };
          const icons = iconMap[route.name] ?? { filled: 'ellipse', outline: 'ellipse-outline' };
          const iconName = focused ? icons.filled : icons.outline;
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"     component={DashboardScreen} />
      <Tab.Screen name="Clients"  component={ClientsStackNavigator} />
      <Tab.Screen name="Library"  component={LibraryStackNavigator} />
      <Tab.Screen name="Schedule" component={ScheduleStackNavigator} />
      <Tab.Screen name="Profile"  component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────

export default function TrainerNavigator() {
  return (
    <NavigationContainer>
      <RootStack.Navigator id="root" screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Auth" component={AuthStackNavigator} />
        <RootStack.Screen name="Main" component={MainTabNavigator} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
