import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Navigation, Copy, Check, Layers, RefreshCw, Radio, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { incidentApi, shelterApi, volunteerApi } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import IncidentMap from '../components/IncidentMap'
import { useWebSocket } from '../hooks/useWebSocket'

const SEV_COLORS = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH:     'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW:      'bg-green-100 text-green-700 border-green-200',
}

export default function MapView() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read initial position from URL (or default to Hyderabad)
  const initLat  = parseFloat(searchParams.get('lat'))  || 17.4485
  const initLng  = parseFloat(searchParams.get('lng'))  || 78.3908
  const initZoom = parseInt(searchParams.get('zoom'))   || 12

  const [incidents,    setIncidents]    = useState([])
  const [shelters,     setShelters]     = useState([])
  const [volunteers,   setVolunteers]   = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [followMe,     setFollowMe]     = useState(false)
  const [flyToUser,    setFlyToUser]    = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [lastUpdated,  setLastUpdated]  = useState(null)
  const [sevFilter,    setSevFilter]    = useState('ALL')
  const [typeFilter,   setTypeFilter]   = useState('ALL')
  const [showLayers,   setShowLayers]   = useState(true)
  const watchRef = useRef(null)

  // ── Data loading ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [inc, sh] = await Promise.all([incidentApi.active(), shelterApi.list()])
      setIncidents(inc)
      setShelters(sh)
      if (user?.role === 'ADMIN' || user?.role === 'VOLUNTEER') {
        try { setVolunteers(await volunteerApi.available()) } catch {}
      }
      setLastUpdated(new Date())
    } catch { toast.error('Failed to load map data') }
  }, [user])

  useEffect(() => { load() }, [load])

  // Live updates via WebSocket
  useWebSocket(['/topic/incidents', '/topic/volunteers'], () => load())

  // ── GPS tracking ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return

    // One-shot to set initial user dot
    navigator.geolocation.getCurrentPosition(
      p => setUserLocation([p.coords.latitude, p.coords.longitude]),
      () => {}
    )
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return

    if (followMe) {
      // watchPosition = continuous real-time GPS tracking
      watchRef.current = navigator.geolocation.watchPosition(
        p => {
          const loc = [p.coords.latitude, p.coords.longitude]
          setUserLocation(loc)
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      )
    } else {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current)
        watchRef.current = null
      }
    }

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current)
        watchRef.current = null
      }
    }
  }, [followMe])

  // ── URL sync (updates as map moves) ──────────────────────────────────────
  const handleMapMove = useCallback((lat, lng, zoom) => {
    setSearchParams(
      { lat: lat.toFixed(5), lng: lng.toFixed(5), zoom: String(zoom) },
      { replace: true }   // replace so browser back button works naturally
    )
  }, [setSearchParams])

  // ── Fly to my location ───────────────────────────────────────────────────
  const goToMyLocation = () => {
    if (!userLocation) {
      toast('Getting your location…')
      return
    }
    setFlyToUser(true)
    setTimeout(() => setFlyToUser(false), 100) // pulse trigger
    toast.success('Centered on your location')
  }

  // ── Copy shareable link ──────────────────────────────────────────────────
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    toast.success('Map link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = incidents.filter(i => {
    if (sevFilter  !== 'ALL' && i.severity    !== sevFilter)  return false
    if (typeFilter !== 'ALL' && i.disasterType !== typeFilter) return false
    return true
  })

  const disasterTypes = [...new Set(incidents.map(i => i.disasterType))]

  const counts = {
    critical:  incidents.filter(i => i.severity === 'CRITICAL').length,
    high:      incidents.filter(i => i.severity === 'HIGH').length,
    shelters:  shelters.length,
    volunteers: volunteers.length,
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] relative overflow-hidden bg-gray-900">

      {/* ── Top toolbar ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 bg-white/95 backdrop-blur rounded-xl shadow-lg px-3 py-2 border border-gray-200">
        {/* URL display */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 max-w-xs">
          <MapPin size={11} className="text-brand-600 shrink-0" />
          <span className="font-mono truncate">
            {initLat.toFixed(4)}, {initLng.toFixed(4)} · z{initZoom}
          </span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-gray-200" />
        <button onClick={copyLink}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg hover:bg-gray-100 transition text-gray-600">
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Share Link'}
        </button>
        <button onClick={load}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg hover:bg-gray-100 transition text-gray-600">
          <RefreshCw size={13} />
          Refresh
        </button>
        {lastUpdated && (
          <span className="hidden md:inline text-[10px] text-gray-400">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* ── Left panel: filters + stats ── */}
      <div className="absolute top-16 left-3 z-[500] w-52 space-y-2">
        {/* Live stats */}
        <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 p-3 space-y-2">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
            <Radio size={11} className="text-green-500" /> Live
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-center">
            {[
              { label: 'Critical', val: counts.critical, c: 'text-red-600' },
              { label: 'High',     val: counts.high,     c: 'text-orange-500' },
              { label: 'Shelters', val: counts.shelters,  c: 'text-blue-600' },
              { label: 'Volunteers', val: counts.volunteers, c: 'text-purple-600' },
            ].map(({ label, val, c }) => (
              <div key={label} className="bg-gray-50 rounded-lg py-1.5">
                <div className={`text-lg font-bold ${c}`}>{val}</div>
                <div className="text-[10px] text-gray-400">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 p-3 space-y-2">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Filters</div>
          <div>
            <label className="text-[11px] text-gray-500 mb-0.5 block">Severity</label>
            <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-300">
              <option value="ALL">All severities</option>
              {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 mb-0.5 block">Type</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-300">
              <option value="ALL">All types</option>
              {disasterTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {(sevFilter !== 'ALL' || typeFilter !== 'ALL') && (
            <button onClick={() => { setSevFilter('ALL'); setTypeFilter('ALL') }}
              className="w-full text-xs text-brand-600 hover:underline text-center">
              Clear filters ({filtered.length}/{incidents.length})
            </button>
          )}
        </div>

        {/* Legend */}
        <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 p-3">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Legend</div>
          <div className="space-y-1.5 text-xs text-gray-600">
            {[
              { color: '#dc2626', label: 'Critical incident (+ 500m radius)' },
              { color: '#f97316', label: 'High severity' },
              { color: '#f59e0b', label: 'Medium severity' },
              { color: '#10b981', label: 'Low severity' },
              { color: '#2563eb', label: 'Emergency shelter' },
              { color: '#7c3aed', label: 'Volunteer (pulsing = available)' },
              { color: '#2563eb', label: 'Your location (blue pulsing dot)' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="mt-0.5 w-3 h-3 rounded-full shrink-0 border-2 border-white shadow" style={{ background: color }} />
                <span className="text-[11px] leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: location controls ── */}
      <div className="absolute bottom-6 right-3 z-[500] flex flex-col gap-2">
        {/* Follow me toggle */}
        <button
          onClick={() => setFollowMe(f => !f)}
          title={followMe ? 'Stop tracking' : 'Track my location live'}
          className={`w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition border ${
            followMe
              ? 'bg-blue-600 text-white border-blue-700'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Radio size={18} className={followMe ? 'animate-pulse' : ''} />
        </button>

        {/* Fly to my location */}
        <button
          onClick={goToMyLocation}
          title="Center on my location"
          className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-50 transition border border-gray-200"
        >
          <Navigation size={18} />
        </button>
      </div>

      {/* ── "Live tracking" badge ── */}
      {followMe && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Live tracking your location
        </div>
      )}

      {/* ── Map ── */}
      <IncidentMap
        incidents={filtered}
        shelters={shelters}
        volunteers={volunteers}
        center={[initLat, initLng]}
        zoom={initZoom}
        height="100%"
        onMapMove={handleMapMove}
        userLocation={userLocation}
        flyToUser={flyToUser}
      />
    </div>
  )
}
