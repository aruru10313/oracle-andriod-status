// ============================================================
// App.tsx — Root component: navigation + app initialization
// Premium 2025/2026 redesign: boot splash animation added
// ============================================================

import 'react-native-gesture-handler'; // must be first import
import './src/tasks/backgroundFetch';   // register task definition at startup

import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  StatusBar,
  Text,
  Platform,
  View,
  Animated,
  StyleSheet,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from './src/theme';
import { RootStackParamList, BottomTabParamList } from './src/types';

import HomeScreen from './src/screens/HomeScreen';
import DetailScreen from './src/screens/DetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import EditServerScreen from './src/screens/EditServerScreen';
import TerminalScreen from './src/screens/TerminalScreen';

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

import { Feather } from '@expo/vector-icons';

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
            <Feather name="server" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: '설정',
          tabBarIcon: ({ color }) => (
            <Feather name="settings" size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ──────────── Splash Screen ──────────────────────────────────

/**
 * SplashScreen — boot animation inspired by Electron app's 'root1' text.
 * Shows 'root1' with a fade+scale-in, holds briefly, then fades out.
 * Calls onDone() when the exit animation finishes.
 */
const SplashScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  // Opacity for the whole splash view (entry + exit)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // Scale for the text (subtle grow-in effect)
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  // Opacity for the accent dot/cursor blink under the text
  const cursorAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Cursor blink loop
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(cursorAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    blink.start();

    // Fade + scale in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Hold for ~1.8s, then fade out
      setTimeout(() => {
        blink.stop();
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          onDone();
        });
      }, 1800);
    });
  }, []);

  return (
    <Animated.View style={[splashStyles.root, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Animated.View style={[splashStyles.content, { transform: [{ scale: scaleAnim }] }]}>
        {/* Main wordmark */}
        <Text style={splashStyles.wordmark}>root1</Text>
        {/* Blinking cursor/accent dot below text */}
        <Animated.View style={[splashStyles.cursor, { opacity: cursorAnim }]} />
        {/* Subtitle */}
        <Text style={splashStyles.subtitle}>Oracle Monitor</Text>
      </Animated.View>
    </Animated.View>
  );
};

const splashStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  content: {
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 52,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cursor: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    marginTop: 10,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
});

// ──────────── Root App ──────────────────────────────────────

export default function App() {
  // Controls whether the splash is showing
  const [isSplashDone, setIsSplashDone] = useState(false);

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

        {/* Main app — rendered behind splash, becomes visible once splash exits */}
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
            <Stack.Screen name="Terminal" component={TerminalScreen} />
          </Stack.Navigator>
        </NavigationContainer>

        <Toast config={toastConfig} />

        {/* Splash overlay — mounted on top, unmounts after animation */}
        {!isSplashDone && (
          <SplashScreen onDone={() => setIsSplashDone(true)} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ──────────── Custom Toast UI ────────────────────────────────
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';

const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: Colors.online, backgroundColor: Colors.surfaceElevated, borderRadius: 14, borderLeftWidth: 4, marginTop: 10 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 15, fontWeight: 'bold', color: Colors.textPrimary }}
      text2Style={{ fontSize: 13, color: Colors.textSecondary }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: Colors.danger, backgroundColor: Colors.surfaceElevated, borderRadius: 14, borderLeftWidth: 4, marginTop: 10 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 15, fontWeight: 'bold', color: Colors.textPrimary }}
      text2Style={{ fontSize: 13, color: Colors.textSecondary }}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: Colors.accent, backgroundColor: Colors.surfaceElevated, borderRadius: 14, borderLeftWidth: 4, marginTop: 10 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 15, fontWeight: 'bold', color: Colors.textPrimary }}
      text2Style={{ fontSize: 13, color: Colors.textSecondary }}
    />
  )
};
