import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'
import LoginForm from './LoginForm.jsx'
import RegistroForm from './RegistroForm.jsx'
import Dashboard from '../fester/Dashboard.jsx'

export default function AuthPage() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [tab, setTab] = useState('login') // 'login' | 'registro'

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckingSession(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (checkingSession) {
    return (
      <div className="page-center">
        <p className="texto-muted">Cargando…</p>
      </div>
    )
  }

  if (session) {
    return <Dashboard session={session} />
  }

  return (
    <div className="page-center">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-dot" />
          Filà
        </div>

        <div className="tabs">
          <button
            className={`tab ${tab === 'login' ? 'tab-activo' : ''}`}
            onClick={() => setTab('login')}
            type="button"
          >
            Iniciar sesión
          </button>
          <button
            className={`tab ${tab === 'registro' ? 'tab-activo' : ''}`}
            onClick={() => setTab('registro')}
            type="button"
          >
            Crear cuenta
          </button>
        </div>

        {tab === 'login' ? (
          <LoginForm onIrARegistro={() => setTab('registro')} />
        ) : (
          <RegistroForm onIrALogin={() => setTab('login')} />
        )}
      </div>
    </div>
  )
}
