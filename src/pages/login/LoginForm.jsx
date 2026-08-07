import { useState } from 'react'
import { supabase } from '../../supabaseClient.js'

export default function LoginForm({ onIrARegistro }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const [modoRecuperar, setModoRecuperar] = useState(false)
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [enviandoRecuperar, setEnviandoRecuperar] = useState(false)
  const [mensajeRecuperar, setMensajeRecuperar] = useState(null)
  const [errorRecuperar, setErrorRecuperar] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setEnviando(false)
    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : signInError.message
      )
    }
    // Si no hay error, el listener onAuthStateChange de AuthPage
    // se encarga de mostrar el Dashboard automáticamente.
  }

  async function handleRecuperar(e) {
    e.preventDefault()
    setErrorRecuperar(null)
    setMensajeRecuperar(null)
    setEnviandoRecuperar(true)

    // Supabase envía un email con un enlace que, al hacer clic, abre
    // reset-password.html con una sesión de recuperación ya activa.
    const { error: recuperarError } = await supabase.auth.resetPasswordForEmail(emailRecuperar.trim(), {
      redirectTo: `${window.location.origin}/reset-password.html`,
    })

    setEnviandoRecuperar(false)
    if (recuperarError) {
      setErrorRecuperar(recuperarError.message)
    } else {
      // Por seguridad, Supabase no distingue si el email existe o no en
      // la respuesta, así que el mensaje es siempre el mismo.
      setMensajeRecuperar('Si ese email tiene una cuenta, te hemos enviado un enlace para restablecer la contraseña.')
    }
  }

  function volverALogin(e) {
    e.preventDefault()
    setModoRecuperar(false)
    setErrorRecuperar(null)
    setMensajeRecuperar(null)
  }

  function irARecuperar(e) {
    e.preventDefault()
    setModoRecuperar(true)
  }

  function irARegistroClick(e) {
    e.preventDefault()
    onIrARegistro()
  }

  if (modoRecuperar) {
    return (
      <form onSubmit={handleRecuperar} className="auth-form">
        <p className="texto-muted" style={{ marginBottom: 16 }}>
          Indica tu email y te enviaremos un enlace para restablecer tu contraseña.
        </p>

        <div className="campo">
          <label>Email</label>
          <input
            type="email"
            value={emailRecuperar}
            onChange={(e) => setEmailRecuperar(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        {errorRecuperar && <p className="error-texto">{errorRecuperar}</p>}
        {mensajeRecuperar && <p className="exito-texto">{mensajeRecuperar}</p>}

        <button type="submit" className="btn-primario" disabled={enviandoRecuperar}>
          {enviandoRecuperar ? 'Enviando…' : 'Enviar enlace'}
        </button>

        <p className="auth-switch">
          <a href="#" onClick={volverALogin}>← Volver a iniciar sesión</a>
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="campo">
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div className="campo">
        <label>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      {error && <p className="error-texto">{error}</p>}

      <button type="submit" className="btn-primario" disabled={enviando}>
        {enviando ? 'Entrando…' : 'Iniciar sesión'}
      </button>

      <p className="auth-switch">
        <a href="#" onClick={irARecuperar}>¿Olvidaste tu contraseña?</a>
      </p>

      <p className="auth-switch">
        ¿No tienes cuenta?{' '}
        <a href="#" onClick={irARegistroClick}>Regístrate</a>
      </p>
    </form>
  )
}