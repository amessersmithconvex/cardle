import { useState } from 'react';

export default function ShareButton({ scores, totalScore, gameNumber, gameDate, shareCode, gameType }) {
  const [copied, setCopied] = useState(false);

  function buildShareText() {
    const emojis = scores.map((s) => s.emoji).join('');
    const title = gameType === 'daily'
      ? `Cardle #${gameNumber}`
      : 'Cardle Practice';
    const url = `${window.location.origin}/share/${shareCode}`;

    return `${title} 🚗 ${totalScore.toLocaleString()}/5,000\n${emojis}\n\n${url}`;
  }

  async function handleShare() {
    const text = buildShareText();

    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <button
      onClick={handleShare}
      className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 active:scale-95 ${
        copied
          ? 'bg-green-600 text-white'
          : 'bg-accent-500 hover:bg-accent-400 text-white'
      }`}
    >
      {copied ? 'Copied to Clipboard!' : 'Share Your Score'}
    </button>
  );
}
