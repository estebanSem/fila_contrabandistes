import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'

export default function HistorialCuotas({ idFester }) {
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    cargar()
  }, [idFester])

  async function cargar() {
    setLoading(true)
    setError(null)
    // Protegido por la policy "fester lee detalle de sus pagos"
    const { data, error } = await supabase
      .from('detalle_pago')
      .select(
        'id_detalle, importe_total, cuota(acto(nombre)), pagos_cuotas(concepto, estado, fecha_pago, creacion_ticket)'
      )
      .eq('id_fester', idFester)
      .order('id_detalle', { ascending: false })
    if (error) setError(error.message)
    else setHistorial(data)
    setLoading(false)
  }

  if (loading) return <p className="texto-muted">Cargando historial…</p>

  return (
    <div className="cuotas-bloque">
      <h3 className="cuotas-titulo">Historial de cuotas ({historial.length})</h3>

      {error && <p className="error-texto">{error}</p>}

      <div className="carrito-lista">
        {historial.map((l) => (
          <div key={l.id_detalle} className="carrito-item">
            <div className="carrito-item-info">
              <span className="carrito-item-acto">{l.cuota?.acto?.nombre}</span>
              <span className="carrito-item-festero">
                {l.pagos_cuotas?.concepto} ·{' '}
                <span
                  className={l.pagos_cuotas?.estado === 'PAGADO' ? 'badge-pagado' : 'badge-pendiente'}
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
            Todavía no tienes ninguna cuota registrada.
          </p>
        )}
      </div>
    </div>
  )
}