import { useState } from 'react'
import { supabase } from '../../supabaseClient.js'

const initialForm = {
  dni: '',
  nombre: '',
  primerApellido: '',
  segundoApellido: '',
  fechaNacimiento: '',
  genero: '',
  email: '',
  telefono: '',
  password: '',
  passwordConfirm: '',
}

export default function RegistroForm({ onIrALogin }) {
  const [form, setForm] = useState(initialForm)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  function set(campo) {
    return (e) => setForm((prev) => ({ ...prev, [campo]: e.target.value }))
  }

  function validar() {
    if (!form.dni.trim()) return 'Indica tu DNI/NIE'
    if (!form.nombre.trim()) return 'Indica tu nombre'
    if (!form.primerApellido.trim()) return 'Indica tu primer apellido'
    if (!form.segundoApellido.trim()) return 'Indica tu segundo apellido'
    if (!form.fechaNacimiento) return 'Indica tu fecha de nacimiento'
    if (!form.genero) return 'Indica tu género'
    if (!form.email.trim()) return 'Indica tu email'
    if (!form.telefono.trim()) return 'Indica tu teléfono'
    if (form.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
    if (form.password !== form.passwordConfirm) return 'Las contraseñas no coinciden'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setExito(null)

    const mensajeValidacion = validar()
    if (mensajeValidacion) {
      setError(mensajeValidacion)
      return
    }

    setEnviando(true)

    // 1. Crear la cuenta de autenticación
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          dni: form.dni.trim(), nombre: form.nombre.trim(),
          primer_apellido: form.primerApellido.trim(), segundo_apellido: form.segundoApellido.trim(),
          fecha_nac: form.fechaNacimiento, sexo: form.genero, telefono: form.telefono.trim(),
        },
      },
    })

    if (authError || !authData.user) {
      setEnviando(false)
      setError(authError?.message || 'No se pudo crear la cuenta.')
      return
    }
    // La ficha se completa con una RPC autenticada al tener sesión. Si se
    // requiere confirmar email, el Dashboard la recupera al primer acceso.
    if (authData.session) {
      const { error: completarError } = await supabase.rpc('completar_registro', {
        p_dni: form.dni.trim(), p_nombre: form.nombre.trim(),
        p_primer_apellido: form.primerApellido.trim(), p_segundo_apellido: form.segundoApellido.trim(),
        p_fecha_nac: form.fechaNacimiento, p_sexo: form.genero, p_telefono: form.telefono.trim(),
      })
      if (completarError) {
        setEnviando(false)
        setError('Cuenta creada, pero falta completar la ficha. Entra de nuevo para reintentarlo: ' + completarError.message)
        return
      }
    }
    setEnviando(false)

    setForm(initialForm)
    setExito(
      authData.session
        ? '¡Cuenta creada correctamente!'
        : 'Cuenta creada. Revisa tu email para confirmar la cuenta antes de iniciar sesión.'
    )
  }

  if (exito) {
    return (
      <div className="auth-form">
        <p className="exito-texto">{exito}</p>
        <button type="button" className="btn-primario" onClick={onIrALogin}>
          Ir a iniciar sesión
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="fila-doble">
        <div className="campo">
          <label>Nombre</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required />
        </div>
        <div className="campo">
          <label>DNI / NIE</label>
          <input type="text" value={form.dni} onChange={set('dni')} required />
        </div>
      </div>

      <div className="fila-doble">
        <div className="campo">
          <label>Primer apellido</label>
          <input type="text" value={form.primerApellido} onChange={set('primerApellido')} required />
        </div>
        <div className="campo">
          <label>Segundo apellido</label>
          <input type="text" value={form.segundoApellido} onChange={set('segundoApellido')} required />
        </div>
      </div>

      <div className="fila-doble">
        <div className="campo">
          <label>Fecha de nacimiento</label>
          <input
            type="date"
            value={form.fechaNacimiento}
            onChange={set('fechaNacimiento')}
            required
          />
        </div>
        <div className="campo">
          <label>Género</label>
          <select value={form.genero} onChange={set('genero')} required>
            <option value="" disabled>
              Selecciona
            </option>
            <option value="HOMBRE">Hombre</option>
            <option value="MUJER">Mujer</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
      </div>

      <div className="campo">
        <label>Email</label>
        <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
      </div>

      <div className="campo">
        <label>Teléfono</label>
        <input type="tel" value={form.telefono} onChange={set('telefono')} required />
      </div>

      <div className="fila-doble">
        <div className="campo">
          <label>Contraseña</label>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="campo">
          <label>Repite la contraseña</label>
          <input
            type="password"
            value={form.passwordConfirm}
            onChange={set('passwordConfirm')}
            autoComplete="new-password"
            required
          />
        </div>
      </div>

      {error && <p className="error-texto">{error}</p>}

      <button type="submit" className="btn-primario" disabled={enviando}>
        {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>

      <p className="auth-switch">
        ¿Ya tienes cuenta?{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onIrALogin()
          }}
        >
          Inicia sesión
        </a>
      </p>
    </form>
  )
}
