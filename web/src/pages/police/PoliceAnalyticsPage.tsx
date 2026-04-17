import { CSSProperties, useEffect, useState } from 'react'
import { Colors } from '../../lib/colors'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/Card'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

type AnalyticsData = {
  devicesByStatus: { status: string; count: number }[]
  devicesByMake: { make: string; count: number }[]
  reportsOverTime: { month: string; count: number }[]
  topRewardAmounts: { amount: number; device: string }[]
  recoveryRate: number
  averageResolutionDays: number
  theftHotspots: { zone: string; count: number; probability: number }[]
  tamperEventsByType: { type: string; count: number }[]
}

function StatCard({ label, value, subtext, icon, color }: {
  label: string; value: number | string; subtext: string; icon: string; color: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `linear-gradient(135deg, ${Colors.surfaceContainerHigh}, ${Colors.surfaceContainer})`
          : Colors.surfaceContainer,
        border: `1px solid ${hovered ? color + '50' : Colors.outlineVariant}`,
        borderRadius: '20px',
        padding: '32px 24px',
        display: 'flex', alignItems: 'center', gap: '20px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: hovered ? `0 12px 40px ${color}15, 0 0 0 1px ${color}10` : '0 4px 12px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-4px)' : 'none',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '120px', height: '120px',
        background: `radial-gradient(circle at 100% 0%, ${color}10 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        width: '64px', height: '64px', borderRadius: '18px', flexShrink: 0,
        background: `linear-gradient(135deg, ${color}20, ${color}05)`,
        border: `2px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 24px ${color}20`,
      }}>
        <span className="material-icons" style={{ fontSize: '32px', color }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: '42px', fontWeight: 900, color: Colors.onSurface, lineHeight: 1, letterSpacing: '-1.5px', marginBottom: '8px' }}>
          {value}
        </div>
        <div style={{ fontSize: '15px', color: Colors.onSurface, fontWeight: 700, letterSpacing: '0.5px' }}>
          {label}
        </div>
        <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant, marginTop: '2px' }}>
          {subtext}
        </div>
      </div>
    </div>
  )
}

export function PoliceAnalyticsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    devicesByStatus: [],
    devicesByMake: [],
    reportsOverTime: [],
    topRewardAmounts: [],
    recoveryRate: 0,
    averageResolutionDays: 0,
    theftHotspots: [],
    tamperEventsByType: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      // Devices by status
      const { data: devices } = await supabase
        .from('devices')
        .select('status')

      const statusCounts: { [key: string]: number } = {}
      devices?.forEach((d: any) => {
        statusCounts[d.status] = (statusCounts[d.status] || 0) + 1
      })
      const devicesByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

      // Devices by make
      const { data: allDevices } = await supabase
        .from('devices')
        .select('make')

      const makeCounts: { [key: string]: number } = {}
      allDevices?.forEach((d: any) => {
        makeCounts[d.make] = (makeCounts[d.make] || 0) + 1
      })
      const devicesByMake = Object.entries(makeCounts)
        .map(([make, count]) => ({ make, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // Reports over time (last 6 months)
      const { data: reports } = await supabase
        .from('lost_reports')
        .select('reported_at')
        .gte('reported_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())

      const monthCounts: { [key: string]: number } = {}
      reports?.forEach((r: any) => {
        const month = new Date(r.reported_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
        monthCounts[month] = (monthCounts[month] || 0) + 1
      })
      const reportsOverTime = Object.entries(monthCounts).map(([month, count]) => ({ month, count }))

      // Top reward amounts
      const { data: rewardsData } = await supabase
        .from('lost_reports')
        .select('reward_amount, devices(make, model)')
        .not('reward_amount', 'is', null)
        .order('reward_amount', { ascending: false })
        .limit(5)

      const topRewardAmounts = rewardsData?.map((r: any) => ({
        amount: r.reward_amount,
        device: `${r.devices?.make || ''} ${r.devices?.model || ''}`.trim() || 'Unknown',
      })) || []

      // Recovery rate
      const { count: totalLost } = await supabase
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .in('status', ['lost', 'stolen', 'found', 'recovered'])

      const { count: recovered } = await supabase
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .in('status', ['found', 'recovered'])

      const recoveryRate = totalLost ? Math.round((recovered! / totalLost!) * 100) : 0

      // Average resolution days
      const { data: resolvedReports } = await supabase
        .from('lost_reports')
        .select('reported_at, resolved_at')
        .not('resolved_at', 'is', null)

      let totalDays = 0
      resolvedReports?.forEach((r: any) => {
        const reported = new Date(r.reported_at).getTime()
        const resolved = new Date(r.resolved_at).getTime()
        totalDays += (resolved - reported) / (1000 * 60 * 60 * 24)
      })
      const averageResolutionDays = resolvedReports?.length 
        ? Math.round(totalDays / resolvedReports.length) 
        : 0

      // Anti-Theft Analytics
      const { data: tamperEvents } = await supabase
        .from('anti_theft_events')
        .select('event_type, latitude, longitude')

      const tamperCounts: { [key: string]: number } = {}
      const hotspots: { [key: string]: { count: number; lat: number; lng: number } } = {}

      tamperEvents?.forEach((ev: any) => {
        tamperCounts[ev.event_type] = (tamperCounts[ev.event_type] || 0) + 1
        
        if (ev.latitude && ev.longitude) {
          // Cluster by approx 1km (roughly 0.01 degrees)
          const latSlot = Math.floor(ev.latitude * 100) / 100
          const lngSlot = Math.floor(ev.longitude * 100) / 100
          const key = `${latSlot},${lngSlot}`
          if (!hotspots[key]) hotspots[key] = { count: 0, lat: ev.latitude, lng: ev.longitude }
          hotspots[key].count++
        }
      })

      const theftHotspots = Object.entries(hotspots)
        .map(([key, data]) => ({
          zone: `Area around ${data.lat.toFixed(2)}, ${data.lng.toFixed(2)}`,
          count: data.count,
          probability: Math.min(85, 20 + (data.count * 15)) // Heuristic
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const tamperEventsByType = Object.entries(tamperCounts).map(([type, count]) => ({ type, count }))

      setAnalytics({
        devicesByStatus,
        devicesByMake,
        reportsOverTime,
        topRewardAmounts,
        recoveryRate,
        averageResolutionDays,
        theftHotspots,
        tamperEventsByType,
      })
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const containerStyle: CSSProperties = { padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }

  const chartCardStyle: CSSProperties = {
    padding: '28px',
    borderRadius: '20px',
    background: Colors.surfaceContainer,
    border: `1px solid ${Colors.outlineVariant}`,
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  }

  const chartTitleStyle: CSSProperties = {
    fontSize: '20px',
    fontWeight: 700,
    color: Colors.onSurface,
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  }

  const barStyle = (value: number, maxValue: number, color: string): CSSProperties => ({
    height: '28px',
    backgroundColor: `${Colors.outlineVariant}50`,
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px',
    overflow: 'hidden',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
  })

  const barFillStyle = (percentage: number, color: string): CSSProperties => ({
    width: `${percentage}%`,
    minWidth: '24px', // Ensure there is always a visible "push"
    height: '100%',
    background: `linear-gradient(90deg, ${color}90, ${color})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: '12px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
    borderRadius: '14px',
    boxShadow: `0 0 10px ${color}40`
  })

  if (loading) {
    return (
      <div style={{ ...containerStyle, textAlign: 'center', paddingTop: '120px' }}>
        <span className="material-icons" style={{ fontSize: '48px', color: Colors.primary, animation: 'spin 1s linear infinite' }}>
          sync
        </span>
        <p style={{ marginTop: '16px', color: Colors.onSurfaceVariant }}>Loading analytics...</p>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: Colors.primary, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
            Operations & Intelligence
          </div>
          <h1 style={{
            fontSize: '30px', fontWeight: 900, margin: 0, letterSpacing: '-0.5px',
            background: `linear-gradient(135deg, ${Colors.onSurface} 40%, ${Colors.primary} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Analytics Database
          </h1>
          <p style={{ fontSize: '14px', color: Colors.onSurfaceVariant, margin: '6px 0 0' }}>
            Statistical analysis and historical theft trends across the city grid.
          </p>
        </div>
        <button
          onClick={() => navigate('/police')}
          style={{
            background: `${Colors.primary}15`, border: `1px solid ${Colors.primary}30`, borderRadius: '12px',
            padding: '10px 20px', color: Colors.primary, fontWeight: 700, fontSize: '14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = `${Colors.primary}25`}
          onMouseLeave={e => e.currentTarget.style.background = `${Colors.primary}15`}
        >
          <span className="material-icons" style={{ fontSize: '18px' }}>arrow_back</span>
          Command Center
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <StatCard 
          label="Recovery Rate" 
          value={`${analytics.recoveryRate}%`} 
          subtext="Devices recovered vs reported" 
          icon="verified" 
          color={Colors.secondary} 
        />
        <StatCard 
          label="Avg Days to Resolve" 
          value={analytics.averageResolutionDays} 
          subtext="Average time to close pending reports" 
          icon="timer" 
          color={Colors.primary} 
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>
            <span className="material-icons" style={{ color: Colors.primary }}>pie_chart</span>
            Devices by Status
          </h3>
          {analytics.devicesByStatus.length === 0 ? (
            <p style={{ color: Colors.onSurfaceVariant, textAlign: 'center', padding: '20px' }}>
              No data available
            </p>
          ) : (
            analytics.devicesByStatus.map((item) => {
              const maxCount = Math.max(...analytics.devicesByStatus.map(d => d.count))
              const percentage = (item.count / maxCount) * 100
              const statusColors: { [key: string]: string } = {
                'registered': Colors.primary,
                'lost': Colors.tertiary,
                'stolen': Colors.error,
                'found': Colors.secondary,
                'recovered': Colors.secondary,
              }
              const color = statusColors[item.status] || Colors.outline

              return (
                <div key={item.status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', color: Colors.onSurface, fontWeight: 500, textTransform: 'capitalize' }}>
                      {item.status}
                    </span>
                    <span style={{ fontSize: '13px', color: Colors.onSurfaceVariant }}>
                      {item.count} devices
                    </span>
                  </div>
                  <div style={barStyle(item.count, maxCount, color)}>
                    <div style={barFillStyle(percentage, color)} />
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>
            <span className="material-icons" style={{ color: Colors.primary }}>smartphone</span>
            Top 10 Device Makes
          </h3>
          {analytics.devicesByMake.length === 0 ? (
            <p style={{ color: Colors.onSurfaceVariant, textAlign: 'center', padding: '20px' }}>
              No data available
            </p>
          ) : (
            analytics.devicesByMake.map((item) => {
              const maxCount = Math.max(...analytics.devicesByMake.map(d => d.count))
              const percentage = (item.count / maxCount) * 100

              return (
                <div key={item.make}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', color: Colors.onSurface, fontWeight: 500 }}>
                      {item.make}
                    </span>
                    <span style={{ fontSize: '13px', color: Colors.onSurfaceVariant }}>
                      {item.count} devices
                    </span>
                  </div>
                  <div style={barStyle(item.count, maxCount, Colors.primary)}>
                    <div style={barFillStyle(percentage, Colors.primary)} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>
            <span className="material-icons" style={{ color: Colors.error }}>explore</span>
            Theft Hotspots & Recovery Prediction
          </h3>
          {analytics.theftHotspots.length === 0 ? (
            <p style={{ color: Colors.onSurfaceVariant, textAlign: 'center', padding: '20px' }}>
              No hotspot data available yet.
            </p>
          ) : (
            analytics.theftHotspots.map((item) => (
              <div key={item.zone} style={{ marginBottom: '16px', padding: '12px', borderRadius: '10px', background: `${Colors.error}08`, border: `1px solid ${Colors.error}20` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: Colors.onSurface }}>{item.zone}</span>
                  <span style={{ fontSize: '12px', color: Colors.error, fontWeight: 700 }}>{item.count} TAMPER EVENTS</span>
                </div>
                <div style={{ fontSize: '11px', color: Colors.onSurfaceVariant, marginBottom: '6px' }}>Recovery Likelihood</div>
                <div style={{ height: '8px', background: Colors.outlineVariant, borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${item.probability}%`, height: '100%', background: Colors.secondary }} />
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: 700, color: Colors.secondary, marginTop: '4px' }}>{item.probability}% Probability</div>
              </div>
            ))
          )}
        </div>

        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>
            <span className="material-icons" style={{ color: Colors.tertiary }}>security</span>
            Tamper Activity Analysis
          </h3>
          {analytics.tamperEventsByType.length === 0 ? (
            <p style={{ color: Colors.onSurfaceVariant, textAlign: 'center', padding: '20px' }}>
              No tamper activity logged.
            </p>
          ) : (
            analytics.tamperEventsByType.map((item) => {
              const maxCount = Math.max(...analytics.tamperEventsByType.map(d => d.count))
              const percentage = (item.count / maxCount) * 100
              const labels: { [key: string]: string } = {
                'sim_change': 'SIM Card Swap',
                'motion_alert': 'Unusual Motion',
                'camera_capture': 'Camera Intruder',
                'manual_trigger': 'Manual Lockdown'
              }
              const colorMappings: { [key: string]: string } = {
                'sim_change': Colors.error,
                'motion_alert': '#f59e0b',
                'camera_capture': Colors.secondary,
                'manual_trigger': Colors.primary
              }

              return (
                <div key={item.type}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', color: Colors.onSurface, fontWeight: 500 }}>
                      {labels[item.type] || item.type}
                    </span>
                    <span style={{ fontSize: '13px', color: Colors.onSurfaceVariant }}>
                      {item.count} hits
                    </span>
                  </div>
                  <div style={barStyle(item.count, maxCount, colorMappings[item.type] || Colors.primary)}>
                    <div style={barFillStyle(percentage, colorMappings[item.type] || Colors.primary)} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
