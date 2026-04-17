import { CSSProperties } from 'react'
import { Colors } from '../lib/colors'

type ButtonProps = {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size?: 'small' | 'medium' | 'large'
  fullWidth?: boolean
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  style?: CSSProperties
  icon?: string
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  loading = false,
  type = 'button',
  style,
  icon,
}: ButtonProps) {
  const sizeStyles: Record<string, CSSProperties> = {
    small: { padding: '9px 18px', fontSize: '13px', gap: '6px' },
    medium: { padding: '12px 24px', fontSize: '14px', gap: '8px' },
    large: { padding: '15px 32px', fontSize: '16px', gap: '10px' },
  }

  const variantStyles: Record<string, CSSProperties> = {
    primary: {
      background: `linear-gradient(135deg, ${Colors.primary}, ${Colors.accent})`,
      color: Colors.onPrimary,
      border: 'none',
      boxShadow: `0 4px 20px ${Colors.primary}40`,
    },
    secondary: {
      background: `linear-gradient(135deg, ${Colors.secondary}, #06d4a1)`,
      color: Colors.onSecondary,
      border: 'none',
      boxShadow: `0 4px 20px ${Colors.secondary}40`,
    },
    outline: {
      background: 'transparent',
      color: Colors.primary,
      border: `1.5px solid ${Colors.primary}60`,
      boxShadow: 'none',
    },
    danger: {
      background: `linear-gradient(135deg, ${Colors.error}, #c44)`,
      color: '#fff',
      border: 'none',
      boxShadow: `0 4px 16px ${Colors.error}40`,
    },
    ghost: {
      background: 'transparent',
      color: Colors.onSurface,
      border: `1px solid ${Colors.outlineVariant}`,
      boxShadow: 'none',
    },
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '12px',
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.55 : 1,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        width: fullWidth ? '100%' : 'auto',
        fontFamily: 'Inter, system-ui, sans-serif',
        letterSpacing: '0.2px',
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.filter = 'brightness(1.1)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.filter = 'brightness(1)'
      }}
    >
      {loading ? (
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite', fontSize: size === 'small' ? '16px' : '20px' }}>sync</span>
      ) : icon ? (
        <span className="material-icons" style={{ fontSize: size === 'small' ? '16px' : '20px' }}>{icon}</span>
      ) : null}
      {children}
    </button>
  )
}
