import { CSSProperties, InputHTMLAttributes } from 'react'
import { Colors } from '../lib/colors'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  fullWidth?: boolean
  icon?: string
  helperText?: string
}

export function Input({
  label,
  error,
  fullWidth = true,
  icon,
  helperText,
  style,
  className,
  ...props
}: InputProps) {
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: fullWidth ? '100%' : 'auto',
  }

  const labelStyle: CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: Colors.onSurface,
    letterSpacing: '0.1px',
  }

  const inputWrapperStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: '12px',
    border: error ? `2px solid ${Colors.error}` : `2px solid ${Colors.outlineVariant}`,
    padding: '14px 18px',
    transition: 'all 0.2s ease',
    position: 'relative',
  }

  const inputStyle: CSSProperties = {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    color: Colors.onSurface,
    WebkitTextFillColor: Colors.onSurface,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 500,
    ...style,
  }

  const errorStyle: CSSProperties = {
    fontSize: '13px',
    color: Colors.error,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  }

  const helperTextStyle: CSSProperties = {
    fontSize: '13px',
    color: Colors.onSurfaceVariant,
  }

  return (
    <div style={containerStyle}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={inputWrapperStyle} className="input-wrapper">
        {icon && (
          <span className="material-icons" style={{ color: Colors.primary, fontSize: '22px' }}>
            {icon}
          </span>
        )}
        <input style={inputStyle} className="custom-input" {...props} />
      </div>
      {error && (
        <span style={errorStyle}>
          <span className="material-icons" style={{ fontSize: '16px' }}>error</span>
          {error}
        </span>
      )}
      {helperText && !error && <span style={helperTextStyle}>{helperText}</span>}
    </div>
  )
}
