import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import CarCard from '../components/CarCard';
import ScoreDisplay from '../components/ScoreDisplay';

export default function SharedGame() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.game.getShared(code)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4 animate-pulse">🚗</div>
        <p className="text-white/50">Loading shared game...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 mb-4">{error || 'Game not found'}</p>
        <Link to="/" className="btn-primary">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center">
        <p className="text-white/40 text-sm mb-1">
          {data.username}'s {data.gameType === 'daily' ? `Cardle #${data.gameNumber}` : 'Practice'} Result
        </p>
      </div>

      <ScoreDisplay
        scores={data.scores}
        totalScore={data.totalScore}
        gameNumber={data.gameNumber}
        gameDate={data.gameDate}
        gameType={data.gameType}
      />

      <div className="flex gap-3 justify-center">
        <Link to="/play/daily" className="btn-primary">
          Play Today's Cardle
        </Link>
        <Link to="/play/practice" className="btn-secondary">
          Practice
        </Link>
      </div>

      {/* All cars in the shared game */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-bold text-center text-white/70">Cars in this Game</h3>
        {data.cars.map((car, i) => (
          <CarCard
            key={i}
            car={car}
            carNumber={i + 1}
            totalCars={data.cars.length}
            revealed={car.guessed}
            userGuess={data.guesses[i]}
            scoreData={data.scores[i]}
          />
        ))}
      </div>
    </div>
  );
}
