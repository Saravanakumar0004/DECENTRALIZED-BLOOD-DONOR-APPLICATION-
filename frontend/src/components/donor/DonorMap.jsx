import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { getRequests } from '../../api/requests'
import { BloodBadge, UrgencyChip } from '../ui/index'
import { acceptRequest } from '../../api/requests'
import toast from 'react-hot-toast'

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

export default function DonorMap() {
  const [requests, setRequests] = useState([])

  useEffect(() => {
    getRequests({ status: 'OPEN', limit: 100 })
      .then(res => setRequests(res.data.data))
      .catch(() => {})
  }, [])

  const handleAccept = async (id) => {
    try {
      await acceptRequest(id)
      toast.success('Request accepted!')
      setRequests(p => p.filter(r => r._id !== id))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    }
  }

  const validRequests = requests.filter(r =>
    r.location?.coordinates?.[1] && r.location?.coordinates?.[0]
  )

  return (
    <div className="rounded-xl overflow-hidden border border-slate-800 h-[600px]">
      <MapContainer
        center={[13.0827, 80.2707]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        {validRequests.map((r) => (
          <Marker
            key={r._id}
            position={[r.location.coordinates[1], r.location.coordinates[0]]}
            icon={r.urgencyLevel === 'Critical' ? redIcon : new L.Icon.Default()}>
            <Popup>
              <div className="text-slate-100 min-w-[180px]">
                <div className="flex gap-2 mb-2 flex-wrap">
                  <BloodBadge group={r.bloodGroup} />
                  <UrgencyChip level={r.urgencyLevel} />
                </div>
                <p className="font-medium text-sm mb-1">{r.hospital?.hospitalName || r.hospital?.name}</p>
                <p className="text-xs text-slate-400 mb-3">{r.location?.city} · {r.unitsRequired} unit{r.unitsRequired > 1 ? 's' : ''}</p>
                <button onClick={() => handleAccept(r._id)}
                  className="w-full bg-blood-600 hover:bg-blood-700 text-white text-xs py-1.5 rounded-lg transition-all">
                  Accept Request
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
