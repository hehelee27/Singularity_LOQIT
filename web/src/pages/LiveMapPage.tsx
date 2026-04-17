import { useEffect, useRef, useState } from 'react'
import { Colors } from '../lib/colors'
import { useDevices, Device } from '../hooks/useDevices'
import { supabase } from '../lib/supabase'

type BeaconLog = {
  id: string
  device_id: string
  latitude: number
  longitude: number
  logged_at: string
  device_make?: string
  device_model?: string
  device_imei?: string
}

const STATUS_COLOR: Record<string, string> = {
  lost: '#FF4E4E',
  stolen: '#FF4E4E',
  recovered: '#ffb95f',
  found: '#ffb95f',
  registered: '#46f1bb',
}

const STATUS_LABEL: Record<string, string> = {
  lost: 'Lost',
  stolen: 'Stolen',
  recovered: 'Recovered',
  found: 'Found',
  registered: 'Protected',
}

function markerHtml(color: string, pulse = false) {
  return `
    <div style="position:relative;width:24px;height:24px">
      ${pulse ? `<div style="position:absolute;inset:-6px;border-radius:50%;background:${color}40;animation:ping 1.5s ease-out infinite"></div>` : ''}
      <div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);position:relative;z-index:1"></div>
    </div>`
}

export function LiveMapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const beaconMarkersRef = useRef<any[]>([])

  const { devices, loading } = useDevices()
  const [filter, setFilter] = useState<'all' | 'lost' | 'registered' | 'recovered'>('all')
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [beaconLogs, setBeaconLogs] = useState<BeaconLog[]>([])
  const [showBeacons, setShowBeacons] = useState(true)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    const link = document.createElement('link')
    link.id = 'leaflet-css'
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    if (!document.getElementById('leaflet-css')) document.head.appendChild(link)

    const style = document.createElement('style')
    style.id = 'map-ping'
    style.textContent = `
      @keyframes ping {
        0% { transform: scale(1); opacity: 0.8; }
        100% { transform: scale(3); opacity: 0; }
      }
      .mobile-style-marker { background: transparent; border: none; }
      .dark-popup .leaflet-popup-content-wrapper { background: #1a1d24; color: #fff; border: 1px solid #3d4452; }
      .dark-popup .leaflet-popup-tip { background: #1a1d24; }
    `
    if (!document.getElementById('map-ping')) document.head.appendChild(style)

    let mounted = true
    import('leaflet').then((L) => {
      if (!mounted || !mapContainerRef.current || mapRef.current) return
      const map = L.map(mapContainerRef.current, {
        center: [20.5937, 78.9629],
        zoom: 5,
        zoomControl: false,
      })
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map)
      mapRef.current = map
      setMapReady(true)
    })

    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        setMapReady(false)
      }
    }
  }, [])

  useEffect(() => {
    const loadBeacons = async () => {
      const { data } = await supabase
        .from('beacon_logs')
        .select('id, device_id, latitude, longitude, logged_at')
        .order('logged_at', { ascending: false })
        .limit(100)
      if (data) setBeaconLogs(data)
    }
    loadBeacons()
  }, [])

  const pathRootRef = useRef<any>(null)
  
  useEffect(() => {
    const fetchPath = async () => {
      if (!selectedDevice || !mapReady || !mapRef.current) {
        if (pathRootRef.current) {
          pathRootRef.current.remove()
          pathRootRef.current = null
        }
        return
      }

      const { data: logs } = await supabase
        .from('beacon_logs')
        .select('latitude, longitude, logged_at')
        .eq('device_id', selectedDevice.id)
        .order('logged_at', { ascending: true })
        .limit(30)

      if (!logs || logs.length < 2) return

      import('leaflet').then((L) => {
        if (pathRootRef.current) pathRootRef.current.remove()
        
        const latlngs = logs.map(l => [l.latitude, l.longitude] as [number, number])
        const group = L.featureGroup().addTo(mapRef.current)
        
        // Draw the path line
        L.polyline(latlngs, {
          color: STATUS_COLOR[selectedDevice.status] || Colors.primary,
          weight: 3,
          opacity: 0.6,
          dashArray: '8, 8'
        }).addTo(group)

        // Draw smaller trail dots for older locations
        latlngs.slice(0, -1).forEach((pos, idx) => {
          L.circleMarker(pos, {
            radius: 4,
            fillColor: STATUS_COLOR[selectedDevice.status],
            fillOpacity: 0.4,
            stroke: false
          }).addTo(group)
        })

        pathRootRef.current = group
      })
    }
    fetchPath()
  }, [selectedDevice, mapReady])

  useEffect(() => {
    if (!mapReady || !mapRef.current || loading) return
    import('leaflet').then((L) => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      const filtered = devices.filter((d) => {
        if (filter === 'lost') return d.status === 'lost' || d.status === 'stolen'
        if (filter === 'registered') return d.status === 'registered'
        if (filter === 'recovered') return d.status === 'recovered' || d.status === 'found'
        return true
      })

      filtered.forEach((device) => {
        if (!device.last_seen_lat || !device.last_seen_lng) return
        const color = STATUS_COLOR[device.status] || '#aac7ff'
        const isLost = device.status === 'lost' || device.status === 'stolen'
        const icon = L.divIcon({
          html: markerHtml(color, isLost),
          className: 'mobile-style-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
        const marker = L.marker([device.last_seen_lat, device.last_seen_lng], { icon })
          .bindTooltip(`${device.make} ${device.model}`, { permanent: false, direction: 'top', className: 'dark-popup' })
          .on('click', () => setSelectedDevice(device))
          .addTo(mapRef.current)
          
        markersRef.current.push(marker)
        
        // Add 100m radar circle like mobile app
        if (isLost) {
          const circle = L.circle([device.last_seen_lat, device.last_seen_lng], {
            radius: 100,
            fillColor: color,
            fillOpacity: 0.08,
            color: color,
            weight: 1,
            opacity: 0.3
          }).addTo(mapRef.current)
          markersRef.current.push(circle) // Push to same ref array to clean up on reload
        }
      })

      const withLocation = filtered.filter((d) => d.last_seen_lat && d.last_seen_lng)
      if (withLocation.length > 0) {
        const bounds = L.latLngBounds(
          withLocation.map((d) => [d.last_seen_lat!, d.last_seen_lng!] as [number, number])
        )
        mapRef.current.fitBounds(bounds, { padding: [60, 60] })
      }
    })
  }, [mapReady, devices, filter, loading])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    import('leaflet').then((L) => {
      beaconMarkersRef.current.forEach((m) => m.remove())
      beaconMarkersRef.current = []
      if (!showBeacons) return

      beaconLogs.forEach((log) => {
        const icon = L.divIcon({
          html: `<div style="width:10px;height:10px;border-radius:50%;background:#aac7ff60;border:1.5px solid #aac7ff;"></div>`,
          className: '',
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        })
        const marker = L.marker([log.latitude, log.longitude], { icon })
          .bindTooltip(`Beacon at ${new Date(log.logged_at).toLocaleString()}`, { direction: 'top' })
          .addTo(mapRef.current)
        beaconMarkersRef.current.push(marker)
      })
    })
  }, [mapReady, beaconLogs, showBeacons])

  const devicesWithLocation = devices.filter((d) => d.last_seen_lat && d.last_seen_lng)
  const lostCount = devices.filter((d) => d.status === 'lost' || d.status === 'stolen').length

  const focusDevice = (d: Device) => {
    if (!mapRef.current || !d.last_seen_lat || !d.last_seen_lng) return
    mapRef.current.setView([d.last_seen_lat, d.last_seen_lng], 14, { animate: true })
    setSelectedDevice(d)
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', backgroundColor: Colors.background }}>
      {/* Left Panel */}
      <div style={{
        width: '340px',
        minWidth: '340px',
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${Colors.outlineVariant}`,
        backgroundColor: Colors.surfaceContainerLow,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 20px 16px', borderBottom: `1px solid ${Colors.outlineVariant}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span className="material-icons" style={{ color: Colors.primary, fontSize: '22px' }}>map</span>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: Colors.onSurface, margin: 0 }}>Live Map</h1>
          </div>
          <p style={{ fontSize: '13px', color: Colors.onSurfaceVariant, margin: 0 }}>
            Real-time device locations from BLE beacon logs
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', backgroundColor: Colors.outlineVariant }}>
          {[
            { label: 'Total', value: devices.length, color: Colors.onSurface },
            { label: 'On Map', value: devicesWithLocation.length, color: Colors.primary },
            { label: 'At Risk', value: lostCount, color: lostCount > 0 ? Colors.error : Colors.onSurfaceVariant },
          ].map((s) => (
            <div key={s.label} style={{ backgroundColor: Colors.surfaceContainer, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: Colors.onSurfaceVariant, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${Colors.outlineVariant}` }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(['all', 'lost', 'registered', 'recovered'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: `1.5px solid ${filter === f ? Colors.primary : Colors.outlineVariant}`,
                  backgroundColor: filter === f ? `${Colors.primary}20` : 'transparent',
                  color: filter === f ? Colors.primary : Colors.onSurfaceVariant,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.15s ease',
                }}
              >
                {f === 'all' ? 'All' : f === 'registered' ? 'Protected' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle Beacon Dots */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${Colors.outlineVariant}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowBeacons((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: showBeacons ? Colors.primary : Colors.onSurfaceVariant,
              fontSize: '13px', fontWeight: 600, padding: 0,
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {showBeacons ? 'visibility' : 'visibility_off'}
            </span>
            Beacon history dots
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: Colors.onSurfaceVariant }}>
            {beaconLogs.length} logs
          </span>
        </div>

        {/* Device List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: Colors.onSurfaceVariant }}>
              <span className="material-icons" style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>sync</span>
            </div>
          ) : devices.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: Colors.onSurfaceVariant }}>
              <span className="material-icons" style={{ fontSize: '40px', display: 'block', marginBottom: '8px' }}>devices</span>
              No devices registered
            </div>
          ) : (
            devices
              .filter((d) => {
                if (filter === 'lost') return d.status === 'lost' || d.status === 'stolen'
                if (filter === 'registered') return d.status === 'registered'
                if (filter === 'recovered') return d.status === 'recovered' || d.status === 'found'
                return true
              })
              .map((d) => {
                const color = STATUS_COLOR[d.status] || '#aac7ff'
                const hasLocation = !!(d.last_seen_lat && d.last_seen_lng)
                const isSelected = selectedDevice?.id === d.id
                return (
                  <div
                    key={d.id}
                    onClick={() => focusDevice(d)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderBottom: `1px solid ${Colors.outlineVariant}`,
                      cursor: hasLocation ? 'pointer' : 'default',
                      backgroundColor: isSelected ? `${Colors.primary}10` : 'transparent',
                      transition: 'background 0.15s',
                      opacity: hasLocation ? 1 : 0.5,
                    }}
                    onMouseEnter={(e) => { if (hasLocation && !isSelected) e.currentTarget.style.backgroundColor = Colors.surfaceContainerHigh }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      backgroundColor: `${color}20`, border: `2px solid ${color}50`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span className="material-icons" style={{ fontSize: '20px', color }}>smartphone</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: Colors.onSurface, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.make} {d.model}
                      </div>
                      <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant }}>
                        {d.imei_primary}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{
                        fontSize: '11px', fontWeight: 700, color,
                        backgroundColor: `${color}15`, padding: '3px 8px',
                        borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.3px'
                      }}>
                        {STATUS_LABEL[d.status] || d.status}
                      </div>
                      <div style={{ fontSize: '11px', color: Colors.onSurfaceVariant, marginTop: '2px' }}>
                        {hasLocation ? (
                          <><span className="material-icons" style={{ fontSize: '12px', verticalAlign: 'middle' }}>location_on</span> Located</>
                        ) : 'No location'}
                      </div>
                    </div>
                  </div>
                )
              })
          )}
        </div>

        {/* Legend */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${Colors.outlineVariant}`, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {[
            { color: '#46f1bb', label: 'Protected' },
            { color: '#FF4E4E', label: 'Lost/Stolen' },
            { color: '#ffb95f', label: 'Recovered' },
            { color: '#aac7ff60', label: 'Beacon dot' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color, border: '1.5px solid rgba(255,255,255,0.3)' }} />
              <span style={{ fontSize: '11px', color: Colors.onSurfaceVariant }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {selectedDevice && (
          <div style={{
            position: 'absolute', top: '16px', right: '16px', zIndex: 1000,
            backgroundColor: Colors.surfaceContainer,
            border: `1px solid ${Colors.outlineVariant}`,
            borderRadius: '16px', padding: '20px', width: '280px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: Colors.onSurface }}>
                  {selectedDevice.make} {selectedDevice.model}
                </div>
                <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant }}>{selectedDevice.imei_primary}</div>
              </div>
              <button
                onClick={() => setSelectedDevice(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: Colors.onSurfaceVariant, padding: '2px', lineHeight: 1 }}
              >
                <span className="material-icons" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '12px',
              backgroundColor: `${STATUS_COLOR[selectedDevice.status]}20`,
              color: STATUS_COLOR[selectedDevice.status],
              fontSize: '12px', fontWeight: 700, marginBottom: '12px',
            }}>
              <span className="material-icons" style={{ fontSize: '14px' }}>
                {selectedDevice.status === 'lost' || selectedDevice.status === 'stolen' ? 'warning' : 'check_circle'}
              </span>
              {STATUS_LABEL[selectedDevice.status] || selectedDevice.status}
            </div>
            {selectedDevice.last_seen_lat && selectedDevice.last_seen_lng ? (
              <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant, marginBottom: '8px' }}>
                <span className="material-icons" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>location_on</span>
                {selectedDevice.last_seen_lat.toFixed(4)}, {selectedDevice.last_seen_lng.toFixed(4)}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant, marginBottom: '8px' }}>No location data yet</div>
            )}
            {selectedDevice.last_seen_at && (
              <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant }}>
                <span className="material-icons" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>schedule</span>
                {new Date(selectedDevice.last_seen_at).toLocaleString()}
              </div>
            )}
            {selectedDevice.loqit_key && (
              <div style={{ marginTop: '12px', padding: '8px', backgroundColor: Colors.surfaceContainerHigh, borderRadius: '8px', fontSize: '12px' }}>
                <span style={{ color: Colors.onSurfaceVariant }}>LOQIT Key: </span>
                <span style={{ color: Colors.primary, fontWeight: 600, fontFamily: 'monospace' }}>{selectedDevice.loqit_key}</span>
              </div>
            )}
          </div>
        )}

        {devicesWithLocation.length === 0 && !loading && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            backgroundColor: Colors.surfaceContainer, border: `1px solid ${Colors.outlineVariant}`,
            borderRadius: '16px', padding: '32px', textAlign: 'center', zIndex: 500,
            maxWidth: '360px',
          }}>
            <span className="material-icons" style={{ fontSize: '48px', color: Colors.onSurfaceVariant, display: 'block', marginBottom: '12px' }}>location_off</span>
            <div style={{ fontSize: '16px', fontWeight: 700, color: Colors.onSurface, marginBottom: '8px' }}>No location data yet</div>
            <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant, lineHeight: 1.6 }}>
              Device locations appear here when the LOQIT mobile app detects BLE beacons from your devices.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
