import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { VendorHomeScreen } from '../screens/vendor-home-screen';
import { ScanFlowScreen } from '../screens/scan-flow-screen';

export type VendorStackParamList = {
  Home: undefined;
  Scan: undefined;
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
