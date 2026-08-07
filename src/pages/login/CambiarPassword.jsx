import { useState } from 'react'
import { supabase } from '../../supabaseClient.js'

export default function CambiarPassword() {
  const [abierto, setAbierto] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(false)

  function abrir() {
    setAbierto(true)
    setError(null)
    setExito(false)
    setPassword('')
    setPasswordConfirm('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setExito(false)

    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    if (password !== passwordConfirm) return setError('Las contraseñas no coinciden')

    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setEnviando(false)

    if (error) {
      setError(error.message)
    } else {
      setExito(true)
      setPassword('')
      setPasswordConfirm('')
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="btn-secundario" onClick={abrir}>
        Cambiar contraseña
      </button>
    )
  }

  return (
    <div className="cuotas-bloque">
      <h3 className="cuotas-titulo">Cambiar contraseña</h3>

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
        {exito && <p className="exito-texto">Contraseña actualizada correctamente.</p>}

        <div className="admin-acciones">
          <button type="submit" className="btn-mini" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" className="btn-mini btn-mini-secundario" onClick={() => setAbierto(false)}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}