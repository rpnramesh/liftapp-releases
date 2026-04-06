// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift — Member Navigator
// Bottom tabs: Home | Workouts | Progress | Profile
// Home stack: MemberHome → Membership
// Profile stack: MemberProfile → Membership
// Workout stack: Hub → ActiveWorkout → WorkoutFinish → WorkoutHistory
// ─────────────────────────────────────────────────────────────────────────────
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

// Screens
import MemberHomeScreen from '../screens/member/MemberHomeScreen';
import MemberMembershipScreen from '../screens/member/MemberMembershipScreen';
import MemberProfileScreen from '../screens/member/MemberProfileScreen';
import MemberProgressScreen from '../screens/member/MemberProgressScreen';
import ActiveWorkoutScreen from '../screens/member/workout/ActiveWorkoutScreen';
import WorkoutFinishScreen from '../screens/member/workout/WorkoutFinishScreen';
import WorkoutHistoryScreen from '../screens/member/workout/WorkoutHistoryScreen';
import WorkoutHubScreen from '../screens/member/workout/WorkoutHubScreen';

// Auth screens — reuse existing trainer auth
import OTPScreen from '../screens/auth/OTPScreen';
import RegistrationScreen from '../screens/auth/RegistrationScreen';
import SplashScreen from '../screens/auth/SplashScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';

import { useAuth } from '../context/AuthContext';

// ─── Colors ───────────────────────────────────────────────────────────────────
const ACTIVE_COLOR = '#4F8EF7';
const INACTIVE_COLOR = '#5A5F6B';
const TAB_BG = '#13151C';
const BORDER = '#2A2D38';

// ─── Stacks ───────────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const WorkoutStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="MemberHome" component={MemberHomeScreen} />
      <HomeStack.Screen name="Membership" component={MemberMembershipScreen} />
    </HomeStack.Navigator>
  );
}

function WorkoutStackNavigator() {
  return (
    <WorkoutStack.Navigator screenOptions={{ headerShown: false }}>
      <WorkoutStack.Screen name="WorkoutHub" component={WorkoutHubScreen} />
      <WorkoutStack.Screen
        name="ActiveWorkout"
        component={ActiveWorkoutScreen}
        options={{ gestureEnabled: false }} // prevent accidental swipe-back during workout
      />
      <WorkoutStack.Screen name="WorkoutFinish" component={WorkoutFinishScreen} />
      <WorkoutStack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
    </WorkoutStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="MemberProfile" component={MemberProfileScreen} />
      <ProfileStack.Screen name="Membership" component={MemberMembershipScreen} />
    </ProfileStack.Navigator>
  );
}

// ─── Main Member Tab Navigator ────────────────────────────────────────────────
function MemberTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: BORDER,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, [string, string]> = {
            Home: ['home', 'home-outline'],
            Workouts: ['barbell', 'barbell-outline'],
            Progress: ['trending-up', 'trending-up-outline'],
            Profile: ['person-circle', 'person-circle-outline'],
          };
          const [filledIcon, outlineIcon] = icons[route.name] || ['help', 'help-outline'];
          return (
            <Ionicons
              name={focused ? filledIcon : outlineIcon}
              size={22}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Workouts" component={WorkoutStackNavigator} />
      <Tab.Screen name="Progress" component={MemberProgressScreen} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

// ─── Auth Stack ───────────────────────────────────────────────────────────────
function MemberAuthStack() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Splash" component={SplashScreen} />
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Registration" component={RegistrationScreen} />
      <AuthStack.Screen name="OTP" component={OTPScreen} />
    </AuthStack.Navigator>
  );
}

// ─── Root navigator (for member) ─────────────────────────────────────────────
export default function MemberNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="MemberMain" component={MemberTabNavigator} />
        ) : (
          <RootStack.Screen name="MemberAuth" component={MemberAuthStack} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
