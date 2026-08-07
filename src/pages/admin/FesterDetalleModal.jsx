import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'

export default function FesterDetalleModal({ idFester, onClose }) {
  const [fester, setFester] = useState(null)
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    cargar()
  }, [idFester])

  async function cargar() {
    setLoading(true)
    setError(null)

    const [festerRes, historialRes] = await Promise.all([
      supabase.from('fester').select('*').eq('id_fester', idFester).single(),
      // Se busca por id_fester en detalle_pago (no en pagos_cuotas) para que
      // también salgan las cuotas de un hijo, aunque nunca haya pagado él mismo.
      supabase
        .from('detalle_pago')
        .select('id_detalle, importe_total, cuota(acto(nombre)), pagos_cuotas(concepto, estado, fecha_pago, creacion_ticket)')
        .eq('id_fester', idFester)
        .order('id_detalle', { ascending: false }),
    ])

    if (festerRes.error || historialRes.error) {
      setError((festerRes.error || historialRes.error).message)
    } else {
      setFester(festerRes.data)
      setHistorial(historialRes.data)
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {loading && <p className="texto-muted">Cargando…</p>}
        {error && <p className="error-texto">{error}</p>}

        {fester && (
          <>
            <h3 className="cuotas-titulo">
              {fester.nombre} {fester.primer_apellido} {fester.segundo_apellido}
            </h3>

            <div className="dato">
              <span className="label">DNI / NIE</span>
              <b>{fester.dni || '—'}</b>
            </div>
            <div className="dato">
              <span className="label">Fecha de nacimiento</span>
              <b>{fester.fecha_nac}</b>
            </div>
            <div className="dato">
              <span className="label">Sexo</span>
              <b>{fester.sexo}</b>
            </div>
            <div className="dato">
              <span className="label">Email</span>
              <b>{fester.email || '—'}</b>
            </div>
            <div className="dato">
              <span className="label">Teléfono</span>
              <b>{fester.telefono || '—'}</b>
            </div>
            <div className="dato">
              <span className="label">Socio / Admin</span>
              <b>
                {fester.es_socio ? 'Socio' : 'No socio'} · {fester.es_admin ? 'Admin' : 'Usuario normal'}
              </b>
            </div>

            <h3 className="cuotas-titulo" style={{ marginTop: 24 }}>
              Historial de cuotas ({historial.length})
            </h3>

            <div className="carrito-lista">
              {historial.map((l) => (
                <div key={l.id_detalle} className="carrito-item">
                  <div className="carrito-item-info">
                    <span className="carrito-item-acto">{l.cuota?.acto?.nombre}</span>
                    <span className="carrito-item-festero">
                      {l.pagos_cuotas?.concepto} ·{' '}
                      <span
                        className={
                          l.pagos_cuotas?.estado === 'PAGADO' ? 'badge-pagado' : 'badge-pendiente'
                        }
                      >
                        {l.pagos_cuotas?.estado}
                      </span>
                    </span>
                  </div>
                  <span className="precio">{Number(l.importe_total).toFixed(2)} €</span>
                </div>
              ))}
              {historial.length === 0 && (
                <p className="texto-muted" style={{ padding: 4 }}>
                  Todavía no tiene ninguna cuota registrada.
                </p>
              )}
            </div>

            <button type="button" className="btn-secundario" onClick={onClose}>
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  )
}