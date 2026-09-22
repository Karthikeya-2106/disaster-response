import { useState, useRef, useEffect } from 'react'
import { MapPin, Loader, Search, X } from 'lucide-react'

// Nominatim (OpenStreetMap) – no API key needed
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

export default function AddressSearch({ value, onChange, onSelect, required = false, placeholder = 'Search address…' }) {
  const [query, setQuery]       = useState(value || '')
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [open, setOpen]         = useState(false)
  const debounceRef             = useRef(null)
  const wrapRef                 = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = (q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim() || q.length < 3) { setResults([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data = await res.json()
        setResults(data)
        setOpen(data.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
  }

  const handleInput = (e) => {
    const q = e.target.value
    setQuery(q)
    onChange?.(q)
    search(q)
  }

  const pick = (item) => {
    const addr = item.display_name
    const lat  = parseFloat(item.lat)
    const lng  = parseFloat(item.lon)
    setQuery(addr)
    setOpen(false)
    setResults([])
    onChange?.(addr)
    onSelect?.({ address: addr, latitude: lat, longitude: lng })
  }

  const clear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
    onChange?.('')
    onSelect?.(null)
  }

  // Icon for place type
  const placeIcon = (type) => {
    if (['restaurant','cafe','shop','supermarket'].includes(type)) return '🏪'
    if (['hospital','clinic','pharmacy'].includes(type))           return '🏥'
    if (['school','university','college'].includes(type))          return '🏫'
    if (['road','street','avenue'].includes(type))                 return '🛣️'
    return '📍'
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative flex items-center">
        <Search size={15} className="absolute left-3 text-gray-400 pointer-events-none" />
        <input
          type="text"
          required={required}
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        <div className="absolute right-2.5 flex items-center gap-1">
          {loading && <Loader size={14} className="text-gray-400 animate-spin" />}
          {query && !loading && (
            <button type="button" onClick={clear} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-[600] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {results.map((item, i) => {
            const parts = item.display_name.split(', ')
            const main  = parts.slice(0, 2).join(', ')
            const sub   = parts.slice(2).join(', ')
            return (
              <li
                key={i}
                onClick={() => pick(item)}
                className="flex items-start gap-3 px-4 py-3 hover:bg-brand-50 cursor-pointer border-b border-gray-50 last:border-0"
              >
                <span className="mt-0.5 text-base shrink-0">{placeIcon(item.type)}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{main}</div>
                  <div className="text-xs text-gray-400 truncate mt-0.5">{sub}</div>
                </div>
                <MapPin size={13} className="text-brand-400 shrink-0 mt-1" />
              </li>
            )
          })}
          <li className="px-4 py-2 text-[10px] text-gray-300 text-right">
            Powered by OpenStreetMap Nominatim
          </li>
        </ul>
      )}
    </div>
  )
}
