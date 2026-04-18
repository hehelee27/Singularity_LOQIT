import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  phone_number: string | null
  role: string
  aadhaar_verified: boolean
  created_at: string
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signIn: (identifier: string, password: string) => Promise<{ error: Error | null }>
  signUp: (identifier: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  verifyOtp: (identifier: string, token: string) => Promise<{ error: Error | null }>
  resendOtp: (identifier: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [tempUser, setTempUser] = useState<any>(null)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('AuthProvider: Error fetching profile:', error)
        return null
      }
      return data as Profile
    } catch (err) {
      console.error('AuthProvider: Unexpected error fetching profile:', err)
      return null
    }
  }

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }

  useEffect(() => {
    let mounted = true
    let authListener: any = null

    const init = async () => {
      console.log('AuthProvider: Initializing...')
      
      // Get initial session
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession()
        if (error) {
          // If the error is about an invalid refresh token, we should sign out to clear it
          if (error.message.toLowerCase().includes('refresh token')) {
            console.warn('AuthProvider: Invalid refresh token detected. Clearing session...')
            await supabase.auth.signOut()
          }
          throw error
        }
        
        if (mounted) {
          setSession(initialSession)
          setUser(initialSession?.user ?? null)
          if (initialSession?.user) {
            const profileData = await fetchProfile(initialSession.user.id)
            if (mounted) setProfile(profileData)
          }
        }
      } catch (error) {
        console.error('AuthProvider: Error getting initial session', error)
      } finally {
        if (mounted) setLoading(false)
      }

      // Listen for auth changes after initial session is loaded
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, currentSession) => {
          console.log(`AuthProvider: Auth event: ${event}`)
          if (mounted) {
            setSession(currentSession)
            setUser(currentSession?.user ?? null)
            if (currentSession?.user) {
              const profileData = await fetchProfile(currentSession.user.id)
              if (mounted) setProfile(profileData)
            } else {
              setProfile(null)
            }
          }
        }
      )
      authListener = subscription
    }

    init()

    return () => {
      mounted = false
      if (authListener) {
        authListener.unsubscribe()
      }
    }
  }, [])

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    return { error: error as Error | null }
  }

  const isPhone = (val: string) => /^\+?[0-9]{10,15}$/.test(val.replace(/[\s-]/g, ''))

  const formatIdentifier = (id: string) => {
    let clean = id.trim()
    if (isPhone(clean) && !clean.startsWith('+')) {
      clean = '+91' + clean
    }
    return clean
  }

  const signIn = async (identifier: string, password: string) => {
    const id = formatIdentifier(identifier)
    const { data, error } = await supabase.auth.signInWithPassword(
      isPhone(id) ? { phone: id, password } : { email: id, password }
    )

    // New: Proactively trigger OTP for unverified email users
    if (!error && data.user && !isPhone(id)) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email_verified')
        .eq('id', data.user.id)
        .maybeSingle()
      
      if (!profileData || !profileData.email_verified) {
        console.log('[Web Auth] Proactively triggering OTP for unverified user...')
        const n8nUrl = import.meta.env.VITE_N8N_SEND_VERIFICATION_URL || 'https://zore1803.app.n8n.cloud/webhook/send-verification'
        fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: id }),
        }).catch(e => console.error('[Web Auth] Initial OTP trigger failed:', e))
      }
    }

    return { error: error as Error | null }
  }

  const signUp = async (identifier: string, password: string, fullName: string) => {
    const id = formatIdentifier(identifier)
    
    if (isPhone(id)) {
      const { error } = await supabase.auth.signUp({
        phone: id,
        password,
        options: { data: { full_name: fullName, phone_number: id } },
      })
      return { error: error as Error | null }
    } else {
      // 1. Store details temporarily for n8n flow
      const sanitizedEmail = id.toLowerCase().trim()
      setTempUser({ email: sanitizedEmail, password, fullName })

      // 2. Trigger n8n verification
      try {
        const n8nUrl = import.meta.env.VITE_N8N_SEND_VERIFICATION_URL || 'https://zore1803.app.n8n.cloud/webhook/send-verification'
        const response = await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: sanitizedEmail }),
        })
        
        if (!response.ok) throw new Error('Failed to send verification email.')
        
        return { error: null }
      } catch (err) {
        console.error('[Web Auth] Failed to trigger n8n verification:', err)
        return { error: err as Error | null }
      }
    }
  }

  const verifyOtp = async (identifier: string, token: string) => {
    const id = formatIdentifier(identifier)
    const normalizedEmail = id.toLowerCase().trim()

    if (isPhone(id)) {
      const { error } = await supabase.auth.verifyOtp({ phone: id, token, type: 'sms' })
      return { error: error as Error | null }
    } else {
      // 1. Call n8n verify webhook
      try {
        const n8nUrl = import.meta.env.VITE_N8N_VERIFY_OTP_URL || 'https://zore1803.app.n8n.cloud/webhook/verify-otp'
        const response = await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, otp: token }),
        })
        
        const text = await response.text()
        let result: any = {}
        try {
          result = text ? JSON.parse(text) : {}
        } catch (e) {
          console.warn('[Web Auth] verifyOtp non-JSON:', text)
          if (text && text.toLowerCase().includes('verified')) {
            result = { status: 'verified' }
          } else {
            throw new Error('Verification server returned an invalid response.')
          }
        }

        if (!response.ok || (result.status !== 'verified' && result.code !== 'verified')) {
          return { error: new Error(result.message || result.error || 'Invalid or expired OTP') }
        }
        
        // 2. n8n Verified! Finalize Logged-in/SignUp
        let userId = user?.id;

        // If not logged in yet (new registration), perform the signUp now
        if (!user && tempUser) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: tempUser.email,
            password: tempUser.password,
            options: { data: { full_name: tempUser.fullName } },
          })
          
          if (signUpError) {
            if (!signUpError.message.toLowerCase().includes('already registered')) {
               return { error: signUpError }
            }
          }
          userId = signUpData?.user?.id
        }

        // 3. Mark as verified in profiles table
        if (userId) {
          await supabase
            .from('profiles')
            .update({ email_verified: true })
            .eq('id', userId)
          
          await refreshProfile()
        }

        setTempUser(null)
        return { error: null }
      } catch (err) {
        console.error('[Web Auth] verifyOtp error:', err)
        return { error: new Error('Verification service error.') }
      }
    }
  }

  const resendOtp = async (identifier: string) => {
    const id = formatIdentifier(identifier)
    if (isPhone(id)) {
      const { error } = await supabase.auth.resend({ type: 'sms', phone: id })
      return { error: error as Error | null }
    } else {
      try {
        const n8nUrl = import.meta.env.VITE_N8N_SEND_VERIFICATION_URL || 'https://zore1803.app.n8n.cloud/webhook/send-verification'
        await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: id }),
        })
        return { error: null }
      } catch (err) {
        return { error: new Error('Failed to resend code.') }
      }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        verifyOtp,
        resendOtp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
