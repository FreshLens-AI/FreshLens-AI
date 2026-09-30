import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef } from 'react';

import { registerForPushNotifications } from '../lib/push/register';
import { routeForNotification } from '../lib/push/route';

import { AlertsScreen } from '../screens/alerts-screen';
import { ManualSaleScreen } from '../screens/manual-sale-screen';
import { ScanFlowScreen } from '../screens/scan-flow-screen';
import { ScanHistoryScreen } from '../screens/scan-history-screen';
import { VendorHomeScreen } from '../screens/vendor-home-screen';

export type VendorStackParamList = {
  Home: undefined;
  Scan: undefined;
  Sale: undefined;
  Alerts: undefined;
  History: undefined;
};

const Stack = createNativeStackNavigator<VendorStackParamList>();

export const navigationRef = createNavigationContainerRef<VendorStackParamList>();

// Mounted only while a vendor is signed in: register this device's push token
// once per session and open the matching screen when a push is tapped.
function usePushNotifications() {
  const pending = useRef<unknown>(null);

  const open = useCallback((data: unknown) => {
    const route = routeForNotification(data);
    if (!route) return;
    if (navigationRef.isReady()) navigationRef.navigate(route);
    else pending.current = data;
  }, []);

  useEffect(() => {
    void registerForPushNotifications();

    // Cold start: the app was launched by tapping a notification.
    const launch = Notifications.getLastNotificationResponse();
    if (launch) open(launch.notification.request.content.data);

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => open(response.notification.request.content.data),
    );
    return () => subscription.remove();
  }, [open]);

  return useCallback(() => {
    if (pending.current === null) return;
    const data = pending.current;
    pending.current = null;
    open(data);
  }, [open]);
}

export function VendorNavigator() {
  const flushPendingNotification = usePushNotifications();

  return (
    <NavigationContainer ref={navigationRef} onReady={flushPendingNotification}>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={VendorHomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Scan"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        >
          {({ navigation }) => (
            <ScanFlowScreen onDone={() => navigation.navigate('Home')} />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Sale"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        >
          {({ navigation }) => (
            <ManualSaleScreen onDone={() => navigation.navigate('Home')} />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Alerts"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        >
          {({ navigation }) => (
            <AlertsScreen onDone={() => navigation.navigate('Home')} />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="History"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        >
          {({ navigation }) => (
            <ScanHistoryScreen onDone={() => navigation.navigate('Home')} />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
