import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider, DefaultTheme, configureFonts } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/services/firebase';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import * as Updates from 'expo-updates';

import HomeScreen from './src/screens/HomeScreen';
import FormScreen from './src/screens/FormScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import AccountScreen from './src/screens/AccountScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const fontConfig = {
  fontFamily: 'Nunito_400Regular',
};

const theme = {
  ...DefaultTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...DefaultTheme.colors,
    primary: '#1A73E8',
    primaryContainer: '#D2E3FC',
    onPrimaryContainer: '#174EA6',
    surface: '#FFFFFF',
    surfaceVariant: '#F1F3F4',
    outline: '#5F6368',
  },
};

function CustomTabBar({ state, descriptors, navigation }) {
  const isHome = state.routes[state.index].name === 'Trang Chủ';

  return (
    <View style={{
      position: 'absolute',
      bottom: 28,
      left: 0,
      right: 0,
      alignItems: 'center',
    }}>
      {/* Nút + nổi bên phải màn hình (Chỉ hiện ở Trang Chủ) */}
      {isHome && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Form')}
          style={{
            position: 'absolute',
            right: 24,
            bottom: 67, // Đẩy nút cao hẳn lên trên
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#1A73E8',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
            elevation: 10,
            shadowColor: '#1A73E8',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}
        >
          <MaterialIcons name="add" size={30} color="#ffffff" />
        </TouchableOpacity>
      )}

      {/* Thanh pill navigation (nằm giữa) */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderRadius: 32,
        paddingHorizontal: 8,
        paddingVertical: 6,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      }}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const iconName = route.name === 'Trang Chủ' ? 'home' : 'person';
          const label = route.name === 'Trang Chủ' ? 'Home' : 'Account';

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(route.name)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: focused ? '#E8F0FE' : 'transparent',
                paddingHorizontal: focused ? 16 : 14,
                paddingVertical: 10,
                borderRadius: 24,
                marginHorizontal: 20,
              }}
            >
              <MaterialIcons name={iconName} size={20} color={focused ? '#1A73E8' : '#9AA0A6'} />
              {focused && (
                <Text style={{
                  marginLeft: 6,
                  color: '#1A73E8',
                  fontWeight: 'bold',
                  fontSize: 12,
                }}>
                  {label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Trang Chủ" component={HomeScreen} />
      <Tab.Screen name="Tài Khoản" component={AccountScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      if (initializing) setInitializing(false);
    });
    return unsubscribe;
  }, [initializing]);

  useEffect(() => {
    async function onFetchUpdateAsync() {
      if (__DEV__) return; // Không kiểm tra cập nhật khi đang ở môi trường Expo Go / Development
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.log('Lỗi cập nhật OTA:', error);
      }
    }
    onFetchUpdateAsync();
  }, []);

  if (initializing || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right'
            }}
          >
            {user ? (
              <>
                <Stack.Screen name="MainTabs" component={MainTabNavigator} />
                <Stack.Screen name="Form" component={FormScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
