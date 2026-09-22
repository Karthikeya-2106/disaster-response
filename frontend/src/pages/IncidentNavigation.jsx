import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Navigation, CheckCircle2, ArrowLeft, ExternalLink, Clock, Route, Wifi, WifiOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { incidentApi } from '../api/endpoints'

// ── Icons ────────────────────────────────────────────────────────────────────
const makeIcon = (color, size, pulse) => L.divIcon({
  className: '',
  html: `<div style="position:relative;width:${size}px;height:${size}px">
    ${pulse ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.25;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>` : ''}
    <div style="position:absolute;inset:${pulse ? 4 : 0}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>
  </div>
  <style>@keyframes ping{75%,100%{transform:scale(2.2);opacity:0}}</style>`,
  iconSize: [size, size], iconAnchor: [size / 2, size / 2],
})

const destinationIcon = () => L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center">
    <div style="width:28px;height:28px;background:#dc2626;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 10px rgba(220,38,38,0.5)"></div>
    <div style="width:4px;height:10px;background:#dc2626;margin-top:-2px;border-radius:0 0 2px 2px"></div>
  </div>`,
  iconSize: [28, 40], iconAnchor: [14, 40],
})

// Fly to bounds when route loads
function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions?.length > 1) {
      const bounds = L.latLngBounds(positions)
      map.fitBounds(bounds, { padding: [60, 60] })
    }
  }, [positions, map])
  return null
}

// ── OSRM routing ─────────────────────────────────────────────────────────────
async function fetchRoute(fromLat, fromLng, toLat, toLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
  const res  = await fetch(url)
  const data = await res.json()
  if (data.routes?.length) {
    const route = data.routes[0]
    // OSRM gives [lng,lat] — swap to [lat,lng] for Leaflet
    const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
    return {
      coords,
      distance: (route.distance / 1000).toFixed(1),   // km
      duration: Math.round(route.duration / 60),        // minutes
    }
  }
  return null
}

