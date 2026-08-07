import { useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../../supabaseClient.js'
import { useCarrito } from '../../CarritoContext.jsx'

export default function CarritoResumen({ idFesterResponsable }) {
  const { items, quitarItem, total, vaciarCarrito } = useCarrito()
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState(null)
  const [pago, setPago] = useState(null)

  async function procederAlPago() {
    setError(null)
    setProcesando(true)
    try {
      // crear_pago recalcula el precio de cada línea EN EL SERVIDOR a partir
      // de id_cuota; nunca se envía el precio que muestra el navegador.
      const { data, error } = await supabase.rpc('crear_pago', {
        p_id_fester_responsable: idFesterResponsable,
        p_items: items.map((i) => ({ id_fester: i.idFester, id_cuota: i.id_cuota })),
      })

      if (error) throw error
      const fila = data[0]

      const epcText = [
        'BCD',
        '002',
        '1',
        'SCT',
        fila.bic || '',
        fila.titular,
        fila.iban.replace(/\s/g, ''),
        `EUR${Number(fila.importe_total).toFixed(2)}`,
        '',
        fila.concepto,
        '',
      ].join('\n')

      const qrDataUrl = await QRCode.toDataURL(epcText, { width: 260, margin: 2 })

      setPago({
        idPago: fila.id_pago,
        concepto: fila.concepto,
        importeTotal: Number(fila.importe_total),
        iban: fila.iban,
        qrDataUrl,
      })
      vaciarCarrito()
    } catch (err) {
      setError('Error al generar el pago: ' + err.message)
    } finally {
      setProcesando(false)
    }
  }

  function copiar(texto) {
    navigator.clipboard.writeText(texto)
    alert('Copiado: ' + texto)
  }

  // Pantalla de pago generado (QR)
  if (pago) {
    return (
      <div className="cuotas-bloque carrito-resumen">
        <h3 className="cuotas-titulo">¡Pago generado!</h3>

        <div className="dato">
          <span className="label">Importe a pagar</span>
          <b>{pago.importeTotal.toFixed(2)} €</b>
        </div>
        <div className="dato">
          <span className="label">Concepto (no lo cambies)</span>
          <b>{pago.concepto}</b>
          <br />
          <button className="copy-btn" onClick={() => copiar(pago.concepto)}>
            Copiar concepto
          </button>
        </div>
        <div className="dato">
          <span className="label">IBAN</span>
          <b>{pago.iban}</b>
          <br />
          <button className="copy-btn" onClick={() => copiar(pago.iban)}>
            Copiar IBAN
          </button>
        </div>

        <p>Escanea este código con la app de tu banco (opción "Pagar/Transferir por QR"):</p>
        <img src={pago.qrDataUrl} width="240" height="240" alt="QR de pago" />
        <p className="aviso">
          Si tu banco no admite pago por QR, usa el IBAN y el concepto de arriba para transferir
          manualmente. Es imprescindible mantener el concepto exacto.
        </p>
      </div>
    )
  }

  if (items.length === 0) return null

  // Pantalla del carrito, antes de generar el pago
  return (
    <div className="cuotas-bloque carrito-resumen">
      <h3 className="cuotas-titulo">Carrito</h3>

      <div className="carrito-lista">
        {items.map((i) => (
          <div key={i.key} className="carrito-item">
            <div className="carrito-item-info">
              <span className="carrito-item-acto">{i.nombreActo}</span>
              <span className="carrito-item-festero">{i.nombreFester}</span>
            </div>
            <span className="precio">{i.precio.toFixed(2)} €</span>
            <button
              type="button"
              className="btn-mini btn-mini-danger"
              onClick={() => quitarItem(i.key)}
              aria-label={`Quitar ${i.nombreActo} de ${i.nombreFester}`}
            >
              Quitar
            </button>
          </div>
        ))}
      </div>

      <div className="total-box">
        <span>Total del carrito</span>
        <span>{total.toFixed(2)} €</span>
      </div>

      {error && <p className="error-texto">{error}</p>}

      <button type="button" className="btn-primario" disabled={procesando} onClick={procederAlPago}>
        {procesando ? 'Generando pago…' : 'Proceder al pago'}
      </button>
    </div>
  )
}