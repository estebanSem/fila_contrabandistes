import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'

export default function ResetPasswordPage() {
  const [listo, setListo] = useState(false)
  const [session, setSession] = useState(null)

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setListo(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY' || newSession) {
        setSession(newSession)
        setListo(true)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    if (password !== passwordConfirm) return setError('Las contraseñas no coinciden')

    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setEnviando(false)

    if (error) setError(error.message)
    else setExito(true)
  }

  if (!listo) {
    return (
      <div className="page-center">
        <p className="texto-muted">Comprobando el enlace…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="page-center">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-brand-dot" />
            Filà
          </div>
          <p className="error-texto">
            Este enlace no es válido o ha caducado. Solicita uno nuevo desde "¿Olvidaste tu
            contraseña?" en la pantalla de inicio de sesión.
          </p>
          <a href="/index.html" className="btn-secundario btn-link-boton">
            Volver al inicio
          </a>
        </div>
      </div>
    )
  }

  if (exito) {
    return (
      <div className="page-center">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-brand-dot" />
            Filà
          </div>
          <p className="exito-texto">Contraseña actualizada correctamente.</p>
          <a href="/index.html" className="btn-primario btn-link-boton">
            Ir a iniciar sesión
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="page-center">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-dot" />
          Filà
        </div>

        <h2 className="dashboard-saludo">Elige tu nueva contraseña</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="campo">
            <label>Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="campo">
            <label>Repite la contraseña</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          {error && <p className="error-texto">{error}</p>}

          <button type="submit" className="btn-primario" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}