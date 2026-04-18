import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type DeviceStatus = 'registered' | 'lost' | 'found' | 'recovered' | 'stolen'

export type Device = {
  id: string
  owner_id: string
  state: string | null
  make: string
  model: string
  imei_primary: string
  imei_secondary: string | null
  serial_number: string
  loqit_key: string | null
  color: string | null
  purchase_date: string | null
  status: DeviceStatus
  is_ble_active: boolean
  last_seen_at: string | null
  last_seen_lat: number | null
  last_seen_lng: number | null
  created_at: string
  updated_at: string
}

export function isValidIMEI(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length === 15
}

export function isLuhnValid(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 15) return false

  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let digit = parseInt(digits[i], 10)
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

export function useDevices() {
  const { user } = useAuth()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDevices = useCallback(async () => {
    if (!user) {
      setDevices([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('devices')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setDevices([])
    } else {
      setDevices(data as Device[])
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  const addDevice = async (device: {
    state: string
    make: string
    model: string
    imei_primary: string
    imei_secondary?: string | null
    serial_number: string
    color?: string | null
    purchase_date?: string | null
  }) => {
    if (!user) return { error: new Error('Not authenticated') }

    const { data, error } = await supabase
      .from('devices')
      .insert({
        ...device,
        owner_id: user.id,
        status: 'registered',
      })
      .select()
      .single()

    if (!error && data) {
      setDevices((prev) => [data as Device, ...prev])
    }

    return { data, error }
  }

  const updateDevice = async (id: string, updates: Partial<Device>) => {
    const { data, error } = await supabase
      .from('devices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (!error && data) {
      setDevices((prev) => prev.map((d) => (d.id === id ? (data as Device) : d)))
    }

    return { data, error }
  }

  const deleteDevice = async (id: string) => {
    const { error } = await supabase.from('devices').delete().eq('id', id)

    if (!error) {
      setDevices((prev) => prev.filter((d) => d.id !== id))
    }

    return { error }
  }

  const markAsLost = async (id: string) => {
    return updateDevice(id, { status: 'lost' })
  }

  const markAsFound = async (id: string) => {
    return updateDevice(id, { status: 'recovered' })
  }

  return {
    devices,
    loading,
    error,
    refetch: fetchDevices,
    addDevice,
    updateDevice,
    deleteDevice,
    markAsLost,
    markAsFound,
  }
}
