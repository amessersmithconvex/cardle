import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ensureSession } from '../api';
import { useAuth } from '../context/AuthContext';
import CarCard from '../components/CarCard';
import PriceGuess from '../components/PriceGuess';
import ScoreDisplay from '../components/ScoreDisplay';
import ShareButton from '../components/ShareButton';

export default function Game({ mode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cars, setCars] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores] = useState([]);
  const [guesses, setGuesses] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [showFinalResults, setShowFinalResults] = useState(false);
  const [shareCode, setShareCode] = useState(null);
  const [gameNumber, setGameNumber] = useState(null);
  const [gameDate, setGameDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [practiceId, setPracticeId] = useState(null);
  const [gameSessionId, setGameSessionId] = useState(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);

  const loadGame = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      ensureSession();

      if (mode === 'daily') {
        const data = await api.game.getDaily();
        setCars(data.cars);
        setGameNumber(data.gameNumber);
        setGameDate(data.date);

        if (data.session) {
          const s = data.session;
          setScores(s.scores);
          setGuesses(s.guesses);
          setTotalScore(s.totalScore);
          setCurrentIndex(s.currentCarIndex);
          setShareCode(s.shareCode);
          if (s.completed) {
            setGameComplete(true);
            setShowFinalResults(true);
            setAlreadyPlayed(true);
          } else if (s.scores.length > 0) {
            setShowResult(true);
          }
        }
      } else {
        const data = await api.game.startPractice();
        setCars(data.cars);
        setPracticeId(data.practiceId);
        setGameSessionId(data.gameSessionId);
        if (data.sessionToken) {
          localStorage.setItem('cardle_session', data.sessionToken);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  async function handleGuess(guess) {
    try {
      setSubmitting(true);

      let result;
      if (mode === 'daily') {
        result = await api.game.submitDailyGuess(guess);
      } else {
        result = await api.game.submitPracticeGuess(practiceId, gameSessionId, guess);
      }

      const newGuesses = [...guesses, guess];
      const newScores = [...scores, {
        score: result.score,
        percentOff: result.percentOff,
        rating: result.rating,
        emoji: result.emoji,
      }];

      setGuesses(newGuesses);
      setScores(newScores);
      setTotalScore(result.totalScore);
      setShowResult(true);

      const updatedCars = [...cars];
      updatedCars[currentIndex] = {
        ...updatedCars[currentIndex],
        soldPrice: result.actualPrice,
        guessed: true,
        userGuess: guess,
        score: result.score,
        percentOff: result.percentOff,
        rating: result.rating,
        emoji: result.emoji,
      };
      setCars(updatedCars);

      if (result.completed) {
        setGameComplete(true);
        setShareCode(result.shareCode);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleNextCar() {
    if (gameComplete) {
      setShowFinalResults(true);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setShowResult(false);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4 animate-pulse">🚗</div>
        <p className="text-white/50">Loading game...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={loadGame} className="btn-primary">Try Again</button>
      </div>
    );
  }

  if (showFinalResults) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {alreadyPlayed && mode === 'daily' && (
          <div className="text-center bg-accent-500/10 border border-accent-500/20 rounded-xl p-4">
            <p className="text-accent-400 font-semibold">You already played today's Cardle!</p>
            <p className="text-white/50 text-sm mt-1">Come back tomorrow for a new challenge.</p>
          </div>
        )}

        <ScoreDisplay
          scores={scores}
          totalScore={totalScore}
          gameNumber={gameNumber}
          gameDate={gameDate}
          gameType={mode}
        />

        {shareCode && (
          <ShareButton
            scores={scores}
            totalScore={totalScore}
            gameNumber={gameNumber}
            gameDate={gameDate}
            shareCode={shareCode}
            gameType={mode}
          />
        )}

        <div className="flex gap-3">
          {mode === 'practice' && (
            <button onClick={() => { window.location.reload(); }} className="btn-secondary flex-1">
              Play Again
            </button>
          )}
          <button onClick={() => navigate('/')} className="btn-secondary flex-1">
            Home
          </button>
          {!user && (
            <button onClick={() => navigate('/register')} className="btn-primary flex-1">
              Sign Up to Save
            </button>
          )}
        </div>

        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-bold text-center text-white/70">Game Review</h3>
          {cars.map((car, i) => (
            <CarCard
              key={i}
              car={car}
              carNumber={i + 1}
              totalCars={cars.length}
              revealed={true}
              userGuess={guesses[i]}
              scoreData={scores[i]}
            />
          ))}
        </div>
      </div>
    );
  }

  const currentCar = cars[currentIndex];
  const isRevealed = showResult && currentIndex < guesses.length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/50">
          {mode === 'daily' ? `Cardle #${gameNumber}` : 'Practice Mode'}
        </span>
        <span className="font-mono font-bold text-accent-400">
          {totalScore.toLocaleString()} pts
        </span>
      </div>
      <div className="flex gap-1.5">
        {cars.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              i < scores.length
                ? scores[i].score >= 700 ? 'bg-green-500' :
                  scores[i].score >= 400 ? 'bg-yellow-400' : 'bg-red-500'
                : i === currentIndex
                  ? 'bg-accent-500'
                  : 'bg-surface-800'
            }`}
          />
        ))}
      </div>

      {currentCar && (
        <CarCard
          car={currentCar}
          carNumber={currentIndex + 1}
          totalCars={cars.length}
          revealed={isRevealed}
          userGuess={guesses[currentIndex]}
          scoreData={scores[currentIndex]}
        />
      )}

      {!isRevealed ? (
        <PriceGuess onSubmit={handleGuess} disabled={submitting} />
      ) : (
        <button onClick={handleNextCar} className="btn-primary w-full text-lg mt-4">
          {gameComplete ? 'See Final Results' : 'Next Car →'}
        </button>
      )}
    </div>
  );
}
