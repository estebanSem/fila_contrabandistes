import { useState } from 'react'
import { supabase } from '../../supabaseClient.js'

export default function CompletarPerfil({ session, onCompleto }) {
  const m = session.user.user_metadata || {}
  const [datos, setDatos] = useState({
    dni: m.dni || '', nombre: m.nombre || '', primer_apellido: m.primer_apellido || '',
    segundo_apellido: m.segundo_apellido || '', fecha_nac: m.fecha_nac || '',
    sexo: m.sexo || 'HOMBRE', telefono: m.telefono || '',
  })
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  async function guardar(e) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const { error } = await supabase.rpc('completar_registro', {
      p_dni: datos.dni.trim(), p_nombre: datos.nombre.trim(),
      p_primer_apellido: datos.primer_apellido.trim(), p_segundo_apellido: datos.segundo_apellido.trim(),
      p_fecha_nac: datos.fecha_nac, p_sexo: datos.sexo, p_telefono: datos.telefono.trim(),
    })
    setEnviando(false)
    if (error) setError(error.message)
    else onCompleto()
  }
  return <form className="auth-form" onSubmit={guardar}>
    <h2>Completar ficha de festero</h2>
    <p>Tu cuenta existe, pero falta vincular la ficha. Comprueba los datos y guárdala.</p>
    {Object.entries({ dni: 'DNI/NIE', nombre: 'Nombre', primer_apellido: 'Primer apellido',
      segundo_apellido: 'Segundo apellido', fecha_nac: 'Fecha de nacimiento', telefono: 'Teléfono' }).map(([key, label]) =>
      <div className="campo" key={key}><label htmlFor={key}>{label}</label><input id={key}
        type={key === 'fecha_nac' ? 'date' : 'text'} required value={datos[key]}
        onChange={e => setDatos({ ...datos, [key]: e.target.value })} /></div>)}
    <div className="campo"><label htmlFor="sexo">Sexo</label><select id="sexo" value={datos.sexo}
      onChange={e => setDatos({ ...datos, sexo: e.target.value })}>
      <option value="HOMBRE">Hombre</option><option value="MUJER">Mujer</option><option value="OTRO">Otro</option>
    </select></div>
    {error && <p className="error-texto">{error}</p>}
    <button className="btn-primario" disabled={enviando}>Completar ficha</button>
    <button type="button" className="btn-secundario" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
  </form>
}
