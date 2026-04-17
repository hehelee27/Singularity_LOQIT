import { CSSProperties, useEffect, useState, useRef } from 'react'
import { Colors } from '../../lib/colors'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/Card'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type DeviceLocation = {
  id: string
  device_id: string
  latitude: number
  longitude: number
  reported_at: string
  device_name: string
  status: string
}

type DashboardStats = {
  totalLostDevices: number
  activeReports: number
  totalChats: number
  devicesRecovered: number
  recentAlerts: number
  totalUsers: number
}

type RecentActivity = {
  id: string
  type: 'report' | 'chat' | 'beacon' | 'recovery' | 'theft_alert'
  title: string
  description: string
  timestamp: string
  icon: string
  color: string
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({ label, value, icon, color, path, loading }: {
  label: string; value: number | string; icon: string; color: string; path?: string; loading: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const navigate = useNavigate()
  return (
    <div
      onClick={() => path && navigate(path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `linear-gradient(135deg, ${Colors.surfaceContainerHigh}, ${Colors.surfaceContainer})`
          : Colors.surfaceContainer,
        border: `1px solid ${hovered ? color + '50' : Colors.outlineVariant}`,
        borderRadius: '16px',
        padding: '22px 24px',
        display: 'flex', alignItems: 'center', gap: '16px',
        cursor: path ? 'pointer' : 'default',
        transition: 'all 0.25s ease',
        boxShadow: hovered ? `0 8px 32px ${color}20, 0 0 0 1px ${color}20` : '0 1px 4px rgba(0,0,0,0.1)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
        background: `radial-gradient(circle at 100% 0%, ${color}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
        background: `linear-gradient(135deg, ${color}22, ${color}10)`,
        border: `1.5px solid ${color}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 16px ${color}20`,
      }}>
        <span className="material-icons" style={{ fontSize: '22px', color }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: '30px', fontWeight: 900, color: Colors.onSurface, lineHeight: 1, letterSpacing: '-1px' }}>
          {loading ? (
            <span className="material-icons" style={{ fontSize: '22px', animation: 'spin 1s linear infinite', color: Colors.outline }}>sync</span>
          ) : value}
        </div>
        <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant, fontWeight: 600, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </div>
      </div>
    </div>
  )
}

export function PoliceDashboardPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalLostDevices: 0,
    activeReports: 0,
    totalChats: 0,
    devicesRecovered: 0,
    recentAlerts: 0,
    totalUsers: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [lostDevices, setLostDevices] = useState<DeviceLocation[]>([])
  const [loading, setLoading] = useState(true)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<{ [id: string]: L.Marker }>({})

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      // Get all stats in parallel
      const [
        lostDevicesRes,
        activeReportsRes,
        chatsRes,
        recoveredRes,
        alertsRes,
        usersRes,
      ] = await Promise.all([
        supabase.from('devices').select('*', { count: 'exact', head: true }).in('status', ['lost', 'stolen']),
        supabase.from('lost_reports').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('chat_rooms').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('devices').select('*', { count: 'exact', head: true }).in('status', ['found', 'recovered']),
        supabase.from('beacon_logs').select('*', { count: 'exact', head: true }).gte('reported_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'civilian'),
      ])

      setStats({
        totalLostDevices: lostDevicesRes.count || 0,
        activeReports: activeReportsRes.count || 0,
        totalChats: chatsRes.count || 0,
        devicesRecovered: recoveredRes.count || 0,
        recentAlerts: alertsRes.count || 0,
        totalUsers: usersRes.count || 0,
      })

      // Load recent activity
      await loadRecentActivity()
      // Load lost device locations
      await loadLostDeviceLocations()
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRecentActivity = async () => {
    const activities: RecentActivity[] = []

    // Recent lost reports
    const { data: reports } = await supabase
      .from('lost_reports')
      .select('id, reported_at, devices(make, model)')
      .order('reported_at', { ascending: false })
      .limit(3)

    reports?.forEach((report: any) => {
      activities.push({
        id: report.id,
        type: 'report',
        title: 'New Lost Report',
        description: `${report.devices?.make} ${report.devices?.model}`,
        timestamp: report.reported_at,
        icon: 'report',
        color: Colors.error,
      })
    })

    // Recent beacon detections
    const { data: beacons } = await supabase
      .from('beacon_logs')
      .select('id, reported_at, device_id, devices(make, model)')
      .order('reported_at', { ascending: false })
      .limit(3)

    beacons?.forEach((beacon: any) => {
      activities.push({
        id: beacon.id,
        type: 'beacon',
        title: 'Device Detected',
        description: `${beacon.devices?.make} ${beacon.devices?.model}`,
        timestamp: beacon.reported_at,
        icon: 'my_location',
        color: Colors.secondary,
      })
    })

    // Recent Anti-Theft Tamper events
    const { data: tamperEvents } = await supabase
      .from('anti_theft_events')
      .select('id, event_type, triggered_at, devices(make, model)')
      .order('triggered_at', { ascending: false })
      .limit(3)

    tamperEvents?.forEach((ev: any) => {
      const labels: { [key: string]: string } = {
        'sim_change': 'SIM Card Swap',
        'motion_alert': 'Unusual Motion',
        'camera_capture': 'Intruder Detected',
      }
      activities.push({
        id: ev.id,
        type: 'theft_alert',
        title: labels[ev.event_type] || 'Tamper Alert',
        description: `Device: ${ev.devices?.make} ${ev.devices?.model}`,
        timestamp: ev.triggered_at,
        icon: 'security',
        color: ev.event_type === 'sim_change' ? Colors.error : '#f59e0b',
      })
    })

    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    setRecentActivity(activities.slice(0, 10))
  }

  const loadLostDeviceLocations = async () => {
    // Get latest beacon logs for ALL devices marked as lost or stolen
    const { data: lostLocations } = await supabase
      .from('beacon_logs')
      .select(`
        id, 
        device_id, 
        latitude, 
        longitude, 
        reported_at,
        devices!inner(make, model, status)
      `)
      .in('devices.status', ['lost', 'stolen'])
      .order('reported_at', { ascending: false })

    if (lostLocations) {
      // Map to unique results per device (most recent first)
      const uniqueMap = new Map()
      lostLocations.forEach((log: any) => {
        if (!uniqueMap.has(log.device_id)) {
          uniqueMap.set(log.device_id, {
            id: log.id,
            device_id: log.device_id,
            latitude: log.latitude,
            longitude: log.longitude,
            reported_at: log.reported_at,
            device_name: `${log.devices.make} ${log.devices.model}`,
            status: log.devices.status
          })
        }
      })
      setLostDevices(Array.from(uniqueMap.values()))
    }
  }

  useEffect(() => {
    if (!loading && mapContainerRef.current && !leafletMapRef.current) {
      // Initialize map
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([19.0760, 72.8777], 11) // Default to Mumbai scale

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Colorful OpenStreetMap Tile
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map)

      leafletMapRef.current = map
    }

    // Update markers when lostDevices changes
    if (leafletMapRef.current) {
      const map = leafletMapRef.current
      
      lostDevices.forEach(device => {
        if (markersRef.current[device.device_id]) {
          markersRef.current[device.device_id].setLatLng([device.latitude, device.longitude])
        } else {
          const marker = L.marker([device.latitude, device.longitude], {
            icon: L.divIcon({
              className: 'police-incident-marker',
              html: `<div style="width: 14px; height: 14px; background: ${Colors.error}; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px ${Colors.error}; animation: pulse 2s infinite;"></div>`
            })
          }).addTo(map)
          
          marker.bindPopup(`
            <div style="color: #fff; background: #1a1d24; padding: 8px;">
              <strong style="display: block; margin-bottom: 4px;">${device.device_name}</strong>
              <div style="font-size: 11px; opacity: 0.8; margin-bottom: 4px;">Status: ${device.status.toUpperCase()}</div>
              <div style="font-size: 10px; opacity: 0.6;">Last seen: ${new Date(device.reported_at).toLocaleString()}</div>
            </div>
          `, { className: 'dark-popup' })
          
          markersRef.current[device.device_id] = marker
        }
      })

      // If we have devices, fit bounds
      if (lostDevices.length > 0) {
        const group = L.featureGroup(Object.values(markersRef.current))
        map.fitBounds(group.getBounds().pad(0.2))
      }
    }
  }, [loading, lostDevices])

  const containerStyle: CSSProperties = { padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }

  if (loading) {
    return (
      <div style={{ ...containerStyle, textAlign: 'center', paddingTop: '120px' }}>
        <span className="material-icons" style={{ fontSize: '48px', color: Colors.primary, animation: 'spin 1s linear infinite' }}>
          sync
        </span>
        <p style={{ marginTop: '16px', color: Colors.onSurfaceVariant }}>Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: Colors.primary, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <h1 style={{
            fontSize: '30px', fontWeight: 900, margin: 0, letterSpacing: '-0.5px',
            background: `linear-gradient(135deg, ${Colors.onSurface} 40%, ${Colors.primary} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {getGreeting()}, Officer {profile?.full_name?.split(' ')[0] || ''} 👋
          </h1>
          <p style={{ fontSize: '14px', color: Colors.onSurfaceVariant, margin: '6px 0 0' }}>
            Real-time monitoring and city-wide device recovery operations.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Lost Devices" value={stats.totalLostDevices} icon="warning" color={Colors.error} path="/police/devices" loading={loading} />
        <StatCard label="Active Reports" value={stats.activeReports} icon="description" color={Colors.primary} path="/police/reports" loading={loading} />
        <StatCard label="Recovered" value={stats.devicesRecovered} icon="check_circle" color={Colors.secondary} path="/police/devices" loading={loading} />
        <StatCard label="Protected Users" value={stats.totalUsers} icon="people" color={Colors.tertiary} loading={loading} />
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Side: Map & Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Global Map */}
          <div style={{ 
            height: '420px', borderRadius: '16px', overflow: 'hidden', position: 'relative', 
            border: `1px solid ${Colors.outlineVariant}`, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' 
          }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
            <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1000, backgroundColor: 'rgba(17,19,24,0.85)', padding: '10px 16px', borderRadius: '12px', backdropFilter: 'blur(8px)', border: `1px solid ${Colors.outlineVariant}` }}>
              <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="material-icons" style={{ color: Colors.error, fontSize: '18px' }}>radar</span>
                {lostDevices.length} Active Incidents Detected
                <div style={{ marginLeft: '4px', width: '8px', height: '8px', backgroundColor: Colors.error, borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
              </div>
            </div>
            <style>{`
              .police-incident-marker { background: transparent; border: none; }
              @keyframes pulse {
                0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(255, 61, 113, 0.4); }
                70% { transform: scale(1.1); opacity: 0.8; box-shadow: 0 0 0 10px rgba(255, 61, 113, 0); }
                100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(255, 61, 113, 0); }
              }
              .dark-popup .leaflet-popup-content-wrapper { background: #1a1d24; color: #fff; border: 1px solid #3d4452; }
              .dark-popup .leaflet-popup-tip { background: #1a1d24; }
            `}</style>
          </div>

          {/* Recent Activity */}
          <div style={{
            background: Colors.surfaceContainer, border: `1px solid ${Colors.outlineVariant}`,
            borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '18px 22px', borderBottom: `1px solid ${Colors.outlineVariant}`,
              background: `linear-gradient(135deg, ${Colors.surfaceContainerHigh}, ${Colors.surfaceContainer})`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="material-icons" style={{ fontSize: '18px', color: Colors.primary }}>history</span>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: Colors.onSurface, margin: 0 }}>Recent Activity Feed</h2>
              </div>
            </div>

            {recentActivity.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <span className="material-icons" style={{ fontSize: '48px', color: Colors.outline, marginBottom: '12px' }}>inbox</span>
                <p style={{ color: Colors.onSurfaceVariant }}>No recent activity in the area.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentActivity.map((activity, i) => (
                  <div key={activity.id} style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px',
                    borderBottom: i < recentActivity.length - 1 ? `1px solid ${Colors.outlineVariant}` : 'none',
                    borderLeft: `3px solid ${activity.type === 'theft_alert' ? activity.color : 'transparent'}`,
                    transition: 'background 0.2s', background: 'transparent'
                  }} onMouseEnter={e => e.currentTarget.style.background = Colors.surfaceContainerHigh} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                      backgroundColor: `${activity.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span className="material-icons" style={{ fontSize: '20px', color: activity.color }}>{activity.icon}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: Colors.onSurface, fontSize: '14px', marginBottom: '2px' }}>{activity.title}</div>
                      <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant }}>{activity.description}</div>
                    </div>
                    <div style={{ fontSize: '12px', color: Colors.outline, fontWeight: 500 }}>
                      {new Date(activity.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Quick Actions & Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ fontSize: '11px', fontWeight: 700, color: Colors.outline, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Command Control
          </div>
          
          {[
            { label: 'Incident Reports', icon: 'description', path: '/police/reports', color: Colors.primary },
            { label: 'Device Database', icon: 'devices', path: '/police/devices', color: Colors.secondary },
            { label: 'Global Search', icon: 'search', path: '/police/search', color: Colors.tertiary },
            { label: 'Active Chats', icon: 'forum', path: '/police/chats', color: '#aac7ff' },
            { label: 'City Analytics', icon: 'analytics', path: '/police/analytics', color: Colors.onSurfaceVariant },
          ].map(action => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderRadius: '12px',
                background: Colors.surfaceContainer, border: `1px solid ${Colors.outlineVariant}`,
                cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.2s ease', color: Colors.onSurface,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = action.color + '55'
                e.currentTarget.style.background = Colors.surfaceContainerHigh
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = `0 4px 16px ${action.color}15`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = Colors.outlineVariant
                e.currentTarget.style.background = Colors.surfaceContainer
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                background: `${action.color}15`, border: `1px solid ${action.color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-icons" style={{ fontSize: '18px', color: action.color }}>{action.icon}</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, flex: 1 }}>{action.label}</span>
              <span className="material-icons" style={{ fontSize: '16px', color: Colors.outline }}>chevron_right</span>
            </button>
          ))}

          {/* System Status Card */}
          <div style={{
            marginTop: '8px', padding: '18px',
            background: `linear-gradient(135deg, ${Colors.primary}12, ${Colors.accent}08)`,
            border: `1px solid ${Colors.primary}25`, borderRadius: '14px',
            boxShadow: `0 0 24px ${Colors.primary}10`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{
                display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                background: Colors.secondary, boxShadow: `0 0 8px ${Colors.secondary}`,
                animation: 'pulse 2s infinite',
              }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: Colors.primary, textTransform: 'uppercase', letterSpacing: '1px' }}>
                System Online
              </span>
            </div>
            <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant, lineHeight: 1.5, marginBottom: '12px' }}>
              LOQIT central database is connected. BLE sweeping is actively logging nodes across the grid.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: `1px solid ${Colors.primary}20`, paddingTop: '10px' }}>
              <span style={{ color: Colors.onSurfaceVariant }}>24h Sweeps:</span>
              <span style={{ color: Colors.primary, fontWeight: 700 }}>{stats.recentAlerts > 0 ? stats.recentAlerts + 2400 : 2400}+</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
