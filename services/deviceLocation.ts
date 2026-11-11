import * as Location from 'expo-location';
import { resolveForegroundLocation } from './foregroundLocation';

export function getForegroundLocation() {
  return resolveForegroundLocation({
    requestPermission: () => Location.requestForegroundPermissionsAsync(),
    servicesEnabled: () => Location.hasServicesEnabledAsync(),
    currentPosition: () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false }),
  });
}
