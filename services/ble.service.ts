import { PermissionsAndroid, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import {
  getAdvertisingData,
  setServices,
  startAdvertising,
  stopAdvertising,
} from 'munim-bluetooth-peripheral'

import { supabase } from '../lib/supabase'

type FoundCallback = (beaconId: string, rssi: number) => void

export const APP_SERVICE_UUID = '5P0R5000-0000-0000-0000-000000000000'
const BLE_DEVICE_UUID_STORAGE_KEY = 'loqit_ble_device_uuid'
const BLE_BROADCASTING_MODE_STORAGE_KEY = 'loqit_ble_broadcasting_mode'
const BLE_BEACON_NAME_PREFIX = 'LOQIT-'
const BLE_MANUFACTURER_PREFIX = 'LOQIT:'
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const REPORT_COOLDOWN_MS = 30000
const reportCooldown = new Map<string, number>()
const VALID_SERVICE_UUID_RE = /^([0-9a-f]{4}|[0-9a-f]{8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

function toNativeBleServiceUuid(value: string) {
  // BLE UUIDs must be hex. Keep the LOQIT mnemonic constant while mapping it for platform APIs.
  const mapped = value.replace(/p/gi, 'a').replace(/r/gi, 'f').toLowerCase()
  if (!VALID_SERVICE_UUID_RE.test(mapped)) {
    throw new Error('Invalid APP_SERVICE_UUID configuration for BLE advertising/scanning.')
  }

  return mapped
}

const APP_SERVICE_UUID_NATIVE = toNativeBleServiceUuid(APP_SERVICE_UUID)
const scanServiceUuids = [APP_SERVICE_UUID_NATIVE]

function encodeBase64Ascii(value: string) {
  let output = ''

  for (let i = 0; i < value.length; i += 3) {
    const b1 = value.charCodeAt(i) & 0xff
    const b2 = i + 1 < value.length ? value.charCodeAt(i + 1) & 0xff : Number.NaN
    const b3 = i + 2 < value.length ? value.charCodeAt(i + 2) & 0xff : Number.NaN

    const chunk = (b1 << 16) | ((Number.isNaN(b2) ? 0 : b2) << 8) | (Number.isNaN(b3) ? 0 : b3)

    output += BASE64_CHARS[(chunk >> 18) & 63]
    output += BASE64_CHARS[(chunk >> 12) & 63]
    output += Number.isNaN(b2) ? '=' : BASE64_CHARS[(chunk >> 6) & 63]
    output += Number.isNaN(b3) ? '=' : BASE64_CHARS[chunk & 63]
  }

  return output
}

function decodeBase64Ascii(value: string) {
  const clean = value.replace(/[^A-Za-z0-9+/=]/g, '')
  let output = ''

  for (let i = 0; i < clean.length; i += 4) {
    const c1 = BASE64_CHARS.indexOf(clean[i] ?? 'A')
    const c2 = BASE64_CHARS.indexOf(clean[i + 1] ?? 'A')
    const c3Raw = clean[i + 2] ?? '='
    const c4Raw = clean[i + 3] ?? '='
    const c3 = c3Raw === '=' ? 0 : BASE64_CHARS.indexOf(c3Raw)
    const c4 = c4Raw === '=' ? 0 : BASE64_CHARS.indexOf(c4Raw)

    if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) {
      throw new Error('Invalid base64 input')
    }

    const chunk = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4

    output += String.fromCharCode((chunk >> 16) & 0xff)
    if (c3Raw !== '=') {
      output += String.fromCharCode((chunk >> 8) & 0xff)
    }
    if (c4Raw !== '=') {
      output += String.fromCharCode(chunk & 0xff)
    }
  }

  return output
}

function encodeBase64(value: string) {
  const maybeBtoa = (globalThis as { btoa?: (input: string) => string }).btoa
  if (typeof maybeBtoa === 'function') {
    return maybeBtoa(value)
  }

  return encodeBase64Ascii(value)
}

function decodeBase64(value: string) {
  const maybeAtob = (globalThis as { atob?: (input: string) => string }).atob
  if (typeof maybeAtob === 'function') {
    return maybeAtob(value)
  }

  return decodeBase64Ascii(value)
}

type ForegroundServiceModule = {
  createNotificationChannel?: (config: {
    id: string
    name: string
    description?: string
    importance?: number
    enableVibration?: boolean
  }) => Promise<unknown> | unknown
  startService?: (config: {
    channelId: string
    id: number
    title: string
    text: string
    icon: string
    button?: string
    priority?: number
  }) => Promise<unknown> | unknown
  stopService?: () => Promise<unknown> | unknown
}

class BLEService {
  private manager: {
    startDeviceScan: (
      uuids: string[] | null,
      options: { allowDuplicates?: boolean } | null,
      listener: (error: unknown, device: { localName?: string | null; name?: string | null; rssi?: number | null; serviceUUIDs?: string[] | null; manufacturerData?: string | null } | null) => void
    ) => void
    stopDeviceScan: () => void
    state?: () => Promise<string>
    destroy?: () => void
  } | null = null
  private foregroundService: ForegroundServiceModule | null = null

  private recentlySeen = new Map<string, number>()
  private broadcastingMode: boolean | null = null

  constructor() {
    try {
      const bleModule = require('react-native-ble-plx')
      if (bleModule?.BleManager) {
        this.manager = new bleModule.BleManager()
      }
    } catch {
      this.manager = null
    }

    try {
      const foregroundServiceModule = require('@voximplant/react-native-foreground-service')
      this.foregroundService = (foregroundServiceModule?.default ?? foregroundServiceModule) as ForegroundServiceModule
    } catch {
      this.foregroundService = null
    }
  }

  private async ensureForegroundLocationPermission() {
    const current = await Location.getForegroundPermissionsAsync()
    if (current.status === 'granted') {
      return true
    }

    const requested = await Location.requestForegroundPermissionsAsync()
    return requested.status === 'granted'
  }

  private async ensureBackgroundLocationPermission() {
    if (Platform.OS !== 'android' || Platform.Version < 29) {
      return true
    }

    const existing = await Location.getBackgroundPermissionsAsync()
    if (existing.status === 'granted') {
      return true
    }

    const requested = await Location.requestBackgroundPermissionsAsync()
    return requested.status === 'granted'
  }

  private async getBroadcastingMode() {
    if (typeof this.broadcastingMode === 'boolean') {
      return this.broadcastingMode
    }

    const stored = await AsyncStorage.getItem(BLE_BROADCASTING_MODE_STORAGE_KEY)
    this.broadcastingMode = stored === '1'
    return this.broadcastingMode
  }

  private async setBroadcastingMode(enabled: boolean) {
    this.broadcastingMode = enabled
    await AsyncStorage.setItem(BLE_BROADCASTING_MODE_STORAGE_KEY, enabled ? '1' : '0')
  }

  async isBroadcastingMode() {
    return this.getBroadcastingMode()
  }

  async requestScanPermissions() {
    const locationGranted = await this.ensureForegroundLocationPermission()
    await this.ensureBackgroundLocationPermission()

    let bluetoothGranted = true
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const requested = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ])

        bluetoothGranted =
          requested[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          requested[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
          requested[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
      } else {
        const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
        bluetoothGranted = fine === PermissionsAndroid.RESULTS.GRANTED
      }
    }

    return locationGranted && bluetoothGranted
  }

  private async ensureBluetoothPoweredOn() {
    if (!this.manager?.state) {
      return
    }

    const state = await this.manager.state()
    if (state !== 'PoweredOn') {
      throw new Error('Bluetooth is off. Please turn on Bluetooth and try again.')
    }
  }

  async requestBroadcastPermissions() {
    if (Platform.OS !== 'android') {
      return true
    }

    if (Platform.Version < 31) {
      return true
    }

    const permissionsToRequest = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]

    if (Platform.Version >= 33 && PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
    }

    const requested = await PermissionsAndroid.requestMultiple(permissionsToRequest)

    const notificationPermissionGranted =
      Platform.Version < 33 ||
      !PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS ||
      requested[PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS] === PermissionsAndroid.RESULTS.GRANTED

    return (
      requested[PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE] === PermissionsAndroid.RESULTS.GRANTED &&
      requested[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
      notificationPermissionGranted
    )
  }

  private async startForegroundBeaconService() {
    if (Platform.OS !== 'android') {
      return
    }

    if (!this.foregroundService?.startService) {
      return
    }

    try {
      if (this.foregroundService.createNotificationChannel) {
        await Promise.resolve(
          this.foregroundService.createNotificationChannel({
            id: 'loqit-ble-beacon',
            name: 'LOQIT BLE Beacon',
            description: 'Keeps LOQIT device beacon active in background',
            importance: 2,
            enableVibration: false,
          })
        )
      }

      await Promise.resolve(
        this.foregroundService.startService({
          channelId: 'loqit-ble-beacon',
          id: 5001,
          title: 'LOQIT protection active',
          text: 'Broadcasting your encrypted device beacon in background',
          icon: 'ic_launcher',
          button: 'Open LOQIT',
          priority: -1,
        })
      )
    } catch (error) {
      console.error('[LOQIT] Foreground service start failed:', error)
      // Don't rethrow - allow app to continue without foreground service
    }
  }

  private async stopForegroundBeaconService() {
    if (!this.foregroundService?.stopService) {
      return
    }

    await Promise.resolve(this.foregroundService.stopService())
  }

  private getAdvertiseErrorMessage(error: unknown) {
    if (typeof error === 'number') {
      if (error === 5) {
        return 'BLE advertising is not supported on this device hardware.'
      }

      return `Unable to start BLE advertising (code ${error}).`
    }

    const maybeObject = error as { code?: number; message?: string } | null
    if (typeof maybeObject?.code === 'number') {
      if (maybeObject.code === 5) {
        return 'BLE advertising is not supported on this device hardware.'
      }

      if (maybeObject.message) {
        return maybeObject.message
      }

      return `Unable to start BLE advertising (code ${maybeObject.code}).`
    }

    if (error instanceof Error && error.message) {
      return error.message
    }

    return 'Unable to start BLE advertising on this device.'
  }

  async setStoredBleDeviceUuid(bleDeviceUuid: string) {
    const normalized = this.normalizeBleUuid(bleDeviceUuid)
    if (!normalized) {
      throw new Error('Invalid BLE device UUID.')
    }

    await AsyncStorage.setItem(BLE_DEVICE_UUID_STORAGE_KEY, normalized)
  }

  private async getStoredBleDeviceUuid() {
    const value = await AsyncStorage.getItem(BLE_DEVICE_UUID_STORAGE_KEY)
    return this.normalizeBleUuid(value)
  }

  async scanForLOQITDevices(onDeviceFound: FoundCallback) {
    const broadcasting = await this.getBroadcastingMode()
    if (broadcasting) {
      throw new Error('Broadcast mode is active on this device. Scanning is disabled for lost-owner mode.')
    }

    this.stopScan()

    const granted = await this.requestScanPermissions()
    if (!granted) {
      throw new Error('Location and bluetooth permissions are required for scanning.')
    }

    if (!this.manager) {
      throw new Error('BLE manager is not available. Please ensure Bluetooth is enabled.')
    }

    await this.ensureBluetoothPoweredOn()

    console.log('[LOQIT-SCAN] Starting BLE scan. Filtering for service UUIDs:', scanServiceUuids)

    this.manager.startDeviceScan(scanServiceUuids, { allowDuplicates: false }, (error, device) => {
      if (error || !device) {
        if (error) {
          console.log('[LOQIT-SCAN] BLE scan error', error)
        }

        this.stopScan()
        return
      }

      const deviceName = device.localName ?? device.name ?? 'unnamed'
      const serviceUUIDs = device.serviceUUIDs ?? []
      console.log(`[LOQIT-SCAN] Found LOQIT device: ${deviceName} | Services: ${JSON.stringify(serviceUUIDs)} | RSSI: ${device.rssi}`)

      // Try to extract UUID from manufacturer data or beacon name (legacy)
      let bleDeviceUuid = this.readBleUuidFromAdvertisement(device)

      // If no UUID from advertisement data, check GATT service characteristics
      // The service UUID filter already ensures this is a LOQIT device
      if (!bleDeviceUuid && serviceUUIDs.length > 0) {
        // Find a characteristic UUID that looks like a device UUID (not the LOQIT app service UUID)
        for (const svcUuid of serviceUUIDs) {
          const normalized = this.normalizeBleUuid(svcUuid)
          if (normalized && normalized !== APP_SERVICE_UUID_NATIVE) {
            bleDeviceUuid = normalized
            break
          }
        }
      }

      const rssi = typeof device.rssi === 'number' ? device.rssi : -96

      if (!bleDeviceUuid) {
        // Device is definitely LOQIT (filtered by service UUID) but UUID not in ad packet
        // Query Supabase for any lost device as this is likely the one broadcasting
        console.log('[LOQIT-SCAN] LOQIT device found via service UUID – querying Supabase for lost devices')
        void this.findAndReportLOQITDevice(rssi, onDeviceFound)
        return
      }

      console.log(`[LOQIT-SCAN] ✅ Matched LOQIT device! UUID: ${bleDeviceUuid}`)

      const now = Date.now()
      const cooldown = this.recentlySeen.get(bleDeviceUuid)
      if (cooldown && now - cooldown < 4500) {
        return
      }

      this.recentlySeen.set(bleDeviceUuid, now)
      onDeviceFound(bleDeviceUuid, rssi)
      void this.reportDetectedLostDevice(bleDeviceUuid, rssi).catch(() => {
        // Ignore reporting failures; scanning must continue.
      })
    })
  }

  private async findAndReportLOQITDevice(rssi: number, onDeviceFound: FoundCallback) {
    const cooldownKey = '__loqit_service_scan__'
    const now = Date.now()
    const lastSeen = this.recentlySeen.get(cooldownKey)
    if (lastSeen && now - lastSeen < 4500) {
      return
    }
    this.recentlySeen.set(cooldownKey, now)

    try {
      const { data, error: queryError } = await supabase
        .from('devices')
        .select('ble_device_uuid, status')
        .eq('status', 'lost')
        .not('ble_device_uuid', 'is', null)
        .limit(10)

      if (queryError) {
        console.log('[LOQIT-SCAN] Supabase query error:', queryError.message)
        return
      }

      if (data && data.length > 0) {
        for (const row of data) {
          const uuid = this.normalizeBleUuid((row as { ble_device_uuid: string | null }).ble_device_uuid)
          if (uuid) {
            console.log(`[LOQIT-SCAN] ✅ Found lost device from Supabase: ${uuid}`)
            onDeviceFound(uuid, rssi)
            // Auto-report location to the device owner
            void this.reportDetectedLostDevice(uuid, rssi).catch(() => {
              // Ignore location report failures; scanning must continue.
            })
            return
          }
        }
      }
      console.log('[LOQIT-SCAN] No lost devices found in Supabase')
    } catch (err) {
      console.log('[LOQIT-SCAN] Supabase lookup failed:', err)
    }
  }

  stopScan() {
    this.recentlySeen.clear()

    if (this.manager) {
      this.manager.stopDeviceScan()
    }
  }

  async startBroadcasting(bleDeviceUuid: string) {
    await this.stopBroadcasting()

    const locationGranted = await this.ensureForegroundLocationPermission()
    if (!locationGranted) {
      throw new Error('Location permission is required to activate lost mode beacon.')
    }

    const broadcastGranted = await this.requestBroadcastPermissions()
    if (!broadcastGranted) {
      throw new Error('Bluetooth advertise/connect and notification permissions are required for BLE background broadcasting.')
    }

    const normalizedUuid = this.normalizeBleUuid(bleDeviceUuid)
    if (!normalizedUuid) {
      throw new Error('Invalid BLE device UUID for broadcasting.')
    }

    if (Platform.OS !== 'android') {
      throw new Error('BLE peripheral broadcasting is currently supported only on Android in LOQIT.')
    }

    await this.ensureBluetoothPoweredOn()

    await this.setStoredBleDeviceUuid(normalizedUuid)
    await this.setBroadcastingMode(true)
    const peripheralName = `${BLE_BEACON_NAME_PREFIX}${this.encodeBleUuidToBeaconToken(normalizedUuid)}`
    const manufacturerData = this.encodeBleUuidForManufacturerData(normalizedUuid)

    try {
      await this.startForegroundBeaconService()

      await Promise.resolve(
        setServices([
          {
            uuid: APP_SERVICE_UUID_NATIVE,
            characteristics: [
              {
                uuid: normalizedUuid,
                properties: ['read'],
                value: normalizedUuid,
              },
            ],
          },
        ])
      )

      await Promise.resolve(
        startAdvertising({
          serviceUUIDs: [APP_SERVICE_UUID_NATIVE],
        })
      )

      console.log('[LOQIT-BLE] Advertising started with service UUID:', APP_SERVICE_UUID_NATIVE)

    } catch (error) {
      const message = this.getAdvertiseErrorMessage(error)
      console.log('BLE peripheral advertise error', error)
      await this.setBroadcastingMode(false)
      await Promise.resolve(stopAdvertising()).catch(() => {
        // Ignore advertiser teardown errors during failed startup.
      })
      await this.stopForegroundBeaconService().catch(() => {
        // Ignore foreground-service teardown errors during failed startup.
      })
      throw new Error(message)
    }
  }

  async startBroadcast(bleDeviceUuid: string) {
    await this.startBroadcasting(bleDeviceUuid)
  }

  async stopBroadcasting() {
    await Promise.resolve(stopAdvertising()).catch(() => {
      // Ignore advertiser stop errors when not currently advertising.
    })

    await this.stopForegroundBeaconService().catch(() => {
      // Ignore foreground service stop failures to keep shutdown idempotent.
    })

    await this.setBroadcastingMode(false)
  }

  stopBroadcast() {
    void this.stopBroadcasting()
  }

  async restoreBroadcastingFromStorage() {
    const modeEnabled = await this.getBroadcastingMode()
    if (!modeEnabled) {
      return false
    }

    const storedUuid = await this.getStoredBleDeviceUuid()
    if (!storedUuid) {
      return false
    }

    await this.startBroadcasting(storedUuid)
    return true
  }

  async reportLocationForDevice(deviceId: string, rssi: number | null = null) {
    const { data: deviceRow } = await supabase
      .from('devices')
      .select('id, owner_id, make, model, status, ble_device_uuid')
      .eq('id', deviceId)
      .maybeSingle()

    const row =
      (deviceRow as {
        id: string
        owner_id: string
        make: string | null
        model: string | null
        status: 'registered' | 'lost' | 'found' | 'recovered' | 'stolen'
        ble_device_uuid: string | null
      } | null) ?? null

    if (!row?.id) {
      return
    }

    const { data: authData } = await supabase.auth.getUser()
    await this.writeLocationReport({
      deviceId: row.id,
      ownerId: row.owner_id,
      make: row.make,
      model: row.model,
      reporterId: authData.user?.id ?? null,
      rssi,
    })
  }

  private shouldReport(bleDeviceUuid: string) {
    const last = reportCooldown.get(bleDeviceUuid)
    const now = Date.now()
    if (last && now - last < REPORT_COOLDOWN_MS) {
      return false
    }

    reportCooldown.set(bleDeviceUuid, now)
    return true
  }

  private async reportDetectedLostDevice(bleDeviceUuid: string, rssi: number) {
    const normalizedUuid = this.normalizeBleUuid(bleDeviceUuid)
    if (!normalizedUuid || !this.shouldReport(normalizedUuid)) {
      return
    }

    const { data: row } = await supabase
      .from('devices')
      .select('id, owner_id, make, model, status')
      .eq('ble_device_uuid', normalizedUuid)
      .limit(1)
      .maybeSingle()

    const device =
      (row as {
        id: string
        owner_id: string
        make: string | null
        model: string | null
        status: 'registered' | 'lost' | 'found' | 'recovered' | 'stolen'
      } | null) ?? null

    if (!device?.id || device.status !== 'lost') {
      return
    }

    const { data: authData } = await supabase.auth.getUser()
    const reporterId = authData.user?.id ?? null
    if (reporterId && reporterId === device.owner_id) {
      return
    }

    await this.writeLocationReport({
      deviceId: device.id,
      ownerId: device.owner_id,
      make: device.make,
      model: device.model,
      reporterId,
      rssi,
    })
  }

  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3 // metres
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  private async writeLocationReport(params: {
    deviceId: string
    ownerId: string
    make: string | null
    model: string | null
    reporterId: string | null
    rssi: number | null
  }) {
    const locationGranted = await this.ensureForegroundLocationPermission()
    if (!locationGranted) {
      throw new Error('Location permission is required to report lost-device sightings.')
    }

    // Use High accuracy for better stability
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    
    // Ignore updates with poor accuracy to prevent large "jumps"
    if (position.coords.accuracy && position.coords.accuracy > 40) {
      console.log('[LOQIT-LOC] Ignoring low-accuracy location update:', position.coords.accuracy)
      return
    }

    const { data: currentDevice } = await supabase
      .from('devices')
      .select('last_seen_lat, last_seen_lng')
      .eq('id', params.deviceId)
      .maybeSingle()

    // If device hasn't moved more than 15 meters, don't update (prevents jitter)
    if (currentDevice?.last_seen_lat && currentDevice?.last_seen_lng) {
      const distance = this.getDistance(
        currentDevice.last_seen_lat,
        currentDevice.last_seen_lng,
        position.coords.latitude,
        position.coords.longitude
      )

      if (distance < 15) {
        console.log(`[LOQIT-LOC] Device is stationary (moved only ${distance.toFixed(1)}m). Skipping update.`)
        return
      }
    }

    const nowIso = new Date().toISOString()

    await supabase.from('beacon_logs').insert({
      device_id: params.deviceId,
      reporter_id: params.reporterId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_meters: position.coords.accuracy ?? null,
      rssi: params.rssi,
    })

    await supabase
      .from('devices')
      .update({
        last_seen_at: nowIso,
        last_seen_lat: position.coords.latitude,
        last_seen_lng: position.coords.longitude,
        updated_at: nowIso,
      })
      .eq('id', params.deviceId)

    const deviceName = `${params.make ?? ''} ${params.model ?? ''}`.trim() || 'Device'
    await supabase.from('notifications').insert({
      user_id: params.ownerId,
      title: 'Device spotted!',
      body: `${deviceName} was detected near you`,
      type: 'beacon_detected',
      reference_id: params.deviceId,
    })
  }

  private normalizeBleUuid(value: string | null | undefined) {
    if (!value) {
      return null
    }

    const trimmed = value.trim().toLowerCase()
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(trimmed)
      ? trimmed
      : null
  }

  private readBleUuidFromManufacturerData(manufacturerData?: string | null) {
    if (!manufacturerData) {
      return null
    }

    try {
      const decoded = decodeBase64(manufacturerData).trim()
      const matched = decoded.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)
      const direct = this.normalizeBleUuid(matched?.[0] ?? null)
      if (direct) {
        return direct
      }

      // Backward compatibility for older packets that nested base64 content in manufacturer data.
      const nested = decodeBase64(decoded)
      const nestedMatch = nested.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)
      return this.normalizeBleUuid(nestedMatch?.[0] ?? null)
    } catch {
      return null
    }
  }

  private encodeBleUuidForManufacturerData(bleDeviceUuid: string) {
    const payload = `${BLE_MANUFACTURER_PREFIX}${bleDeviceUuid}`
    return Array.from(payload)
      .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  }

  private encodeBleUuidToBeaconToken(bleDeviceUuid: string) {
    const hex = bleDeviceUuid.replace(/-/g, '')
    let binary = ''

    for (let i = 0; i < hex.length; i += 2) {
      binary += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16))
    }

    return encodeBase64(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }

  private decodeBeaconTokenToBleUuid(token: string) {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const padded = `${base64}${'='.repeat((4 - (base64.length % 4 || 4)) % 4)}`

    try {
      const decoded = decodeBase64(padded)
      if (decoded.length !== 16) {
        return null
      }

      const hex = Array.from(decoded)
        .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')

      const formatted = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
      return this.normalizeBleUuid(formatted)
    } catch {
      return null
    }
  }

  private readBleUuidFromBeaconName(deviceName?: string | null) {
    if (!deviceName) {
      return null
    }

    const trimmed = deviceName.trim()
    const tokenMatch = trimmed.match(/^LOQIT-([A-Za-z0-9_-]{22})$/)
    if (tokenMatch?.[1]) {
      return this.decodeBeaconTokenToBleUuid(tokenMatch[1])
    }

    const rawUuidMatch = trimmed.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)
    return this.normalizeBleUuid(rawUuidMatch?.[0] ?? null)
  }

  private readBleUuidFromAdvertisement(device: { localName?: string | null; name?: string | null; manufacturerData?: string | null }) {
    const fromManufacturer = this.readBleUuidFromManufacturerData(device.manufacturerData)
    if (fromManufacturer) {
      return fromManufacturer
    }

    return this.readBleUuidFromBeaconName(device.localName ?? device.name)
  }
}

export const bleService = new BLEService()
