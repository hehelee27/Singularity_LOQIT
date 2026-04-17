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
    const { error } = await supabase.auth.signInWithPassword(
      isPhone(id) ? { phone: id, password } : { email: id, password }
    )
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
      const { error } = await supabase.auth.signUp({
        email: id,
        password,
        options: { data: { full_name: fullName } },
      })
      return { error: error as Error | null }
    }
  }

  const verifyOtp = async (identifier: string, token: string) => {
    const id = formatIdentifier(identifier)
    if (isPhone(id)) {
      const { error } = await supabase.auth.verifyOtp({ phone: id, token, type: 'sms' })
      return { error: error as Error | null }
    } else {
      const { error } = await supabase.auth.verifyOtp({ email: id, token, type: 'signup' })
      return { error: error as Error | null }
    }
  }

  const resendOtp = async (identifier: string) => {
    const id = formatIdentifier(identifier)
    if (isPhone(id)) {
      const { error } = await supabase.auth.resend({ type: 'sms', phone: id })
      return { error: error as Error | null }
    } else {
      const { error } = await supabase.auth.resend({ type: 'signup', email: id })
      return { error: error as Error | null }
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
