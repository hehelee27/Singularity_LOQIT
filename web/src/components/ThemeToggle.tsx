import { useState, useEffect } from 'react'
import { Colors } from '../lib/colors'

export function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark-mode'))

  useEffect(() => {
    const savedTheme = localStorage.getItem('loqit_theme') || localStorage.getItem('spors_theme')
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark-mode')
      setIsDark(true)
    }
  }, [])

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark-mode')
      setIsDark(false)
      localStorage.setItem('loqit_theme', 'light')
    } else {
      document.documentElement.classList.add('dark-mode')
      setIsDark(true)
      localStorage.setItem('loqit_theme', 'dark')
    }
  }

  return (
    <button 
      onClick={toggleTheme}
      style={{
        background: Colors.surfaceContainerHigh,
        border: `1px solid ${Colors.outlineVariant}`,
        borderRadius: '50%',
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: Colors.onSurface,
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        flexShrink: 0,
        ...style
      }}
    >
      <span className="material-icons">{isDark ? 'light_mode' : 'dark_mode'}</span>
    </button>
  )
}
