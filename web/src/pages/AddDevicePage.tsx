import { CSSProperties, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Colors } from '../lib/colors'
import { useDevices, isValidIMEI } from '../hooks/useDevices'
import { supabase } from '../lib/supabase'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Input } from '../components/Input'

const BRANDS = [
  'Apple',
  'Samsung',
  'Google',
  'OnePlus',
  'Xiaomi',
  'Oppo',
  'Vivo',
  'Realme',
  'Motorola',
  'Nokia',
  'Sony',
  'LG',
  'Huawei',
  'Other',
]

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh',
]

const COLORS = [
  { name: 'Black', value: '#1a1a1a' },
  { name: 'White', value: '#f5f5f5' },
  { name: 'Silver', value: '#c0c0c0' },
  { name: 'Gold', value: '#ffd700' },
  { name: 'Rose Gold', value: '#e8b4b8' },
  { name: 'Blue', value: '#4a90d9' },
  { name: 'Green', value: '#4caf50' },
  { name: 'Red', value: '#ef5350' },
  { name: 'Purple', value: '#9c27b0' },
]

export function AddDevicePage() {
  const navigate = useNavigate()
  const { addDevice } = useDevices()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')

  const [state, setState] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [imeiPrimary, setImeiPrimary] = useState('')
  const [imeiSecondary, setImeiSecondary] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [color, setColor] = useState('')

  const imei1Valid = imeiPrimary.length === 15 && isValidIMEI(imeiPrimary)
  const imei2Valid = !imeiSecondary || (imeiSecondary.length === 15 && isValidIMEI(imeiSecondary))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    // 1. Basic length check
    if (imeiPrimary.length !== 15) {
      setError('Primary IMEI must be exactly 15 digits.')
      setLoading(false)
      return
    }

    // 2. Duplicate Check (Network Request)
    try {
      const { data: duplicateData, error: duplicateError } = await supabase.rpc('verify_imei', { p_imei: imeiPrimary })
      
      if (!duplicateError && duplicateData && duplicateData.registered) {
        const ownerName = duplicateData.owner_masked || 'another user'
        setError(`Duplicate Found: This device is already registered by ${ownerName}. Ownership verification required.`)
        setLoading(false)
        return
      }
    } catch (err) {
      console.error('Duplicate check failed, proceeding anyway:', err)
    }

    // 3. Register the device
    try {
      const { error } = await addDevice({
        state,
        make,
        model,
        imei_primary: imeiPrimary,
        imei_secondary: imeiSecondary || null,
        serial_number: serialNumber,
        color: color || null,
        purchase_date: purchaseDate || null,
      })

      if (error) throw error
      navigate('/devices')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add device. Ensure all fields are valid.')
    } finally {
      setLoading(false)
    }
  }

  const containerStyle: CSSProperties = {
    padding: '40px',
    maxWidth: '900px',
    margin: '0 auto',
  }

  const headerStyle: CSSProperties = {
    marginBottom: '40px',
    background: `linear-gradient(135deg, ${Colors.primary}10 0%, transparent 100%)`,
    padding: '32px',
    borderRadius: '20px',
    border: `1px solid ${Colors.primary}20`,
  }

  const titleStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: 700,
    color: Colors.onSurface,
    marginBottom: '12px',
    letterSpacing: '-0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const subtitleStyle: CSSProperties = {
    color: Colors.onSurfaceVariant,
    fontSize: '16px',
    lineHeight: '1.5',
  }

  const formStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  const rowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
  }

  const selectStyle: CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: Colors.surfaceContainerHigh,
    border: `1px solid ${Colors.outlineVariant}`,
    borderRadius: '12px',
    color: Colors.onSurface,
    fontSize: '16px',
    cursor: 'pointer',
  }

  const labelStyle: CSSProperties = {
    fontSize: '14px',
    fontWeight: 700,
    color: Colors.onSurface,
    marginBottom: '10px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }

  const colorGridStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '8px',
  }

  const colorSwatchStyle = (colorValue: string, isSelected: boolean): CSSProperties => ({
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: colorValue,
    cursor: 'pointer',
    border: isSelected ? `4px solid ${Colors.primary}` : `3px solid ${Colors.outline}`,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: isSelected ? `0 4px 12px ${Colors.primary}40` : 'none',
  })

  const errorStyle: CSSProperties = {
    backgroundColor: `${Colors.error}20`,
    color: Colors.error,
    padding: '16px 20px',
    borderRadius: '12px',
    fontSize: '15px',
    border: `2px solid ${Colors.error}40`,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontWeight: 600,
    marginBottom: '24px',
  }

  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '16px',
  }

  const imeiStatusStyle = (isValid: boolean, value: string): CSSProperties => ({
    fontSize: '13px',
    marginTop: '8px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: !value ? Colors.onSurfaceVariant : isValid ? Colors.secondary : Colors.error,
  })

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>
          <span className="material-icons" style={{ fontSize: '36px', color: Colors.primary }}>
            add_circle
          </span>
          Register New Device
        </h1>
        <p style={subtitleStyle}>
          Add your device to LOQIT to protect it and enable recovery features
        </p>
      </div>

      <Card variant="elevated" padding="32px">
        {error && (
          <div style={errorStyle}>
            <span className="material-icons">error</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>State *</label>
              <select
                style={selectStyle}
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
              >
                <option value="">Select state</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Brand *</label>
              <select
                style={selectStyle}
                value={make}
                onChange={(e) => setMake(e.target.value)}
                required
              >
                <option value="">Select brand</option>
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={rowStyle}>
            <Input
              label="Model *"
              placeholder="e.g., iPhone 15 Pro"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
            />

            <Input
              label="Serial Number *"
              placeholder="Device serial number"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              required
            />
          </div>

          <div style={rowStyle}>
            <div>
              <Input
                label="Primary IMEI *"
                placeholder="15-digit IMEI"
                value={imeiPrimary}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 15)
                  setImeiPrimary(val)
                }}
                maxLength={15}
                required
              />
            </div>

            <div>
              <Input
                label="Secondary IMEI (Dual SIM)"
                placeholder="15-digit IMEI (optional)"
                value={imeiSecondary}
                onChange={(e) => setImeiSecondary(e.target.value.replace(/\D/g, '').slice(0, 15))}
                maxLength={15}
              />
              <div style={imeiStatusStyle(imei2Valid, imeiSecondary)}>
                {!imeiSecondary ? (
                  <>
                    <span className="material-icons" style={{ fontSize: '16px' }}>info</span>
                    Optional for dual SIM phones
                  </>
                ) : imei2Valid ? (
                  <>
                    <span className="material-icons" style={{ fontSize: '16px' }}>check_circle</span>
                    Valid IMEI
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: '16px' }}>error</span>
                    Invalid IMEI
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={rowStyle}>
            <Input
              label="Purchase Date (Optional)"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Device Color (Optional)</label>
            <div style={colorGridStyle}>
              {COLORS.map((c) => (
                <div
                  key={c.name}
                  style={colorSwatchStyle(c.value, color === c.value)}
                  onClick={() => setColor(color === c.value ? '' : c.value)}
                  title={c.name}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                />
              ))}
            </div>
          </div>

          <Card
            variant="outlined"
            style={{
              padding: '20px',
              marginTop: '8px',
              background: `linear-gradient(135deg, ${Colors.tertiary}08 0%, transparent 100%)`,
            }}
          >
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: `linear-gradient(135deg, ${Colors.tertiary}30 0%, ${Colors.tertiary}10 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span className="material-icons" style={{ color: Colors.tertiary, fontSize: '24px' }}>
                  info
                </span>
              </div>
              <div>
                <p style={{ color: Colors.onSurface, fontSize: '15px', marginBottom: '12px', fontWeight: 700 }}>
                  How to find your IMEI:
                </p>
                <ul
                  style={{
                    color: Colors.onSurfaceVariant,
                    fontSize: '14px',
                    paddingLeft: '20px',
                    margin: 0,
                    lineHeight: '1.8',
                  }}
                >
                  <li>Dial <strong>*#06#</strong> on your phone</li>
                  <li>Check <strong>Settings → About Phone → IMEI</strong></li>
                  <li>Look on the original box or receipt</li>
                </ul>
              </div>
            </div>
          </Card>

          <div style={actionsStyle}>
            <Button variant="ghost" onClick={() => navigate('/devices')} style={{ border: `2px solid ${Colors.outlineVariant}` }} icon="close">
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!imei1Valid || !imei2Valid} icon="check_circle" size="large">
              Register Device
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
