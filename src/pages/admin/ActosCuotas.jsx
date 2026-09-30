import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'

const SEXOS = ['HOMBRE', 'MUJER', 'AMBOS']
const POR_PAGINA = 10

export default function ActosTarifas() {
  const [actos, setActos] = useState([])
  const [cuotas, setCuotas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [nuevoActo, setNuevoActo] = useState('')
  const [editandoActoId, setEditandoActoId] = useState(null)
  const [editActoNombre, setEditActoNombre] = useState('')

  const [formCuota, setFormCuota] = useState(null)

  const [actoFiltroId, setActoFiltroId] = useState(null)
  const [paginaActual, setPaginaActual] = useState(1)

  useEffect(() => {
    cargarTodo()
  }, [])

  async function cargarTodo() {
    setLoading(true)
    setError(null)
    const [actosRes, cuotasRes] = await Promise.all([
      supabase.from('acto').select('*').eq('activo', true).order('nombre'),
      supabase.from('cuota').select('*, acto(nombre)').eq('activo', true).order('id_cuota'),
    ])
    if (actosRes.error || cuotasRes.error) {
      setError((actosRes.error || cuotasRes.error).message)
    } else {
      setActos(actosRes.data)
      setCuotas(cuotasRes.data)
    }
    setLoading(false)
  }

  // ---------- ACTOS ----------

  async function crearActo(e) {
    e.preventDefault()
    if (!nuevoActo.trim()) return
    const { error } = await supabase.from('acto').insert({ nombre: nuevoActo.trim() })
    if (error) return setError(error.message)
    setNuevoActo('')
    cargarTodo()
  }

  function empezarEditarActo(a) {
    setEditandoActoId(a.id_acto)
    setEditActoNombre(a.nombre)
  }

  async function guardarActo(id) {
    const { error } = await supabase.from('acto').update({ nombre: editActoNombre.trim() }).eq('id_acto', id)
    if (error) return setError(error.message)
    setEditandoActoId(null)
    cargarTodo()
  }

  async function borrarActo(id) {
    if (!confirm('¿Archivar este acto y sus tarifas? Los pagos anteriores se conservarán.')) return
    const { error } = await supabase.rpc('archivar_acto', { p_id_acto: id })
    if (error) return setError(error.message)
    cargarTodo()
  }

  // ---------- CUOTAS ----------

  function seleccionarActoFiltro(id) {
    setActoFiltroId(id)
    setPaginaActual(1)
  }

  function nuevaCuotaForm() {
    setFormCuota({
      id_acto: actoActivo || actos[0]?.id_acto || '',
      precio: '',
      sexo_cuota: 'AMBOS',
      eres_socio: false,
      edad_min: 0,
      edad_max: 99,
    })
  }

  function editarCuotaForm(t) {
    setFormCuota({
      id_cuota: t.id_cuota,
      id_acto: t.id_acto,
      precio: t.precio,
      sexo_cuota: t.sexo_cuota,
      eres_socio: t.eres_socio,
      edad_min: t.edad_min,
      edad_max: t.edad_max,
    })
  }

  async function guardarCuota(e) {
    e.preventDefault()
    const payload = {
      id_acto: Number(formCuota.id_acto),
      precio: Number(formCuota.precio),
      sexo_cuota: formCuota.sexo_cuota,
      eres_socio: formCuota.eres_socio,
      edad_min: Number(formCuota.edad_min),
      edad_max: Number(formCuota.edad_max),
    }

    const res = formCuota.id_cuota
      ? await supabase.from('cuota').update(payload).eq('id_cuota', formCuota.id_cuota)
      : await supabase.from('cuota').insert(payload)

    if (res.error) return setError(res.error.message)
    setFormCuota(null)
    cargarTodo()
  }

  async function borrarCuota(id) {
    if (!confirm('¿Archivar esta tarifa? Los pagos anteriores se conservarán.')) return
    const { error } = await supabase.rpc('archivar_cuota', { p_id_cuota: id })
    if (error) return setError(error.message)
    cargarTodo()
  }

  if (loading) return <p className="texto-muted">Cargando…</p>

  const actoActivo = actos.find((a) => a.id_acto === actoFiltroId) ? actoFiltroId : actos[0]?.id_acto ?? null

  const cuotasFiltradas = cuotas.filter((t) => t.id_acto === actoActivo)
  const totalPaginas = Math.max(1, Math.ceil(cuotasFiltradas.length / POR_PAGINA))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const cuotasPagina = cuotasFiltradas.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA)

  return (
    <div>
      {error && <p className="error-texto">{error}</p>}

      <h3 className="cuotas-titulo">Actos</h3>
      <div className="admin-lista">
        {actos.map((a) => (
          <div key={a.id_acto} className="admin-fila">
            {editandoActoId === a.id_acto ? (
              <>
                <input value={editActoNombre} onChange={(e) => setEditActoNombre(e.target.value)} />
                <div className="admin-acciones">
                  <button type="button" className="btn-mini" onClick={() => guardarActo(a.id_acto)}>
                    Guardar
                  </button>
                  <button
                    type="button"
                    className="btn-mini btn-mini-secundario"
                    onClick={() => setEditandoActoId(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <span>{a.nombre}</span>
                <div className="admin-acciones">
                  <button
                    type="button"
                    className="btn-mini btn-mini-secundario"
                    onClick={() => empezarEditarActo(a)}
                  >
                    Editar
                  </button>
                  <button type="button" className="btn-mini btn-mini-danger" onClick={() => borrarActo(a.id_acto)}>
                    Archivar
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {actos.length === 0 && <p className="texto-muted admin-lista-vacio">Todavía no hay actos creados.</p>}
      </div>

      <form onSubmit={crearActo} className="admin-form-inline">
        <input
          placeholder="Nombre del nuevo acto"
          value={nuevoActo}
          onChange={(e) => setNuevoActo(e.target.value)}
        />
        <button type="submit" className="btn-mini">
          Añadir acto
        </button>
      </form>

      <h3 className="cuotas-titulo" style={{ marginTop: 28 }}>
        Cuotas
      </h3>

      {actos.length > 0 && (
        <div className="acto-selector">
          {actos.map((a) => (
            <button
              key={a.id_acto}
              type="button"
              className={`acto-pill ${actoActivo === a.id_acto ? 'acto-pill-activa' : ''}`}
              onClick={() => seleccionarActoFiltro(a.id_acto)}
            >
              {a.nombre}
            </button>
          ))}
        </div>
      )}

      <div className="admin-tabla-wrap">
        <table className="admin-tabla-real">
          <thead>
            <tr>
              <th>Acto</th>
              <th>Sexo</th>
              <th>Socio</th>
              <th>Edad</th>
              <th>Precio</th>
              <th className="col-acciones"></th>
            </tr>
          </thead>
          <tbody>
            {cuotasPagina.map((t) => (
              <tr key={t.id_cuota}>
                <td>{t.acto?.nombre}</td>
                <td>{t.sexo_cuota}</td>
                <td>{t.eres_socio ? 'Sí' : 'No'}</td>
                <td>
                  {t.edad_min}–{t.edad_max}
                </td>
                <td>{Number(t.precio).toFixed(2)} €</td>
                <td className="col-acciones">
                  <div className="admin-acciones">
                    <button type="button" className="btn-mini btn-mini-secundario" onClick={() => editarCuotaForm(t)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-mini btn-mini-danger"
                      onClick={() => borrarCuota(t.id_cuota)}
                    >
                        Archivar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cuotasFiltradas.length === 0 && (
          <p className="texto-muted" style={{ padding: 12 }}>
            {actos.length === 0 ? 'Todavía no hay actos creados.' : 'Este acto todavía no tiene cuotas.'}
          </p>
        )}
      </div>

      {cuotasFiltradas.length > POR_PAGINA && (
        <div className="paginacion">
          <button
            type="button"
            className="btn-mini btn-mini-secundario"
            disabled={paginaSegura <= 1}
            onClick={() => setPaginaActual(paginaSegura - 1)}
          >
            Anterior
          </button>
          <span className="paginacion-texto">
            Página {paginaSegura} de {totalPaginas}
          </span>
          <button
            type="button"
            className="btn-mini btn-mini-secundario"
            disabled={paginaSegura >= totalPaginas}
            onClick={() => setPaginaActual(paginaSegura + 1)}
          >
            Siguiente
          </button>
        </div>
      )}

      {formCuota ? (
        <form onSubmit={guardarCuota} className="admin-form-tarifa">
          <div className="fila-doble">
            <div className="campo">
              <label>Acto</label>
              <select
                value={formCuota.id_acto}
                onChange={(e) => setFormCuota({ ...formCuota, id_acto: e.target.value })}
              >
                {actos.map((a) => (
                  <option key={a.id_acto} value={a.id_acto}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label>Precio (€)</label>
              <input
                type="number"
                step="0.01"
                value={formCuota.precio}
                onChange={(e) => setFormCuota({ ...formCuota, precio: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="fila-doble">
            <div className="campo">
              <label>Sexo</label>
              <select
                value={formCuota.sexo_cuota}
                onChange={(e) => setFormCuota({ ...formCuota, sexo_cuota: e.target.value })}
              >
                {SEXOS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo campo-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={formCuota.eres_socio}
                  onChange={(e) => setFormCuota({ ...formCuota, eres_socio: e.target.checked })}
                />
                Es para socios
              </label>
            </div>
          </div>

          <div className="fila-doble">
            <div className="campo">
              <label>Edad mínima</label>
              <input
                type="number"
                value={formCuota.edad_min}
                onChange={(e) => setFormCuota({ ...formCuota, edad_min: e.target.value })}
                required
              />
            </div>
            <div className="campo">
              <label>Edad máxima</label>
              <input
                type="number"
                value={formCuota.edad_max}
                onChange={(e) => setFormCuota({ ...formCuota, edad_max: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="admin-acciones">
            <button type="submit" className="btn-mini">
              Guardar cuota
            </button>
            <button type="button" className="btn-mini btn-mini-secundario" onClick={() => setFormCuota(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn-mini" onClick={nuevaCuotaForm} style={{ marginTop: 12 }}>
          + Nueva cuota
        </button>
      )}
    </div>
  )
}
