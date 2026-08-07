import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'
import Actoscuotas from './ActosCuotas.jsx'
import FestersCRUD from './FestersCRUD.jsx'
import ConciliacionPagos from './ConciliacionPagos.jsx'

export default function AdminPanel() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  const [esAdmin, setEsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState(null)

  const [tab, setTab] = useState('cuotas') // 'cuotas' | 'festers' | 'pagos'

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

  useEffect(() => {
    async function comprobarAdmin() {
      if (!session) {
        setEsAdmin(false)
        return
      }
      setCheckingAdmin(true)
      const { data, error } = await supabase
        .from('fester')
        .select('es_admin')
        .eq('auth_id', session.user.id)
        .maybeSingle()
      setEsAdmin(!error && data?.es_admin === true)
      setCheckingAdmin(false)
    }
    comprobarAdmin()
  }, [session])

  async function login(e) {
    e.preventDefault()
    setLoginError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setLoginError(error.message)
  }

  function gotofester() {
    window.location.href = '/'
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  if (checkingSession) {
    return (
      <div className="page-center">
        <p className="texto-muted">Cargando…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="page-center">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-brand-dot" />
            Filà · Admin
          </div>
          <form onSubmit={login} className="auth-form">
            <div className="campo">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="campo">
              <label>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {loginError && <p className="error-texto">{loginError}</p>}
            <button type="submit" className="btn-primario">
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (checkingAdmin) {
    return (
      <div className="page-center">
        <p className="texto-muted">Comprobando permisos…</p>
      </div>
    )
  }

  if (!esAdmin) {
    return (
      <div className="page-center">
        <div className="auth-card">
          <p className="error-texto">Esta cuenta no tiene permisos de administrador.</p>
          <button type="button" className="btn-secundario" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-center">
      <div className="auth-card auth-card-admin">
        <div className="admin-header">
          <div className="auth-brand">
            <span className="auth-brand-dot" />
            Panel de Administracio de la filà
          </div>
          <button type="button" className="btn-link" onClick={logout}>
            Cerrar sesión
          </button>
          <button type="button" className="btn-link" onClick={gotofester}>
            Panel de Fester
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${tab === 'cuotas' ? 'tab-activo' : ''}`}
            onClick={() => setTab('cuotas')}
            type="button"
          >
            Cuotas
          </button>
          <button
            className={`tab ${tab === 'festers' ? 'tab-activo' : ''}`}
            onClick={() => setTab('festers')}
            type="button"
          >
            Festers
          </button>
          <button
            className={`tab ${tab === 'pagos' ? 'tab-activo' : ''}`}
            onClick={() => setTab('pagos')}
            type="button"
          >
            Pagos
          </button>
        </div>

        {tab === 'cuotas' && <Actoscuotas />}
        {tab === 'festers' && <FestersCRUD />}
        {tab === 'pagos' && <ConciliacionPagos />}

        {/* {tab === 'cuotas' ? <Actoscuotas /> : <FestersCRUD />} */}
      </div>
    </div>
  )
}
