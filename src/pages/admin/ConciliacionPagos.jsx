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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [movimientos, setMovimientos] = useState('')
  const [resultado, setResultado] = useState(null)
  const [procesando, setProcesando] = useState(false)

  const [pagoDetalle, setPagoDetalle] = useState(null) // { id_pago, concepto, importe_total, fester, lineas }
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [festerAbiertoId, setFesterAbiertoId] = useState(null)

  useEffect(() => {
    cargarPagos()
  }, [])

  async function cargarPagos() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('pagos_cuotas')
      .select('*, fester(nombre, primer_apellido)')
      .order('creacion_ticket', { ascending: false })
    if (error) setError(error.message)
    else setPagos(data)
    setLoading(false)
  }

  async function marcarPagado(idPago) {
    const { error } = await supabase
      .from('pagos_cuotas')
      .update({ estado: 'PAGADO', fecha_pago: new Date().toISOString() })
      .eq('id_pago', idPago)
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

  async function conciliarAutomatico() {
    setResultado(null)
    const lineas = movimientos.split('\n').filter(Boolean)
    const movs = lineas.map((linea) => {
      const [concepto, importe] = linea.split(';')
      return { concepto: (concepto || '').trim(), importe: Number((importe || '0').trim()) }
    })

    setProcesando(true)
    const { data, error } = await supabase.rpc('conciliar_pagos_cuotas', { p_movimientos: movs })
    setProcesando(false)

    if (error) {
      setResultado('Error: ' + error.message)
    } else {
      setResultado(`Pagos actualizados: ${data}`)
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

      <h3 className="cuotas-titulo">Pagos pendientes ({pendientes.length})</h3>
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

      
      {resultado && <div className="resultado">{resultado}</div>}

      <h3 className="cuotas-titulo" style={{ marginTop: 28 }}>
        Pagados recientemente ({pagados.length})
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
            {pagados.slice(0, 20).map((p) => (
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