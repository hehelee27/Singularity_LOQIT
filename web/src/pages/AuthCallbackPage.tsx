import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Colors } from '../lib/colors'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Auth callback error:', error)
        navigate('/login?error=auth_failed', { replace: true })
        return
      }

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (profile?.role === 'police' || profile?.role === 'admin') {
          navigate('/police', { replace: true })
        } else {
          navigate('/dashboard', { replace: true })
        }
      } else {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
          if (event === 'SIGNED_IN' && s?.user) {
            subscription.unsubscribe()

            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', s.user.id)
              .single()

            if (profile?.role === 'police' || profile?.role === 'admin') {
              navigate('/police', { replace: true })
            } else {
              navigate('/dashboard', { replace: true })
            }
          }
        })

        setTimeout(() => {
          subscription.unsubscribe()
          navigate('/login', { replace: true })
        }, 10000)
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.background,
      gap: '20px',
    }}>
      <img src="/logo.png" alt="LOQIT" style={{ height: '64px', width: 'auto', marginBottom: '8px' }} />
      <span
        className="material-icons"
        style={{ fontSize: '48px', color: Colors.primary, animation: 'spin 1s linear infinite' }}
      >
        sync
      </span>
      <p style={{ color: Colors.onSurfaceVariant, fontSize: '16px', margin: 0 }}>
        Signing you in…
      </p>
    </div>
  )
}
