// ============================================================
// App.tsx — Root component: navigation + app initialization
// ============================================================

import 'react-native-gesture-handler'; // must be first import
import './src/tasks/backgroundFetch';   // register task definition at startup

import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar, Text, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from './src/theme';
import { RootStackParamList, BottomTabParamList } from './src/types';

import HomeScreen from './src/screens/HomeScreen';
import DetailScreen from './src/screens/DetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import EditServerScreen from './src/screens/EditServerScreen';

import { requestPermissions } from './src/services/notifications';
import { registerBackgroundFetch } from './src/tasks/backgroundFetch';
import { loadSettings } from './src/services/storage';

// ──────────── Navigation ────────────────────────────────────

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

/** Dark navigation theme */
const DarkNavTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.accent,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.textPrimary,
    border: Colors.separator,
    notification: Colors.accent,
  },
};

/** Bottom tab navigator (Home + Settings) */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.separator,
          borderTopWidth: 1,
          height: Platform.OS === 'android' ? 60 : 80,
          paddingBottom: Platform.OS === 'android' ? 8 : 24,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: '대시보드',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>🖥</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: '설정',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>⚙</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ──────────── Root App ──────────────────────────────────────

export default function App() {
  useEffect(() => {
    (async () => {
      // Request notification permissions
      await requestPermissions();

      // Register background fetch with persisted interval
      const settings = await loadSettings();
      await registerBackgroundFetch(settings.pollingIntervalMinutes);
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <NavigationContainer theme={DarkNavTheme}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: Colors.background },
              gestureEnabled: true,
            }}
          >
            {/* Main tab screen */}
            <Stack.Screen name="Main" component={MainTabs} />

            {/* Modal-style screens pushed over tabs */}
            <Stack.Screen
              name="Detail"
              component={DetailScreen}
              options={{
                gestureDirection: 'horizontal',
                cardStyleInterpolator: ({ current, layouts }) => ({
                  cardStyle: {
                    transform: [
                      {
                        translateX: current.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [layouts.screen.width, 0],
                        }),
                      },
                    ],
                  },
                }),
              }}
            />
            <Stack.Screen name="EditServer" component={EditServerScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
