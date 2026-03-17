import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/10">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-2xl">🚗</span>
          <span className="text-xl font-black tracking-tight text-gradient group-hover:opacity-80 transition">
            CARDLE
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/play/daily" className="btn-secondary !py-2 !px-4 text-sm">
            Daily
          </Link>
          <Link to="/play/practice" className="btn-secondary !py-2 !px-4 text-sm">
            Practice
          </Link>
          {user ? (
            <>
              <Link to="/profile" className="btn-secondary !py-2 !px-4 text-sm">
                {user.username}
              </Link>
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="text-sm text-white/50 hover:text-white transition px-2"
              >
                Log out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary !py-2 !px-4 text-sm">
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-white/70 hover:text-white"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/10 bg-surface-900/95 backdrop-blur-lg animate-fade-in">
          <div className="px-4 py-3 flex flex-col gap-2">
            <Link to="/play/daily" className="btn-secondary text-center text-sm" onClick={() => setMenuOpen(false)}>
              Daily Game
            </Link>
            <Link to="/play/practice" className="btn-secondary text-center text-sm" onClick={() => setMenuOpen(false)}>
              Practice
            </Link>
            {user ? (
              <>
                <Link to="/profile" className="btn-secondary text-center text-sm" onClick={() => setMenuOpen(false)}>
                  Profile ({user.username})
                </Link>
                <button
                  onClick={() => { logout(); navigate('/'); setMenuOpen(false); }}
                  className="text-sm text-white/50 hover:text-white transition py-2"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" className="btn-primary text-center text-sm" onClick={() => setMenuOpen(false)}>
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
