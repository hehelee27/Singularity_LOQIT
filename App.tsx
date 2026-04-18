import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  TextInput,
  Alert,
  StyleSheet,
  Image
} from 'react-native';

import { BleManager } from 'react-native-ble-plx';

export default function App() {
  const [manager] = useState(() => new BleManager());
  // Firebase Auth States
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // BLE States
  const [devices, setDevices] = useState<any[]>([]);
  const [trackedDevice, setTrackedDevice] = useState<any>(null);
  const [showOnlyLoqit, setShowOnlyLoqit] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLost, setIsLost] = useState(false);
  const [lastAlertedId, setLastAlertedId] = useState('');
  const [lostDevices, setLostDevices] = useState<any[]>([]);
  const [loqitUsers, setLoqitUsers] = useState<any[]>([]);
  // ---------------- AUTH ----------------
  useEffect(() => {
    if (!isLost || !user?.email) return;

    const intervalId = setInterval(() => {
      rotateToken();
    }, 15 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [isLost, user?.email]);

  const rotateToken = async () => {
    const newToken = generateToken();

    const { error } = await supabase
      .from('devices')
      .update({
        current_token: newToken,
        token_updated_at: new Date().toISOString(),
      })
      .eq('email', user.email);

    if (error) {
      console.log(error);
    }
  };
  const handleSignup = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Enter email and password');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      Alert.alert('Signup Error', error.message);
    } else {
      Alert.alert('Success', 'Account created. Please login.');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Enter email and password');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      Alert.alert('Login Error', error.message);
      return;
    }

    if (data?.user) {
      setUser(data.user);
      await registerDevice(data.user);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Logout Error', error.message);
      return;
    }

    manager.stopDeviceScan();

    setUser(null);
    setDevices([]);
    setTrackedDevice(null);
    setIsScanning(false);
    setIsLost(false);

    Alert.alert('LOQit', 'Logged out successfully');
  };

  const registerDevice = async (currentUser: any) => {
    const { data: existing, error: fetchError } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    console.log('fetchError:', fetchError);

    if (!existing) {
      const deviceId =
        'LOQIT_' +
        Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data, error } = await supabase
        .from('devices')
        .insert([
          {
            user_id: currentUser.id,
            email: currentUser.email,
            device_id: deviceId,
            is_lost: false,
          },
        ]);

      console.log('insert data:', data);
      console.log('insert error:', error);
    }
  };

  const generateToken = () => {
    return Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
  };

  const markAsLost = async () => {
    if (!user) {
      Alert.alert('LOQit', 'Please login first');
      return;
    }

    const { data: row, error: fetchError } = await supabase
      .from('devices')
      .select('id, device_id, email')
      .eq('email', user.email)
      .maybeSingle();

    if (fetchError) {
      Alert.alert('Error', fetchError.message);
      return;
    }

    if (!row) {
      Alert.alert('LOQit', 'No registered device found');
      return;
    }

    const newToken = generateToken();

    const { error: updateError } = await supabase
      .from('devices')
      .update({
        is_lost: true,
        current_token: newToken,
        token_updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (updateError) {
      Alert.alert('Update Error', updateError.message);
      return;
    }

    setIsLost(true);

    Alert.alert(
      'LOQit',
      `Device marked lost.\nSecurity Token: ${newToken}`
    );
  };
  const markAsFound = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('devices')
      .update({
        is_lost: false,
        current_token: null,
      })
      .eq('email', user.email);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setIsLost(false);

    Alert.alert(
      'LOQit',
      'Device marked as found'
    );
  };
  // ---------------- BLE ----------------
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);

      const accessFineGranted = result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
      const bluetoothScanGranted = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
      const bluetoothConnectGranted = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;

      if (!accessFineGranted || !bluetoothScanGranted || !bluetoothConnectGranted) {
        Alert.alert('Permissions', 'Location and Bluetooth permissions required for scanning.');
        return false;
      }
      return true;
    }
    return true;
  };

  const checkLostDevice = async (device: any) => {
    const values = [
      device.name,
      device.localName,
      device.id,
    ]
      .filter(Boolean)
      .map((v) => String(v).toUpperCase());

    const match = lostDevices.find((item: any) =>
      values.includes(
        String(item.current_token).toUpperCase()
      )
    );

    if (match && lastAlertedId !== match.device_id) {
      setLastAlertedId(match.device_id);

      await supabase.from('sightings').insert([
        {
          device_id: match.device_id,
          detected_by: user?.email,
          rssi: device.rssi,
        },
      ]);

      Alert.alert(
        '🚨 LOQit Alert',
        'Lost LOQit device detected nearby!'
      );
    }
  };

  const loadLostDevices = async () => {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('is_lost', true);

    if (!error && data) {
      setLostDevices(data);
    }
  };

  const loadLoqitUsers = async () => {
    const { data, error } = await supabase
      .from('devices')
      .select('*');

    if (!error && data) {
      setLoqitUsers(data);
    }
  };

  const scanDevices = async () => {
    if (isScanning) {
      console.log('Already scanning');
      return;
    }

    try {
      setIsScanning(true);
      setDevices([]);

      const permsOk = await requestPermissions();
      if (!permsOk) {
        setIsScanning(false);
        return;
      }

      await loadLoqitUsers();

      await loadLostDevices();

      const state = await manager.state();

      if (state !== 'PoweredOn') {
        Alert.alert('Bluetooth', 'Turn Bluetooth ON');
        setIsScanning(false);
        return;
      }

      manager.stopDeviceScan();

      setTimeout(() => {
        manager.startDeviceScan(
          null,
          { allowDuplicates: false },
          (error, device) => {
            if (error) {
              setIsScanning(false);
              return;
            }

            if (device) {
              checkLostDevice(device);

              setDevices((prev) => {
                const exists = prev.find(
                  (d) => d.id === device.id
                );

                if (exists) return prev;

                return [...prev, device];
              });
            }
          }
        );
      }, 1000);
    } catch (e) {
      console.log(e);
      setIsScanning(false);
    }
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

  // ---------------- LOGIN SCREEN ----------------
  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 20,
          backgroundColor: '#111827',
        }}
      >
        <Image
          source={require("./assets/logo.png")}
          style={{
            position: 'absolute',
            width: 320,
            height: 320,
            alignSelf: 'center',
            top: 10,
            opacity: 1,
          }}
          resizeMode="contain"
        />
        <Text
          style={{
            fontSize: 32,
            fontWeight: 'bold',
            color: '#ffffff',
            marginBottom: 20,
            top: 10,
            textAlign: 'center',
          }}
        >
          Welcome to LOQit
        </Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          style={styles.input}
          selectionColor="#2563eb"
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          selectionColor="#2563eb"
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>

        <View style={{ height: 10 }} />
        <TouchableOpacity style={styles.buttonDark} onPress={handleSignup}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------------- TRACKER SCREEN ----------------
  const isLoqitUser = (device: any) => {
    const name =
      device.name ||
      device.localName ||
      device.id ||
      '';

    return loqitUsers.some((item: any) =>
      name.includes(item.device_id)
    );
  };

  const isLostNearby = (device: any) => {
    const name =
      device.name ||
      device.localName ||
      device.id ||
      '';

    return lostDevices.some(
      (item: any) =>
        item.current_token === name ||
        item.current_token === device.id
    );
  };
  
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#ffffff',
        paddingTop: 50,
        paddingHorizontal: 16,
      }}
    >
      <Text
        style={{
          fontSize: 30,
          fontWeight: 'bold',
          color: '#4e83ff',
          marginBottom: 10,
        }}
      >
        LOQit Tracker
      </Text>

      <Text style={{ color: '#94a3b8', marginBottom: 10 }}>
        Logged in as: {user?.email}
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
        <TouchableOpacity style={styles.button} onPress={scanDevices}>
          <Text style={styles.buttonText}>Start Scan</Text>
        </TouchableOpacity>
        <View style={{ height: 10 }} />
        <TouchableOpacity style={styles.buttonRed} onPress={stopScan}>
          <Text style={styles.buttonText}>Stop Scan</Text>
        </TouchableOpacity>
        <View style={{ height: 10 }} />
        <TouchableOpacity style={styles.buttonDark} onPress={handleLogout}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
        <View style={{ height: 10 }} />
        <TouchableOpacity
          style={isLost ? styles.buttonDark : styles.buttonRed}
          onPress={isLost ? markAsFound : markAsLost}
        >
          <Text style={styles.buttonText}>
            {isLost ? 'Mark as Found' : 'Mark as Lost'}
          </Text>
        </TouchableOpacity>
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
            Device: {trackedDevice.name ||
              trackedDevice.localName ||
              'Unnamed Device'}
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

      {isLost && (
        <View
          style={{
            backgroundColor: '#7f1d1d',
            padding: 14,
            borderRadius: 12,
            marginTop: 15,
          }}
        >
          <Text
            style={{
              color: 'white',
              fontWeight: 'bold',
              fontSize: 16,
            }}
          >
            🚨 DEVICE MARKED AS LOST
          </Text>

          <Text style={{ color: '#fecaca', marginTop: 4 }}>
            Community tracking active
          </Text>
        </View>
      )}

      <View style={{ marginTop: 20 }}>
        <TouchableOpacity
          style={styles.buttonDark}
          onPress={() => setShowOnlyLoqit(!showOnlyLoqit)}
        >
          <Text style={styles.buttonText}>
            {showOnlyLoqit
              ? 'Show All Devices'
              : 'Show LOQit Users Only'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text
        style={{
          color: '#0f172a',
          marginTop: 12,
          fontSize: 18,
          fontWeight: 'bold',
        }}
      >
        Nearby Devices ({devices.length})
      </Text>

      <FlatList
        style={{ marginTop: 10 }}
        data={[...devices]
          .filter((item) => {
            if (!showOnlyLoqit) return true;

            return (
              isLoqitUser(item) ||
              isLostNearby(item)
            );

          })
          .sort((a, b) => {
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
                trackedDevice?.id === item.id
                  ? '#2563eb'
                  : '#1e293b',
              padding: 14,
              borderRadius: 10,
              marginBottom: 10,
              borderWidth:
                trackedDevice?.id === item.id ? 2 : 0,
              borderColor: '#60a5fa',
            }}
          >
            <Text
              style={{
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: 16,
              }}
            >
              {item.name ||
                item.localName ||
                `Unknown Device ${index + 1}`}
            </Text>

            {isLostNearby(item) ? (
              <Text
                style={{
                  color: 'red',
                  fontWeight: 'bold',
                  marginTop: 4,
                }}
              >
                🚨 Lost Device Nearby
              </Text>
            ) : isLoqitUser(item) ? (
              <Text
                style={{
                  color: '#22c55e',
                  fontWeight: 'bold',
                  marginTop: 4,
                }}
              >
                🟢 LOQit User
              </Text>
            ) : null}

            {trackedDevice?.id === item.id && (
              <Text
                style={{
                  color: '#bfdbfe',
                  marginTop: 4,
                }}
              >
                Currently Tracking
              </Text>
            )}

            <Text
              style={{
                color: '#94a3b8',
                marginTop: 4,
              }}
            >
              RSSI: {item.rssi}
            </Text>

            <Text
              style={{
                color: '#22c55e',
                marginTop: 2,
              }}
            >
              {getStatus(item.rssi)}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );  
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  buttonRed: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  buttonDark: {
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    color: '#000000',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 16,
  },
});
