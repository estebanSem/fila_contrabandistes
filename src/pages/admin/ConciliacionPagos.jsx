import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'
import FesterDetalleModal from './FesterDetalleModal.jsx'

function NombreFester({ id, nombre, apellido, onAbrir }) {
  return (
    <a
      href="#"
      className="link-fester"
      onClick={(e) => {
        e.preventDefault()
        onAbrir(id)
      }}
    >
      {nombre} {apellido}
    </a>
  )
}

export default function ConciliacionPagos() {
  const [pagos, setPagos] = useState([])
  const [paginaPendientes, setPaginaPendientes] = useState(0)
  const [paginaPagados, setPaginaPagados] = useState(0)
  const [masPendientes, setMasPendientes] = useState(false)
  const [masPagados, setMasPagados] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [movimientos, setMovimientos] = useState('')
  const [resultado, setResultado] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState(null)
  const [procesando, setProcesando] = useState(false)

  const [pagoDetalle, setPagoDetalle] = useState(null) // { id_pago, concepto, importe_total, fester, lineas }
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [festerAbiertoId, setFesterAbiertoId] = useState(null)

  useEffect(() => {
    cargarPagos()
  }, [paginaPendientes, paginaPagados])

  async function cargarPagos() {
    setLoading(true)
    setError(null)
    const obtener = (estado, pagina) => supabase.from('pagos_cuotas')
      .select('*, fester(nombre, primer_apellido)').eq('estado', estado)
      .order('creacion_ticket', { ascending: false }).range(pagina * 25, pagina * 25 + 25)
    const [pendientes, pagados] = await Promise.all([
      obtener('PENDIENTE', paginaPendientes), obtener('PAGADO', paginaPagados),
    ])
    if (pendientes.error || pagados.error) setError((pendientes.error || pagados.error).message)
    else {
      setPagos([...pendientes.data.slice(0, 25), ...pagados.data.slice(0, 25)])
      setMasPendientes(pendientes.data.length > 25)
      setMasPagados(pagados.data.length > 25)
    }
    setLoading(false)
  }

  async function marcarPagado(idPago) {
    if (!confirm('¿Confirmar que el importe figura en el banco?')) return
    const { error } = await supabase.rpc('confirmar_pago_cuota', { p_id_pago: idPago })
    if (error) return setError(error.message)
    cargarPagos()
  }

  async function verDetalle(pago) {
    setCargandoDetalle(true)
    setError(null)
    // Trae cada línea del pago, con el acto (a través de la cuota) y el
    // festero al que pertenece esa línea concreta (puede ser el propio
    // responsable o uno de sus hijos).
    const { data, error } = await supabase
      .from('detalle_pago')
      .select('id_detalle, id_fester, importe_total, cuota(precio, acto(nombre)), fester(nombre, primer_apellido)')
      .eq('id_pago', pago.id_pago)

    setCargandoDetalle(false)
    if (error) {
      setError(error.message)
      return
    }

    setPagoDetalle({
      id_pago: pago.id_pago,
      concepto: pago.concepto,
      importe_total: pago.importe_total,
      idResponsable: pago.id_fester,
      responsable: pago.fester,
      lineas: data,
    })
  }

  function cerrarDetalle() {
    setPagoDetalle(null)
  }

  function analizarMovimientos() {
    const lineas = movimientos.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (!lineas.length) throw new Error('Introduce al menos un movimiento.')
    if (lineas.length > 100) throw new Error('Máximo 100 movimientos por lote.')
    const conceptos = new Set()
    return lineas.map((linea, index) => {
      const partes = linea.split(';')
      if (partes.length !== 2 || !partes[0].trim() || !/^\d+(?:[.,]\d{1,2})?$/.test(partes[1].trim())) {
        throw new Error(`Línea ${index + 1}: usa concepto;importe, con hasta dos decimales.`)
      }
      const concepto = partes[0].trim()
      if (conceptos.has(concepto)) throw new Error(`Concepto duplicado: ${concepto}`)
      conceptos.add(concepto)
      return { concepto, importe: Number(partes[1].trim().replace(',', '.')) }
    })
  }

  async function previsualizar() {
    setResultado(null)
    setVistaPrevia(null)
    try {
      const movs = analizarMovimientos()
      setProcesando(true)
      const { data, error } = await supabase.rpc('previsualizar_conciliacion', { p_movimientos: movs })
      if (error) throw error
      setVistaPrevia({ movs, resultados: data })
    } catch (err) { setResultado('Error: ' + err.message) }
    finally { setProcesando(false) }
  }

  async function conciliarAutomatico() {
    if (!vistaPrevia || !confirm('¿Aplicar únicamente las coincidencias válidas de la vista previa?')) return
    setProcesando(true)
    const { data, error } = await supabase.rpc('conciliar_pagos_cuotas_seguro', { p_movimientos: vistaPrevia.movs })
    setProcesando(false)
    if (error) setResultado('Error: ' + error.message)
    else {
      setResultado(`Conciliación aplicada: ${data.actualizados} pagos. Revisa los resultados antes de cerrar.`)
      setVistaPrevia(null)
      setMovimientos('')
      cargarPagos()
    }
  }

  if (loading) return <p className="texto-muted">Cargando…</p>

  const pendientes = pagos.filter((p) => p.estado === 'PENDIENTE')
  const pagados = pagos.filter((p) => p.estado === 'PAGADO')

  return (
    <div>
      {error && <p className="error-texto">{error}</p>}

      <h3 className="cuotas-titulo">Pagos pendientes</h3>
      <div className="admin-tabla-wrap">
        <table className="admin-tabla-real">
          <thead>
            <tr>
              <th>Responsable</th>
              <th>Concepto</th>
              <th>Importe</th>
              <th>Creado</th>
              <th className="col-acciones"></th>
            </tr>
          </thead>
          <tbody>
            {pendientes.map((p) => (
              <tr key={p.id_pago}>
                <td>
                  <NombreFester
                    id={p.id_fester}
                    nombre={p.fester?.nombre}
                    apellido={p.fester?.primer_apellido}
                    onAbrir={setFesterAbiertoId}
                  />
                </td>
                <td>{p.concepto}</td>
                <td>{Number(p.importe_total).toFixed(2)} €</td>
                <td>{new Date(p.creacion_ticket).toLocaleDateString()}</td>
                <td className="col-acciones">
                  <div className="admin-acciones">
                    <button type="button" className="btn-mini btn-mini-secundario" onClick={() => verDetalle(p)}>
                      Ver detalle
                    </button>
                    <button type="button" className="btn-mini" onClick={() => marcarPagado(p.id_pago)}>
                      Marcar pagado
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pendientes.length === 0 && (
          <p className="texto-muted" style={{ padding: 12 }}>
            No hay pagos pendientes.
          </p>
        )}
      </div>
      <div className="paginacion">
        <button type="button" disabled={paginaPendientes === 0} onClick={() => setPaginaPendientes(paginaPendientes - 1)}>Anterior</button>
        <span>Página {paginaPendientes + 1}</span>
        <button type="button" disabled={!masPendientes} onClick={() => setPaginaPendientes(paginaPendientes + 1)}>Siguiente</button>
      </div>

      
      <h3 className="cuotas-titulo">Conciliar movimientos</h3>
      <p>Una línea por transferencia: concepto;importe. Ejemplo: FILA-123;25,00</p>
      <textarea className="movimientos-input" aria-label="Movimientos bancarios" rows="5" value={movimientos}
        onChange={(e) => { setMovimientos(e.target.value); setVistaPrevia(null) }} />
      <button type="button" className="btn-mini" disabled={procesando} onClick={previsualizar}>Previsualizar</button>
      {resultado && <div className="resultado" role="status">{resultado}</div>}
      {vistaPrevia && <div className="admin-tabla-wrap">
        <table className="admin-tabla-real"><thead><tr><th>Concepto</th><th>Importe</th><th>Resultado</th></tr></thead>
          <tbody>{vistaPrevia.resultados.map((r, i) => <tr key={i}><td>{r.concepto}</td><td>{Number(r.importe).toFixed(2)} €</td><td>{r.estado}</td></tr>)}</tbody>
        </table>
        <button type="button" className="btn-primario" disabled={procesando || !vistaPrevia.resultados.some((r) => r.estado === 'COINCIDE')} onClick={conciliarAutomatico}>Aplicar coincidencias</button>
      </div>}

      <h3 className="cuotas-titulo" style={{ marginTop: 28 }}>
        Pagos confirmados
      </h3>
      <div className="admin-tabla-wrap">
        <table className="admin-tabla-real">
          <thead>
            <tr>
              <th>Responsable</th>
              <th>Concepto</th>
              <th>Importe</th>
              <th>Fecha de pago</th>
              <th className="col-acciones"></th>
            </tr>
          </thead>
          <tbody>
            {pagados.map((p) => (
              <tr key={p.id_pago}>
                <td>
                  <NombreFester
                    id={p.id_fester}
                    nombre={p.fester?.nombre}
                    apellido={p.fester?.primer_apellido}
                    onAbrir={setFesterAbiertoId}
                  />
                </td>
                <td>{p.concepto}</td>
                <td>{Number(p.importe_total).toFixed(2)} €</td>
                <td>{p.fecha_pago ? new Date(p.fecha_pago).toLocaleString() : ''}</td>
                <td className="col-acciones">
                  <button type="button" className="btn-mini btn-mini-secundario" onClick={() => verDetalle(p)}>
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagados.length === 0 && (
          <p className="texto-muted" style={{ padding: 12 }}>
            Todavía no hay pagos confirmados.
          </p>
        )}
      </div>
      <div className="paginacion">
        <button type="button" disabled={paginaPagados === 0} onClick={() => setPaginaPagados(paginaPagados - 1)}>Anterior</button>
        <span>Página {paginaPagados + 1}</span>
        <button type="button" disabled={!masPagados} onClick={() => setPaginaPagados(paginaPagados + 1)}>Siguiente</button>
      </div>

      {(cargandoDetalle || pagoDetalle) && (
        <div className="modal-overlay" onClick={cerrarDetalle}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            {cargandoDetalle ? (
              <p className="texto-muted">Cargando detalle…</p>
            ) : (
              <>
                <h3 className="cuotas-titulo">Detalle del pago</h3>

                <div className="dato">
                  <span className="label">Responsable</span>
                  <b>
                    <NombreFester
                      id={pagoDetalle.idResponsable}
                      nombre={pagoDetalle.responsable?.nombre}
                      apellido={pagoDetalle.responsable?.primer_apellido}
                      onAbrir={setFesterAbiertoId}
                    />
                  </b>
                </div>
                <div className="dato">
                  <span className="label">Concepto</span>
                  <b>{pagoDetalle.concepto}</b>
                </div>

                <div className="carrito-lista" style={{ marginTop: 16 }}>
                  {pagoDetalle.lineas.map((l) => (
                    <div key={l.id_detalle} className="carrito-item">
                      <div className="carrito-item-info">
                        <span className="carrito-item-acto">{l.cuota?.acto?.nombre}</span>
                        <span className="carrito-item-festero">
                          <NombreFester
                            id={l.id_fester}
                            nombre={l.fester?.nombre}
                            apellido={l.fester?.primer_apellido}
                            onAbrir={setFesterAbiertoId}
                          />
                        </span>
                      </div>
                      <span className="precio">{Number(l.importe_total).toFixed(2)} €</span>
                    </div>
                  ))}
                </div>

                <div className="total-box">
                  <span>Total del pago</span>
                  <span>{Number(pagoDetalle.importe_total).toFixed(2)} €</span>
                </div>

                <button type="button" className="btn-secundario" onClick={cerrarDetalle}>
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {festerAbiertoId && (
        <FesterDetalleModal idFester={festerAbiertoId} onClose={() => setFesterAbiertoId(null)} />
      )}
    </div>
  )
}
