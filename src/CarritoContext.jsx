import { createContext, useContext, useState, useRef } from 'react'

const CarritoContext = createContext(null)

export function CarritoProvider({ children }) {
  // Cada item: { key (secuencial, para React), id (identidad para evitar duplicados),
  //              id_cuota, nombreActo, precio, idFester, nombreFester }
  const [items, setItems] = useState([])
  const contadorRef = useRef(1)

  function agregarItems(nuevos) {
    setItems((prev) => {
      const idsExistentes = new Set(prev.map((i) => i.id))
      const aAnadir = nuevos
        .filter((i) => !idsExistentes.has(i.id))
        .map((i) => ({ ...i, key: String(contadorRef.current++) }))
      return [...prev, ...aAnadir]
    })
  }

  function quitarItem(key) {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  function vaciarCarrito() {
    setItems([])
    contadorRef.current = 1
  }

  const total = items.reduce((sum, i) => sum + Number(i.precio), 0)

  return (
    <CarritoContext.Provider value={{ items, agregarItems, quitarItem, vaciarCarrito, total }}>
      {children}
    </CarritoContext.Provider>
  )
}

export function useCarrito() {
  const ctx = useContext(CarritoContext)
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>')
  return ctx
}