import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    api.game.getUserStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="animate-pulse text-white/50">Loading stats...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-white/50">Unable to load stats.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-500 to-amber-500 flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl font-black">{user.username[0].toUpperCase()}</span>
        </div>
        <h1 className="text-2xl font-black">{user.username}</h1>
        <p className="text-white/40 text-sm">{user.email}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Games Played', value: stats.totalGames },
          { label: 'Avg Score', value: stats.avgScore.toLocaleString() },
          { label: 'Best Score', value: stats.bestScore.toLocaleString() },
          { label: 'Daily Streak', value: `${stats.dailyStreak} 🔥` },
        ].map((stat) => (
          <div key={stat.label} className="card p-4 text-center">
            <p className="text-2xl font-black font-mono">{stat.value}</p>
            <p className="text-white/40 text-xs mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <p className="text-xl font-bold font-mono">{stats.dailyGames}</p>
          <p className="text-white/40 text-xs mt-1">Daily Games</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xl font-bold font-mono">{stats.practiceGames}</p>
          <p className="text-white/40 text-xs mt-1">Practice Games</p>
        </div>
      </div>

      {/* Recent games */}
      {stats.recentGames && stats.recentGames.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-white/10">
            <h2 className="font-bold">Recent Games</h2>
          </div>
          <div className="divide-y divide-white/5">
            {stats.recentGames.map((game) => (
              <div key={game.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {game.game_type === 'daily'
                      ? `Cardle #${game.game_number}`
                      : 'Practice'}
                  </p>
                  <p className="text-xs text-white/40">
                    {game.game_type === 'daily' ? game.game_date : new Date(game.completed_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="font-mono font-bold text-accent-400">
                    {game.total_score.toLocaleString()}
                  </span>
                  {game.share_code && (
                    <Link
                      to={`/share/${game.share_code}`}
                      className="text-xs text-white/30 hover:text-white/60"
                    >
                      View
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.totalGames === 0 && (
        <div className="text-center py-8">
          <p className="text-white/40 mb-4">No games played yet!</p>
          <Link to="/play/daily" className="btn-primary">Play Your First Game</Link>
        </div>
      )}
    </div>
  );
}
