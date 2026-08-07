import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'
import FesterDetalleModal from './FesterDetalleModal.jsx'

const initialForm = {
  dni: '',
  nombre: '',
  primer_apellido: '',
  segundo_apellido: '',
  fecha_nac: '',
  sexo: 'HOMBRE',
  es_socio: false,
  es_admin: false,
  email: '',
  telefono: '',
}

export default function FestersCRUD() {
  const [festers, setFesters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(null)
  const [festerAbiertoId, setFesterAbiertoId] = useState(null)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('fester').select('*').order('nombre')
    if (error) setError(error.message)
    else setFesters(data || [])
    setLoading(false)
  }

  function empezarCrear() {
    setForm({ ...initialForm })
  }

  function empezarEditar(f) {
    setForm({
      ...f,
      fecha_nac: f.fecha_nac || '', // Evita warn en input date si es null
    })
  }

  async function guardar(e) {
    e.preventDefault()
    const payload = {
      dni: form.dni?.trim() || '',
      nombre: form.nombre?.trim() || '',
      primer_apellido: form.primer_apellido?.trim() || '',
      segundo_apellido: form.segundo_apellido?.trim() || '',
      fecha_nac: form.fecha_nac || null,
      sexo: form.sexo,
      es_socio: form.es_socio,
      es_admin: form.es_admin,
      email: form.email?.trim() || '',
      telefono: form.telefono?.trim() || '',
    }

    const res = form.id_fester
      ? await supabase.from('fester').update(payload).eq('id_fester', form.id_fester)
      : await supabase.from('fester').insert(payload)

    if (res.error) return setError(res.error.message)
    setForm(null)
    cargar()
  }

  async function borrar(id) {
    if (!confirm('¿Borrar este festero? También se borrarán sus pagos.')) return
    const { error } = await supabase.from('fester').delete().eq('id_fester', id)
    if (error) return setError(error.message)
    cargar()
  }

  const filtrados = festers.filter((f) => {
    const texto = busqueda.toLowerCase()
    return (
      (f.nombre || '').toLowerCase().includes(texto) ||
      (f.primer_apellido || '').toLowerCase().includes(texto) ||
      (f.dni || '').toLowerCase().includes(texto) ||
      (f.email || '').toLowerCase().includes(texto)
    )
  })

  if (loading) return <p className="texto-muted">Cargando…</p>

  if (form) {
    return (
      <form onSubmit={guardar} className="admin-form-tarifa">
        <h3 className="cuotas-titulo">{form.id_fester ? 'Editar festero' : 'Nuevo festero'}</h3>

        <div className="fila-doble">
          <div className="campo">
            <label>Nombre</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </div>
          <div className="campo">
            <label>DNI / NIE</label>
            <input
              value={form.dni}
              onChange={(e) => setForm({ ...form, dni: e.target.value })}
              required
            />
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

        <div className="campo">
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="campo">
          <label>Teléfono</label>
          <input
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            required
          />
        </div>

        <div className="fila-doble">
          <div className="campo campo-checkbox">
            <label>
              <input
                type="checkbox"
                checked={form.es_socio}
                onChange={(e) => setForm({ ...form, es_socio: e.target.checked })}
              />
              Es socio
            </label>
          </div>
          <div className="campo campo-checkbox">
            <label>
              <input
                type="checkbox"
                checked={form.es_admin}
                onChange={(e) => setForm({ ...form, es_admin: e.target.checked })}
              />
              Es administrador
            </label>
          </div>
        </div>

        {!form.id_fester && (
          <p className="texto-muted" style={{ marginTop: -8, marginBottom: 16 }}>
            Este festero se crea sin cuenta de acceso propia (no podrá iniciar sesión hasta que se
            registre él mismo con este mismo DNI/email).
          </p>
        )}

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
    )
  }

  return (
    <div>
      {error && <p className="error-texto">{error}</p>}

      <div className="admin-toolbar">
        <input
          placeholder="Buscar por nombre, DNI o email…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <button type="button" className="btn-mini" onClick={empezarCrear}>
          + Nuevo festero
        </button>
      </div>

      <div className="admin-tabla-wrap">
        <table className="admin-tabla-real">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>DNI</th>
              <th>Email</th>
              <th>Socio</th>
              <th>Admin</th>
              <th className="col-acciones"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((f) => (
              <tr key={f.id_fester}>
                <td>
                  <a
                    href="#"
                    className="link-fester"
                    onClick={(e) => {
                      e.preventDefault()
                      setFesterAbiertoId(f.id_fester)
                    }}
                  >
                    {f.nombre} {f.primer_apellido}
                  </a>
                </td>
                <td>{f.dni}</td>
                <td>{f.email}</td>
                <td>{f.es_socio ? 'Sí' : 'No'}</td>
                <td>{f.es_admin ? 'Sí' : 'No'}</td>
                <td className="col-acciones">
                  <div className="admin-acciones">
                    <button
                      type="button"
                      className="btn-mini btn-mini-secundario"
                      onClick={() => empezarEditar(f)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-mini btn-mini-danger"
                      onClick={() => borrar(f.id_fester)}
                    >
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && (
          <p className="texto-muted" style={{ padding: 12 }}>
            No hay festeros que coincidan.
          </p>
        )}
      </div>

      {festerAbiertoId && (
        <FesterDetalleModal idFester={festerAbiertoId} onClose={() => setFesterAbiertoId(null)} />
      )}
    </div>
  )
}