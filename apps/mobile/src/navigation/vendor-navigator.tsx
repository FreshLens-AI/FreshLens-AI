import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AlertsScreen } from '../screens/alerts-screen';
import { ManualSaleScreen } from '../screens/manual-sale-screen';
import { VendorHomeScreen } from '../screens/vendor-home-screen';
import { ScanFlowScreen } from '../screens/scan-flow-screen';

export type VendorStackParamList = {
  Home: undefined;
  Scan: undefined;
  Sale: undefined;
  Alerts: undefined;
};

const Stack = createNativeStackNavigator<VendorStackParamList>();

export function VendorNavigator() {
  return (
    <NavigationContainer>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
