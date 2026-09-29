import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'
import { useCarrito } from '../../CarritoContext.jsx'

export default function CuotasSelector({ idFester, nombreFester }) {
  const [cuotas, setCuotas] = useState([])
  const [seleccionadas, setSeleccionadas] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [revision, setRevision] = useState(0)

  const { items, agregarItems } = useCarrito()

  useEffect(() => {
    async function cargarCuotas() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.rpc('cuotas_disponibles', { p_id_fester: idFester })
      if (error) {
        setError(error.message)
      } else if ((data || []).some((c) => c.out_id_cuota == null)) {
        setError(
          'La función cuotas_disponibles() no está devolviendo id_cuota.'
        )
      } else {
        setCuotas(data || [])
      }
      setLoading(false)
    }
    if (idFester) cargarCuotas()
  }, [idFester, revision])

  useEffect(() => {
    const actualizar = () => { setSeleccionadas({}); setRevision((v) => v + 1) }
    window.addEventListener('cuotas-actualizadas', actualizar)
    return () => window.removeEventListener('cuotas-actualizadas', actualizar)
  }, [])

  function identidadCuota(idCuota) {
    return `${idFester}-${idCuota}`
  }

  function estaEnCarrito(idCuota) {
    return items.some((i) => i.id === identidadCuota(idCuota))
  }

  function toggle(idCuota) {
    setSeleccionadas((prev) => ({ ...prev, [idCuota]: !prev[idCuota] }))
  }

  // out_id_couta es el nombre que tiene la variable que devuelve la funcion de Supabase
  const seleccionadasArray = cuotas.filter((c) => seleccionadas[c.out_id_cuota] && !estaEnCarrito(c.out_id_cuota))
  const totalSeleccion = seleccionadasArray.reduce((sum, c) => sum + Number(c.precio), 0)

  function anadirAlCarrito() {
    const nuevos = seleccionadasArray.map((c) => ({
      id: identidadCuota(c.out_id_cuota),
      id_cuota: c.out_id_cuota,
      nombreActo: c.nombre_acto,
      precio: Number(c.precio),
      idFester,
      nombreFester,
    }))
    agregarItems(nuevos)
    setSeleccionadas({})
  }

  if (loading) return <p className="texto-muted">Cargando cuotas…</p>
  if (error) return <p className="error-texto">No se pudieron cargar las cuotas: {error}</p>
  if (cuotas.length === 0) {
    return <p className="texto-muted">No hay actos disponibles todavía.</p>
  }

  return (
    <div className="cuotas-bloque">
      <h3 className="cuotas-titulo">Actos disponibles</h3>

      <div className="lista-actos">
        {cuotas.map((c) => {
          const enCarrito = estaEnCarrito(c.out_id_cuota)
          const marcado = !!seleccionadas[c.out_id_cuota]
          return (
            <div
              key={c.out_id_cuota}
              className={`acto ${marcado ? 'seleccionado' : ''} ${enCarrito ? 'acto-en-carrito' : ''}`}
              onClick={() => !enCarrito && toggle(c.out_id_cuota)}
            >
              <label onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={enCarrito}
                  onChange={() => toggle(c.out_id_cuota)}
                />
                {c.nombre_acto}
                {enCarrito && <span className="badge-carrito">En el carrito</span>}
              </label>
              <span className="precio">{Number(c.precio).toFixed(2)} €</span>
            </div>
          )
        })}
      </div>

      {seleccionadasArray.length > 0 && (
        <div className="total-box">
          <span>Seleccionado</span>
          <span>{totalSeleccion.toFixed(2)} €</span>
        </div>
      )}

      <button
        type="button"
        className="btn-primario"
        disabled={seleccionadasArray.length === 0}
        onClick={anadirAlCarrito}
      >
        Añadir al carrito
      </button>
    </div>
  )
}
