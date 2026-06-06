import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'

// ── Marker factories ────────────────────────────────────────────────────────
const dotIcon = (color, size = 20, pulse = false) => L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:${size}px;height:${size}px">
      ${pulse ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.3;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>` : ''}
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,0.35)"></div>
    </div>
    <style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>
  `,
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2],
})

const userLocationIcon = () => L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:24px;height:24px">
      <div style="position:absolute;inset:0;border-radius:50%;background:#2563eb;opacity:0.25;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite"></div>
      <div style="position:absolute;inset:4px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 0 10px rgba(37,99,235,0.5)"></div>
    </div>
    <style>@keyframes ping{75%,100%{transform:scale(2.5);opacity:0}}</style>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const SEV_COLOR = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#dc2626' }

// ── Sub-components ───────────────────────────────────────────────────────────

/** Fires onMove(lat, lng, zoom) every time the map is panned or zoomed */
function MapMoveListener({ onMove }) {
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter()
      onMove(c.lat, c.lng, e.target.getZoom())
    },
    zoomend(e) {
      const c = e.target.getCenter()
      onMove(c.lat, c.lng, e.target.getZoom())
    },
  })
  return null
}

/** Smoothly flies the map to a new center when the prop changes */
function MapFlyTo({ center, zoom }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (!center) return
    const key = center.join(',')
    if (prev.current === key) return
    prev.current = key
    map.flyTo(center, zoom ?? map.getZoom(), { duration: 1 })
  }, [center, zoom, map])
  return null
}

// ── Main component ────────────────────────────────────────────────────────────
export default function IncidentMap({
  incidents = [],
  shelters = [],
  volunteers = [],
  center = [17.4485, 78.3908],
  zoom = 12,
  height = '100%',
  onMapMove,          // (lat, lng, zoom) => void
  userLocation,       // [lat, lng] | null
  flyToUser = false,  // fly to user location when it first arrives
}) {
  return (
    <div style={{ height }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {onMapMove && <MapMoveListener onMove={onMapMove} />}
        {flyToUser && userLocation && <MapFlyTo center={userLocation} zoom={15} />}

        {/* ── Incidents ── */}
        {incidents.map(i => (
          <Marker
            key={`i-${i.id}`}
            position={[i.latitude, i.longitude]}
            icon={dotIcon(SEV_COLOR[i.severity] || '#6b7280', i.severity === 'CRITICAL' ? 24 : 18, i.severity === 'CRITICAL')}
          >
            <Popup maxWidth={260}>
              <div className="text-sm space-y-1">
                <div className="font-bold text-gray-900 leading-tight">{i.title}</div>
                <div className="flex gap-1 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ background: SEV_COLOR[i.severity] + '22', color: SEV_COLOR[i.severity] }}>
                    {i.severity}
                  </span>
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[11px] text-gray-600">{i.disasterType}</span>
                  <span className="px-1.5 py-0.5 bg-blue-100 rounded text-[11px] text-blue-700">{i.status?.replace('_',' ')}</span>
                </div>
                <p className="text-gray-600 text-xs leading-relaxed">{i.description}</p>
                {i.assignedVolunteerName && (
                  <div className="text-xs text-purple-600">🚑 {i.assignedVolunteerName}</div>
                )}
                {i.aiSeverityScore != null && (
                  <div className="text-xs text-gray-500">🤖 AI score: <strong>{(i.aiSeverityScore * 100).toFixed(0)}%</strong></div>
                )}
                {i.address && <div className="text-xs text-gray-400">📍 {i.address}</div>}
                {i.imageUrl && <img src={i.imageUrl} alt="" className="mt-1 w-full rounded max-h-32 object-cover" />}
              </div>
            </Popup>
            {i.severity === 'CRITICAL' && (
              <Circle center={[i.latitude, i.longitude]} radius={500}
                pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.07, weight: 1.5, dashArray: '5,5' }} />
            )}
          </Marker>
        ))}

        {/* ── Shelters ── */}
        {shelters.map(s => (
          <Marker key={`s-${s.id}`} position={[s.latitude, s.longitude]} icon={dotIcon('#2563eb', 20)}>
            <Popup>
              <div className="text-sm space-y-1">
                <div className="font-bold">🏠 {s.name}</div>
                <div className="text-xs text-gray-500">{s.address}</div>
                <div className="text-xs">
                  Capacity: <strong>{s.currentOccupancy}/{s.capacity}</strong>
                  <div className="w-full bg-gray-200 h-1.5 rounded mt-1">
                    <div className="bg-blue-500 h-1.5 rounded"
                      style={{ width: `${Math.min(100, (s.currentOccupancy / s.capacity) * 100)}%` }} />
                  </div>
                </div>
                {s.contactPhone && <div className="text-xs text-gray-500">📞 {s.contactPhone}</div>}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ── Volunteers ── */}
        {volunteers.map(v => (
          <Marker key={`v-${v.volunteerId}`} position={[v.latitude, v.longitude]}
            icon={dotIcon('#7c3aed', 18, v.available)}>
            <Popup>
              <div className="text-sm">
                <div className="font-bold">🚑 {v.volunteerName || 'Volunteer'}</div>
                <div className={`text-xs font-medium ${v.available ? 'text-emerald-600' : 'text-orange-500'}`}>
                  {v.available ? '● Available' : '● On mission'}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ── User's live location ── */}
        {userLocation && (
          <Marker position={userLocation} icon={userLocationIcon()} zIndexOffset={1000}>
            <Popup>
              <div className="text-sm font-semibold text-blue-600">📍 You are here</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