function fmtDuration(mins) {
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function IncidentNavigation() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [incident,     setIncident]     = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [route,        setRoute]        = useState(null)       // { coords, distance, duration }
  const [gpsActive,    setGpsActive]    = useState(false)
  const [marking,      setMarking]      = useState(false)
  const [reached,      setReached]      = useState(false)
  const watchRef = useRef(null)

  // Load incident
  useEffect(() => {
    incidentApi.get(id)
      .then(setIncident)
      .catch(() => toast.error('Incident not found'))
  }, [id])

  // Start GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return
    setGpsActive(false)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude])
        setGpsActive(true)
      },
      () => setGpsActive(false),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current) }
  }, [])

  // Fetch route whenever user location or incident changes
  useEffect(() => {
    if (!userLocation || !incident) return
    fetchRoute(userLocation[0], userLocation[1], incident.latitude, incident.longitude)
      .then(r => { if (r) setRoute(r) })
      .catch(() => {})
  }, [userLocation?.[0]?.toFixed(3), incident?.id])  // recalc only when position changes >~100m

  // Mark as reached
  const markReached = async () => {
    setMarking(true)
    try {
      await incidentApi.updateStatus(id, 'IN_PROGRESS', 'Volunteer arrived at incident location')
      setReached(true)
      toast.success('Marked as Reached! Status updated to In Progress.')
    } catch {
      toast.error('Failed to update status')
    } finally {
      setMarking(false)
    }
  }

  // Open in Google Maps for turn-by-turn
  const openGoogleMaps = () => {
    if (!userLocation || !incident) return
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation[0]},${userLocation[1]}&destination=${incident.latitude},${incident.longitude}&travelmode=driving`
    window.open(url, '_blank')
  }

  const SEV_COLOR = { CRITICAL: '#dc2626', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#10b981' }
  const incidentPos = incident ? [incident.latitude, incident.longitude] : null
  const routePositions = route?.coords || (userLocation && incidentPos ? [userLocation, incidentPos] : [])

  const defaultCenter = incidentPos || [17.4485, 78.3908]

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-gray-900">

      {/* ── Top bar ── */}
      <div className="absolute top-14 left-0 right-0 z-[500] px-4 pt-3">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <button onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition">
              <ArrowLeft size={18} className="text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 text-sm truncate">
                {incident?.title || 'Loading…'}
              </div>
              <div className="text-xs text-gray-400 truncate">{incident?.address || `${incident?.latitude?.toFixed(4)}, ${incident?.longitude?.toFixed(4)}`}</div>
            </div>
            {incident && (
              <span className="shrink-0 text-xs px-2 py-1 rounded-full font-semibold text-white"
                style={{ background: SEV_COLOR[incident.severity] }}>
                {incident.severity}
              </span>
            )}
          </div>

          {/* Route info row */}
          <div className="flex items-center divide-x divide-gray-100">
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5">
              <Route size={16} className="text-brand-600 shrink-0" />
              <div>
                <div className="text-xs text-gray-400">Distance</div>
                <div className="font-bold text-gray-800 text-sm">{route ? `${route.distance} km` : '—'}</div>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5">
              <Clock size={16} className="text-brand-600 shrink-0" />
              <div>
                <div className="text-xs text-gray-400">ETA</div>
                <div className="font-bold text-gray-800 text-sm">{route ? fmtDuration(route.duration) : '—'}</div>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5">
              {gpsActive
                ? <Wifi size={16} className="text-emerald-500 shrink-0" />
                : <WifiOff size={16} className="text-red-400 shrink-0" />}
              <div>
                <div className="text-xs text-gray-400">GPS</div>
                <div className={`font-bold text-sm ${gpsActive ? 'text-emerald-600' : 'text-red-500'}`}>
                  {gpsActive ? 'Live' : 'Off'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="flex-1">
        <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {routePositions.length > 1 && <FitBounds positions={routePositions} />}

          {/* Route line */}
          {route?.coords?.length > 1 && (
            <>
              {/* Shadow */}
              <Polyline positions={route.coords}
                pathOptions={{ color: '#1e3a5f', weight: 8, opacity: 0.15 }} />
              {/* Main route */}
              <Polyline positions={route.coords}
                pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />
            </>
          )}

          {/* Straight dashed fallback if no route yet */}
          {!route?.coords && userLocation && incidentPos && (
            <Polyline positions={[userLocation, incidentPos]}
              pathOptions={{ color: '#94a3b8', weight: 3, dashArray: '8,6', opacity: 0.6 }} />
          )}

          {/* User location — blue pulsing */}
          {userLocation && (
            <Marker position={userLocation} icon={makeIcon('#2563eb', 24, true)} zIndexOffset={1000}>
              <Popup><b className="text-blue-600">📍 You are here</b></Popup>
            </Marker>
          )}

          {/* Destination — red pin */}
          {incidentPos && (
            <Marker position={incidentPos} icon={destinationIcon()} zIndexOffset={900}>
              <Popup>
                <div className="text-sm">
                  <b className="text-red-600">🚨 {incident?.title}</b>
                  <div className="text-xs text-gray-500 mt-1">{incident?.address}</div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* ── Bottom action panel ── */}
      <div className="absolute bottom-0 left-0 right-0 z-[500] p-4 bg-white border-t border-gray-100 shadow-2xl">
        <div className="max-w-lg mx-auto space-y-3">
          {/* Google Maps turn-by-turn */}
          <button onClick={openGoogleMaps}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-brand-600 text-brand-600 font-semibold rounded-xl hover:bg-brand-50 transition text-sm">
            <ExternalLink size={16} />
            Open Turn-by-Turn in Google Maps
          </button>

          {/* Mark as reached */}
          {reached ? (
            <div className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 text-white font-bold rounded-xl text-sm">
              <CheckCircle2 size={18} /> Reached! Status → In Progress
            </div>
          ) : (
            <button onClick={markReached} disabled={marking}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold rounded-xl transition text-sm shadow-lg shadow-red-200">
              <CheckCircle2 size={18} />
              {marking ? 'Updating…' : 'Mark as Reached'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
