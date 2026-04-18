import React, { useState } from 'react'
import { View, Text, Button, PermissionsAndroid, ScrollView } from 'react-native'
import { bleService } from '../services/ble.service'

export default function BleTest() {
  const [logs, setLogs] = useState<string[]>([])
  const [perms, setPerms] = useState<string>('')

  function addLog(msg: string) {
    setLogs(prev => [msg, ...prev].slice(0, 5))
  }

  async function testScan() {
    addLog('⌛ Building Manager...')
    await (bleService as any).resetManager()
    
    const manager = (bleService as any).manager
    if (!manager) {
       addLog('❌ Failed to construct BleManager natively')
       return
    }

    manager.stopDeviceScan()
    addLog('⌛ Attempting scan...')

    manager.state().then((state: string) => {
      addLog(`Native State: ${state}`)

      manager.startDeviceScan(null, null, (error: any, device: any) => {
        if (error) {
          addLog(`❌ Code ${error.errorCode}: ${error.message}`)
          return
        }
        if (device) addLog(`✅ Found: ${device.name || 'Unknown'} (${device.id})`)
      })
    })
  }

  async function checkPermissions() {
    const p = [
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.ACCESS_FINE_LOCATION',
    ]
    let results = "PERMISSIONS:\n"
    for (const perm of p) {
      const res = await PermissionsAndroid.check(perm as any)
      results += `${perm.replace('android.permission.', '')}: ${res ? '✅ YES' : '❌ NO'}\n`
    }
    setPerms(results)
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#111' }}>
      <Button title="1. Check Strict Permissions" onPress={checkPermissions} color="#ff3333" />
      <Text style={{ color: 'white', marginVertical: 10, fontSize: 16 }}>{perms}</Text>

      <Button title="2. Test BLE Scan" onPress={testScan} color="#2196F3" />
      
      <View style={{ marginTop: 20, padding: 10, backgroundColor: '#222', borderRadius: 10 }}>
        {logs.map((log, i) => (
          <Text key={i} style={{ color: 'white', marginVertical: 5 }}>{log}</Text>
        ))}
      </View>
    </View>
  )
}
