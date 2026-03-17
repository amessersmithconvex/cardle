import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero */}
      <section className="text-center mb-16">
        <div className="text-7xl mb-4">🚗</div>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-4">
          <span className="text-gradient">CARDLE</span>
        </h1>
        <p className="text-xl sm:text-2xl text-white/60 font-medium max-w-xl mx-auto">
          Can you guess what the car sold for? Test your automotive instincts daily.
        </p>
      </section>

      {/* Game modes */}
      <section className="grid sm:grid-cols-2 gap-6 mb-16">
        <Link
          to="/play/daily"
          className="card p-8 hover:border-accent-500/40 transition-all group cursor-pointer"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">📅</div>
            <div>
              <h3 className="text-xl font-bold mb-1 group-hover:text-accent-400 transition">
                Daily Challenge
              </h3>
              <p className="text-white/50 text-sm leading-relaxed">
                5 cars, one chance. Same game for everyone. Resets at midnight EST.
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/play/practice"
          className="card p-8 hover:border-accent-500/40 transition-all group cursor-pointer"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🔄</div>
            <div>
              <h3 className="text-xl font-bold mb-1 group-hover:text-accent-400 transition">
                Practice Mode
              </h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Unlimited games with random cars. Sharpen your pricing skills.
              </p>
            </div>
          </div>
        </Link>
      </section>

      {/* How it works */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              icon: '🔍',
              title: 'Inspect the Car',
              desc: 'Review the make, model, year, mileage, condition, and mechanical history of each car.',
            },
            {
              step: '2',
              icon: '💰',
              title: 'Guess the Price',
              desc: 'Enter what you think the car sold for at auction. Get as close as you can.',
            },
            {
              step: '3',
              icon: '🏆',
              title: 'Score Points',
              desc: 'Earn up to 1,000 points per car based on accuracy. Max score is 5,000.',
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-3 text-2xl">
                {item.icon}
              </div>
              <h3 className="font-bold mb-1">{item.title}</h3>
              <p className="text-white/50 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Scoring */}
      <section className="card p-8 mb-16">
        <h2 className="text-2xl font-bold text-center mb-6">Scoring System</h2>
        <div className="max-w-md mx-auto space-y-3">
          {[
            { emoji: '🟩', range: '950–1,000', label: 'Spot On', detail: 'Within 5%' },
            { emoji: '🟩', range: '850–949', label: 'Excellent', detail: 'Within 15%' },
            { emoji: '🟨', range: '700–849', label: 'Good', detail: 'Within 30%' },
            { emoji: '🟧', range: '400–699', label: 'Fair', detail: 'Within 60%' },
            { emoji: '🟥', range: '1–399', label: 'Poor', detail: 'Within 100%' },
            { emoji: '⬛', range: '0', label: 'Miss', detail: 'Over 100% off' },
          ].map((tier) => (
            <div key={tier.label} className="flex items-center gap-3 text-sm">
              <span className="text-xl">{tier.emoji}</span>
              <span className="font-mono font-bold w-24">{tier.range}</span>
              <span className="font-semibold w-20">{tier.label}</span>
              <span className="text-white/40">{tier.detail}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-white/40 text-sm mt-6">
          Score = 1,000 × (1 − percent off). 5 cars per game = max 5,000 points.
        </p>
      </section>

      {/* CTA */}
      {!user && (
        <section className="text-center">
          <p className="text-white/50 mb-4">
            Create an account to track your stats and compete on the leaderboard.
          </p>
          <Link to="/register" className="btn-primary inline-block">
            Create Free Account
          </Link>
        </section>
      )}
    </div>
  );
}
