import { BleManager } from 'react-native-ble-plx';

const manager = new BleManager();

export const startScan = (callback: any) => {
  manager.startDeviceScan(null, null, (error, device) => {
    if (error) return;
    if (device) callback(device);
  });
};

export const stopScan = () => {
  manager.stopDeviceScan();
};