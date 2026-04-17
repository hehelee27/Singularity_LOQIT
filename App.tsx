import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  FlatList,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';

const manager = new BleManager();

export default function App() {
  const [devices, setDevices] = useState<any[]>([]);
  const [trackedDevice, setTrackedDevice] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
    }
  };

  const scanDevices = async () => {
    setIsScanning(true);
    await requestPermissions();
    setDevices([]);

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) return;

      if (device) {
        setDevices((prev) => {
          const exists = prev.find((d) => d.id === device.id);

          if (exists) {
            return prev.map((d) =>
              d.id === device.id ? device : d
            );
          }

          return [...prev, device];
        });

        if (trackedDevice?.id === device.id) {
          setTrackedDevice(device);
        }
      }
    });
  };

  const stopScan = () => {
    manager.stopDeviceScan();
    setIsScanning(false);
  };

  const getStatus = (rssi: number) => {
    if (rssi > -55) return 'Very Close';
    if (rssi > -70) return 'Nearby';
    return 'Far';
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0f172a',
        paddingTop: 50,
        paddingHorizontal: 16,
      }}
    >
      <Text
        style={{
          fontSize: 30,
          fontWeight: 'bold',
          color: 'white',
          marginBottom: 15,
        }}
      >
        LOQit Tracker
      </Text>

      <Text
        style={{
          color: isScanning ? '#22c55e' : '#ef4444',
          marginBottom: 10,
          fontWeight: 'bold',
        }}
>
  Status: {isScanning ? 'Scanning...' : 'Stopped'}
</Text>

      <View>
        <Button title="Start Scan" onPress={scanDevices} />
        <View style={{ height: 10 }} />
        <Button title="Stop Scan" onPress={stopScan} />
      </View>

      {trackedDevice && (
        <View
          style={{
            backgroundColor: '#1e293b',
            padding: 15,
            borderRadius: 12,
            marginTop: 20,
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
            Active Tracking
          </Text>

          <Text style={{ color: 'white', marginTop: 8 }}>
            Device: {trackedDevice.name || trackedDevice.localName || 'Unnamed Device'}
          </Text>

          <Text style={{ color: '#38bdf8', marginTop: 5 }}>
            RSSI: {trackedDevice.rssi}
          </Text>

          <Text style={{ color: '#22c55e', marginTop: 5 }}>
            Status: {getStatus(trackedDevice.rssi)}
          </Text>

          {trackedDevice.rssi <= -75 && (
            <Text
              style={{
                color: '#ef4444',
                fontWeight: 'bold',
                marginTop: 8,
              }}
            >
              ALERT: Device moving away!
            </Text>
          )}
        </View>
      )}

      <Text
        style={{
          color: 'white',
          marginTop: 20,
          fontSize: 18,
          fontWeight: 'bold',
        }}
      >
        Nearby Devices ({devices.length})
      </Text>

      <FlatList
        style={{ marginTop: 10 }}
        data={[...devices].sort((a, b) => {
          const aNamed = a.name || a.localName;
          const bNamed = b.name || b.localName;

          if (aNamed && !bNamed) return -1;
          if (!aNamed && bNamed) return 1;
          
          return (b.rssi || -999) - (a.rssi || -999);
        })}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            onPress={() => setTrackedDevice(item)}
            style={{
              backgroundColor:
                trackedDevice?.id === item.id ? '#2563eb' : '#1e293b',
              padding: 14,
              borderRadius: 10,
              marginBottom: 10,
              borderWidth: trackedDevice?.id === item.id ? 2 : 0,
              borderColor: '#60a5fa',
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>
              {item.name || item.localName || `Unknown Device ${index + 1}`}
            </Text>

            {trackedDevice?.id === item.id && (
              <Text style={{ color: '#bfdbfe', marginTop: 4 }}>
                Currently Tracking
              </Text>
            )}

            <Text style={{ color: '#94a3b8', marginTop: 4 }}>
              RSSI: {item.rssi}
            </Text>

            <Text style={{ color: '#22c55e', marginTop: 2 }}>
              {getStatus(item.rssi)}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
} 