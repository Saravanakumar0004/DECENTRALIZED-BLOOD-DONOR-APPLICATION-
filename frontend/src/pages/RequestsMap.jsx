import DonorMap from '../components/donor/DonorMap'

export function RequestsMap() {
  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blood-500 animate-pulse" />
        <span className="text-slate-400 text-sm">Live blood request locations near you</span>
      </div>
      <DonorMap />
    </div>
  )
}

export default RequestsMap