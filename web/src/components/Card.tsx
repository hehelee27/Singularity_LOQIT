import { CSSProperties, ReactNode, HTMLAttributes } from 'react'
import { Colors } from '../lib/colors'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  title?: string
  subtitle?: string
  onClick?: () => void
  style?: CSSProperties
  padding?: string
  variant?: 'default' | 'elevated' | 'outlined'
  hoverable?: boolean
}

export function Card({ 
  children, 
  title, 
  subtitle, 
  onClick, 
  style, 
  padding = '24px',
  variant = 'default',
  hoverable = true,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: CardProps) {
  const getVariantStyles = (): CSSProperties => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: Colors.surfaceContainerLow,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        }
      case 'outlined':
        return {
          backgroundColor: Colors.surfaceContainer,
          border: `2px solid ${Colors.outlineVariant}`,
        }
      default:
        return {
          backgroundColor: Colors.surfaceContainer,
          border: `1px solid ${Colors.outlineVariant}`,
        }
    }
  }

  const cardStyle: CSSProperties = {
    borderRadius: '16px',
    padding,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    ...getVariantStyles(),
    ...style,
  }

  const titleStyle: CSSProperties = {
    fontSize: '20px',
    fontWeight: 700,
    color: Colors.onSurface,
    marginBottom: subtitle ? '6px' : '16px',
    letterSpacing: '0.2px',
  }

  const subtitleStyle: CSSProperties = {
    fontSize: '14px',
    color: Colors.onSurfaceVariant,
    marginBottom: '16px',
    lineHeight: '1.5',
  }

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick && hoverable) {
          e.currentTarget.style.transform = 'translateY(-3px)'
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)'
        }
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        if (onClick && hoverable) {
          e.currentTarget.style.transform = 'translateY(0)'
          const variantStyles = getVariantStyles()
          e.currentTarget.style.boxShadow = variantStyles.boxShadow || 'none'
        }
        onMouseLeave?.(e)
      }}
      {...rest}
    >
      {title && <h3 style={titleStyle}>{title}</h3>}
      {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
      {children}
    </div>
  )
}
