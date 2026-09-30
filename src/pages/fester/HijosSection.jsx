import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'
import CuotasSelector from '../cuotas/CuotasSelector.jsx'

function formularioVacio() {
  return {
    nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    fecha_nac: '',
    sexo: 'HOMBRE',
    dni: '',
    // email y teléfono son UNIQUE en la tabla: no se pueden repetir con los
    // del responsable, así que se dejan vacíos (se guardan como NULL).
    email: '',
    telefono: '',
    es_socio: false,
  }
}

export default function HijosSection({ responsable }) {
  const [hijos, setHijos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)
  const [hijoConCuotasId, setHijoConCuotasId] = useState(null)

  useEffect(() => {
    cargarHijos()
  }, [responsable.id_fester])

  async function cargarHijos() {
    setLoading(true)
    setError(null)
    // Protegido por la policy "fester lee sus hijos" (id_fester_responsable = mi_id_fester())
    const { data, error } = await supabase
      .from('fester')
      .select('*')
      .eq('id_fester_responsable', responsable.id_fester)
      .eq('activo', true)
      .order('fecha_nac')
    if (error) setError(error.message)
    else setHijos(data)
    setLoading(false)
  }

  function empezarCrear() {
    setForm(formularioVacio())
  }

  function empezarEditar(h) {
    setForm({ ...h })
  }

  async function guardar(e) {
    e.preventDefault()
    const payload = {
      nombre: form.nombre.trim(),
      primer_apellido: form.primer_apellido.trim(),
      segundo_apellido: form.segundo_apellido.trim(),
      fecha_nac: form.fecha_nac,
      sexo: form.sexo,
      dni: form.dni.trim() || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      es_socio: form.es_socio,
      id_fester_responsable: responsable.id_fester,
    }

    const res = form.id_fester
      ? await supabase.from('fester').update(payload).eq('id_fester', form.id_fester)
      : await supabase.from('fester').insert(payload)

    if (res.error) return setError(res.error.message)
    setForm(null)
    cargarHijos()
  }

  async function borrar(id) {
    if (!confirm('¿Archivar este hijo/a? Su historial de pagos se conservará.')) return
    const { error } = await supabase.rpc('archivar_festero', { p_id_fester: id })
    if (error) return setError(error.message)
    if (hijoConCuotasId === id) setHijoConCuotasId(null)
    cargarHijos()
  }

  function toggleCuotas(id) {
    setHijoConCuotasId((prev) => (prev === id ? null : id))
  }

  if (loading) return <p className="texto-muted">Cargando hijos…</p>

  if (form) {
    return (
      <div className="cuotas-bloque">
        <h3 className="cuotas-titulo">{form.id_fester ? 'Editar hijo/a' : 'Nuevo hijo/a'}</h3>
        <form onSubmit={guardar} className="admin-form-tarifa">
          <div className="fila-doble">
            <div className="campo">
              <label>Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div className="campo">
              <label>DNI (si tiene)</label>
              <input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
            </div>
          </div>

          <div className="fila-doble">
            <div className="campo">
              <label>Primer apellido</label>
              <input
                value={form.primer_apellido}
                onChange={(e) => setForm({ ...form, primer_apellido: e.target.value })}
                required
              />
            </div>
            <div className="campo">
              <label>Segundo apellido</label>
              <input
                value={form.segundo_apellido}
                onChange={(e) => setForm({ ...form, segundo_apellido: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="fila-doble">
            <div className="campo">
              <label>Fecha de nacimiento</label>
              <input
                type="date"
                value={form.fecha_nac || ''}
                onChange={(e) => setForm({ ...form, fecha_nac: e.target.value })}
                required
              />
            </div>
            <div className="campo">
              <label>Sexo</label>
              <select value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value })}>
                <option value="HOMBRE">Hombre</option>
                <option value="MUJER">Mujer</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </div>

          <div className="fila-doble">
            <div className="campo">
              <label>Teléfono (opcional)</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
            <div className="campo">
              <label>Email (opcional)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <p className="texto-muted">Condición de socio: {form.es_socio ? 'Sí' : 'No'}. Solicita cualquier cambio a la tesorería.</p>

          <p className="texto-muted" style={{ marginTop: -8, marginBottom: 16 }}>
            Teléfono y email son opcionales — al ser campos únicos, no pueden repetir los tuyos.
          </p>

          {error && <p className="error-texto">{error}</p>}

          <div className="admin-acciones">
            <button type="submit" className="btn-mini">
              Guardar
            </button>
            <button type="button" className="btn-mini btn-mini-secundario" onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="cuotas-bloque">
      <h3 className="cuotas-titulo">Hijos a cargo</h3>

      {error && <p className="error-texto">{error}</p>}

      {hijos.length === 0 && <p className="texto-muted">Todavía no has añadido a ningún hijo/a.</p>}

      <div className="hijos-lista">
        {hijos.map((h) => (
          <div key={h.id_fester} className="admin-fila hijo-fila">
            <span>
              {h.nombre} {h.primer_apellido}
            </span>
            <div className="admin-acciones">
              <button
                type="button"
                className="btn-mini btn-mini-secundario"
                onClick={() => toggleCuotas(h.id_fester)}
              >
                {hijoConCuotasId === h.id_fester ? 'Ocultar cuotas' : 'Ver cuotas'}
              </button>
              <button type="button" className="btn-mini btn-mini-secundario" onClick={() => empezarEditar(h)}>
                Editar
              </button>
              <button type="button" className="btn-mini btn-mini-danger" onClick={() => borrar(h.id_fester)}>
                Archivar
              </button>
            </div>
          </div>
        ))}
      </div>

      {hijos.map((h) =>
        hijoConCuotasId === h.id_fester ? (
          <div key={`cuotas-${h.id_fester}`} style={{ marginTop: 12 }}>
            <p className="texto-muted" style={{ marginBottom: 6 }}>
              Cuotas de {h.nombre}:
            </p>
            <CuotasSelector idFester={h.id_fester} nombreFester={`${h.nombre} ${h.primer_apellido}`} />
          </div>
        ) : null
      )}

      <button type="button" className="btn-mini" onClick={empezarCrear} style={{ marginTop: 12 }}>
        + Añadir hijo/a
      </button>
    </div>
  )
}
