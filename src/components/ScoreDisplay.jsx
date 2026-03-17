export default function ScoreDisplay({ scores, totalScore, gameNumber, gameDate, gameType }) {
  const maxScore = 5000;
  const percentage = Math.round((totalScore / maxScore) * 100);

  let overallRating;
  if (percentage >= 90) overallRating = 'Master Appraiser';
  else if (percentage >= 75) overallRating = 'Expert Eye';
  else if (percentage >= 60) overallRating = 'Good Instincts';
  else if (percentage >= 40) overallRating = 'Getting There';
  else overallRating = 'Keep Practicing';

  return (
    <div className="card p-6 animate-scale-in">
      <div className="text-center mb-6">
        {gameType === 'daily' && (
          <p className="text-white/40 text-sm mb-1">
            Cardle #{gameNumber} — {gameDate}
          </p>
        )}
        {gameType === 'practice' && (
          <p className="text-white/40 text-sm mb-1">Practice Round</p>
        )}
        <h2 className="text-4xl font-black font-mono text-gradient animate-pulse-score inline-block">
          {totalScore.toLocaleString()}
        </h2>
        <p className="text-white/40 text-sm">/ {maxScore.toLocaleString()} points</p>
        <p className="text-lg font-bold mt-2 text-accent-400">{overallRating}</p>
      </div>

      <div className="space-y-3">
        {scores.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-lg w-8">{s.emoji}</span>
            <div className="flex-1">
              <div className="bg-surface-950 rounded-full overflow-hidden h-3">
                <div
                  className={`score-bar ${
                    s.score >= 900 ? 'bg-green-500' :
                    s.score >= 700 ? 'bg-yellow-400' :
                    s.score >= 400 ? 'bg-orange-500' :
                    s.score > 0 ? 'bg-red-500' : 'bg-gray-600'
                  }`}
                  style={{ width: `${s.score / 10}%` }}
                />
              </div>
            </div>
            <span className="font-mono font-bold text-sm w-16 text-right">
              {s.score}/1k
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="bg-surface-950 rounded-full overflow-hidden h-4">
          <div
            className="h-4 rounded-full bg-gradient-to-r from-accent-500 to-amber-400 transition-all duration-1000 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-center text-white/50 text-sm mt-2">{percentage}% accuracy</p>
      </div>
    </div>
  );
}
