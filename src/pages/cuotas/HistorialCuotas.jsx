import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'

export default function HistorialCuotas({ idFester }) {
  const [ordenes, setOrdenes] = useState([])
  const [pagina, setPagina] = useState(0)
  const [hayMas, setHayMas] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    async function cargar() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.from('pagos_cuotas')
        .select('id_pago, concepto, importe_total, estado, creacion_ticket, fecha_pago')
        .eq('id_fester', idFester).order('creacion_ticket', { ascending: false })
        .range(pagina * 20, pagina * 20 + 20)
      if (!vigente) return
      if (error) { setError(error.message); setLoading(false); return }
      const pagos = (data || []).slice(0, 20)
      const { data: lineas, error: detalleError } = pagos.length
        ? await supabase.from('detalle_pago')
          .select('id_pago, id_detalle, importe_total, cuota(acto(nombre)), fester(nombre, primer_apellido)')
          .in('id_pago', pagos.map((p) => p.id_pago))
        : { data: [], error: null }
      if (!vigente) return
      if (detalleError) setError(detalleError.message)
      else {
        setOrdenes(pagos.map((p) => ({ ...p, lineas: lineas.filter((l) => l.id_pago === p.id_pago) })))
        setHayMas((data || []).length > 20)
      }
      setLoading(false)
    }
    cargar()
    return () => { vigente = false }
  }, [idFester, pagina])

  return <div className="cuotas-bloque">
    <h3 className="cuotas-titulo">Pagos de tu familia</h3>
    {loading && <p>Cargando historial…</p>}
    {error && <p className="error-texto">{error}</p>}
    {!loading && !error && ordenes.length === 0 && <p>Todavía no tienes pagos registrados.</p>}
    {ordenes.map((p) => <div className="cuotas-bloque" key={p.id_pago}>
      <p><strong>{p.concepto}</strong> · <span className={p.estado === 'PAGADO' ? 'badge-pagado' : 'badge-pendiente'}>{p.estado}</span></p>
      <p>{Number(p.importe_total).toFixed(2)} € · {new Date(p.creacion_ticket).toLocaleDateString('es-ES')}</p>
      {p.estado === 'PENDIENTE' && <p className="texto-muted">Conserva el concepto exacto de la transferencia. La tesorería confirmará su recepción.</p>}
      <ul>{p.lineas.map((l) => <li key={l.id_detalle}>
        {l.fester?.nombre} {l.fester?.primer_apellido} — {l.cuota?.acto?.nombre}: {Number(l.importe_total).toFixed(2)} €
      </li>)}</ul>
    </div>)}
    <div className="paginacion">
      <button type="button" className="btn-mini" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
      <span>Página {pagina + 1}</span>
      <button type="button" className="btn-mini" disabled={!hayMas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
    </div>
  </div>
}
