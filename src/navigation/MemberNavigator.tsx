// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Lift — Member Navigator
// Bottom tabs: Home | Workouts | Progress | Profile
// Workout stack: Hub → ActiveWorkout → WorkoutFinish → WorkoutHistory
// ─────────────────────────────────────────────────────────────────────────────
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Screens
import MemberHomeScreen from '../screens/member/MemberHomeScreen';
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
const WorkoutStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

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

// ─── Placeholder Profile screen ───────────────────────────────────────────────
function MemberProfileScreen() {
  const { logout } = useAuth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0B0F' }} edges={['top']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Text style={{ fontSize: 48 }}>👤</Text>
        <Text style={{ color: '#F1F3F9', fontSize: 20, fontWeight: '700' }}>Profile</Text>
        <Text
          style={{
            color: '#EF4444',
            fontSize: 15,
            fontWeight: '600',
            marginTop: 20,
            padding: 12,
            backgroundColor: 'rgba(239,68,68,0.12)',
            borderRadius: 10,
          }}
          onPress={() => logout()}
        >
          Sign Out
        </Text>
      </View>
    </SafeAreaView>
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
      <Tab.Screen name="Home" component={MemberHomeScreen} />
      <Tab.Screen name="Workouts" component={WorkoutStackNavigator} />
      <Tab.Screen name="Progress" component={MemberProgressScreen} />
      <Tab.Screen name="Profile" component={MemberProfileScreen} />
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
