import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-center px-4">
      <div>
        <p className="font-display text-[10rem] text-slate-800 leading-none select-none">404</p>
        <h1 className="font-display text-4xl text-blood-400 -mt-8 mb-4">PAGE NOT FOUND</h1>
        <p className="text-slate-500 mb-8">The page you're looking for doesn't exist.</p>
        <Link to="/" className="btn-primary px-8">Go Home</Link>
      </div>
    </div>
  )
}

export default NotFound