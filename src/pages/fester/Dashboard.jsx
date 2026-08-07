import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'
import CuotasSelector from '../cuotas/CuotasSelector.jsx'
import HijosSection from './HijosSection.jsx'
import CarritoResumen from '../cuotas/CarritoResumen.jsx'
import CambiarPassword from '../login/CambiarPassword.jsx'
import HistorialCuotas from '../cuotas/HistorialCuotas.jsx'
import { CarritoProvider } from '../../CarritoContext.jsx'

export default function Dashboard({ session }) {
  const [fester, setFester] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('datos') // 'datos' | 'cuotas' | 'hijos' | 'historial'

  useEffect(() => {
    async function cargarFester() {
      // Gracias a la policy "fester lee su propia fila" (auth.uid() = auth_id),
      // esta consulta solo puede devolver la fila del usuario logueado.
      const { data, error } = await supabase
        .from('fester')
        .select('*')
        .eq('auth_id', session.user.id)
        .maybeSingle()

      if (error) setError(error.message)
      else setFester(data)
      setLoading(false)
    }
    cargarFester()
  }, [session.user.id])

  async function logout() {
    await supabase.auth.signOut()
  }

  function irAdmin(){
    window.location.href='/admin.html'
  }

  return (
    <div className="page-center">
      <div className="auth-card auth-card-admin">
        {loading && <p className="texto-muted">Cargando tu perfil…</p>}
        {error && <p className="error-texto">{error}</p>}

        {fester && (
          <CarritoProvider>
            <div className="admin-header">
              <div className="auth-brand">
                <span className="auth-brand-dot" />
                Filà Contrabandistes
              </div>
              {fester?.es_admin &&
                <button type="button" className="btn-link" onClick={irAdmin}>
                  Panel Admin
                </button>
              }
              <button type="button" className="btn-link" onClick={logout}>
                Cerrar sesión
              </button>
            </div>

            <div className="tabs">
              <button
                className={`tab ${tab === 'datos' ? 'tab-activo' : ''}`}
                onClick={() => setTab('datos')}
                type="button"
              >
                Mis datos
              </button>
              <button
                className={`tab ${tab === 'cuotas' ? 'tab-activo' : ''}`}
                onClick={() => setTab('cuotas')}
                type="button"
              >
                Cuotas
              </button>
              <button
                className={`tab ${tab === 'hijos' ? 'tab-activo' : ''}`}
                onClick={() => setTab('hijos')}
                type="button"
              >
                Mis hijos
              </button>
              <button
                className={`tab ${tab === 'historial' ? 'tab-activo' : ''}`}
                onClick={() => setTab('historial')}
                type="button"
              >
                Historial
              </button>
            </div>

            {tab === 'datos' && (
              <div>
                <h2 className="dashboard-saludo">Hola, {fester.nombre} 👋</h2>
                <div className="dato">
                  <span className="label">DNI / NIE</span>
                  <b>{fester.dni}</b>
                </div>
                <div className="dato">
                  <span className="label">Nombre completo</span>
                  <b>
                    {fester.nombre} {fester.primer_apellido} {fester.segundo_apellido}
                  </b>
                </div>
                <div className="dato">
                  <span className="label">Email</span>
                  <b>{fester.email}</b>
                </div>

                <CambiarPassword />
              </div>
            )}

            {tab === 'cuotas' && (
              <CuotasSelector
                idFester={fester.id_fester}
                nombreFester={`${fester.nombre} ${fester.primer_apellido}`}
              />
            )}

            {tab === 'hijos' && <HijosSection responsable={fester} />}

            {tab === 'historial' && <HistorialCuotas idFester={fester.id_fester} />}

            {/* Visible en cualquier pestaña: puedes añadir cuotas tuyas y de
                tus hijos desde pestañas distintas, y el carrito las acumula todas. */}
            <CarritoResumen idFesterResponsable={fester.id_fester} />
          </CarritoProvider>
        )}

        {!loading && !fester && !error && (
          <p className="texto-muted">
            No se encontró una ficha de festero para tu cuenta. Contacta con la tesorería.
          </p>
        )}
      </div>
    </div>
  )
}