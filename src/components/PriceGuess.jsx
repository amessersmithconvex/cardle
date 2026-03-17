import { useState, useRef, useEffect } from 'react';

const PRESETS = [5000, 10000, 25000, 50000, 100000, 250000];

export default function PriceGuess({ onSubmit, disabled }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const numericValue = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;

  function handleChange(e) {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw === '') {
      setValue('');
      return;
    }
    const num = parseInt(raw, 10);
    if (num > 9999999) return;
    setValue(num.toLocaleString());
  }

  function handlePreset(amount) {
    const newValue = numericValue + amount;
    if (newValue > 9999999) return;
    setValue(newValue.toLocaleString());
    inputRef.current?.focus();
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (numericValue < 100) return;
    onSubmit(numericValue);
    setValue('');
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 mt-4 animate-slide-up">
      <label className="block text-sm font-semibold text-white/70 mb-3">
        What did this car sell for?
      </label>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-accent-400">$</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          placeholder="0"
          disabled={disabled}
          className="input-field text-3xl font-bold font-mono pl-10 pr-4 py-4 text-center"
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {PRESETS.map((amount) => (
          <button
            type="button"
            key={amount}
            onClick={() => handlePreset(amount)}
            disabled={disabled}
            className="bg-surface-900 hover:bg-surface-800 border border-white/10
                       px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-white/60
                       hover:text-white transition disabled:opacity-30"
          >
            +${amount >= 1000 ? `${amount / 1000}k` : amount}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setValue('')}
          disabled={disabled}
          className="bg-surface-900 hover:bg-red-900/30 border border-white/10
                     px-3 py-1.5 rounded-lg text-xs font-bold text-red-400/60
                     hover:text-red-400 transition disabled:opacity-30"
        >
          Clear
        </button>
      </div>

      <button
        type="submit"
        disabled={disabled || numericValue < 100}
        className="btn-primary w-full mt-4 text-lg"
      >
        {numericValue >= 100
          ? `Lock In $${numericValue.toLocaleString()}`
          : 'Enter your guess'}
      </button>
    </form>
  );
}
