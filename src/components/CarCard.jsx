import { useState } from 'react';

const MAKE_COLORS = {
  Porsche: 'from-red-600 to-red-900',
  Ford: 'from-blue-600 to-blue-900',
  BMW: 'from-blue-500 to-sky-900',
  Toyota: 'from-red-500 to-gray-800',
  Honda: 'from-red-600 to-red-950',
  Tesla: 'from-gray-600 to-gray-900',
  Chevrolet: 'from-yellow-600 to-gray-900',
  'Mercedes-Benz': 'from-gray-400 to-gray-800',
  Dodge: 'from-red-700 to-black',
  Lamborghini: 'from-yellow-500 to-yellow-900',
  McLaren: 'from-orange-500 to-orange-900',
  Ferrari: 'from-red-500 to-red-800',
  Audi: 'from-gray-500 to-gray-900',
  Nissan: 'from-red-600 to-gray-800',
  Jeep: 'from-green-700 to-green-950',
  Mazda: 'from-red-600 to-gray-900',
  Rivian: 'from-teal-500 to-teal-900',
  Subaru: 'from-blue-600 to-blue-950',
  Lexus: 'from-gray-300 to-gray-700',
  Hyundai: 'from-blue-500 to-blue-900',
  'Land Rover': 'from-green-600 to-green-900',
  'Aston Martin': 'from-emerald-600 to-emerald-950',
  Volkswagen: 'from-blue-500 to-blue-800',
  Ram: 'from-gray-600 to-black',
  Datsun: 'from-orange-500 to-orange-800',
  Genesis: 'from-amber-600 to-amber-950',
  Mitsubishi: 'from-red-600 to-gray-800',
  Kia: 'from-gray-500 to-gray-800',
  Acura: 'from-gray-400 to-gray-700',
  Infiniti: 'from-purple-600 to-purple-900',
  Volvo: 'from-blue-400 to-blue-800',
  Cadillac: 'from-gray-500 to-gray-900',
  Lincoln: 'from-gray-400 to-gray-800',
  Buick: 'from-gray-500 to-gray-800',
  GMC: 'from-red-700 to-gray-900',
  Chrysler: 'from-blue-500 to-gray-800',
  Pontiac: 'from-red-600 to-black',
  Saturn: 'from-purple-500 to-gray-800',
  Jaguar: 'from-green-700 to-green-950',
  Maserati: 'from-blue-800 to-blue-950',
  Bentley: 'from-green-800 to-green-950',
  'Rolls-Royce': 'from-purple-800 to-gray-900',
};

function getGradient(make) {
  return MAKE_COLORS[make] || 'from-primary-600 to-primary-900';
}

function hasDamageInfo(car) {
  return car.damage && car.damage !== 'None reported';
}

export default function CarCard({ car, carNumber, totalCars, revealed, userGuess, scoreData }) {
  const isSalvage = hasDamageInfo(car);
  const tabs = isSalvage
    ? ['details', 'condition', 'highlights']
    : ['details', 'mechanical', 'highlights'];
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [imgIdx, setImgIdx] = useState(0);
  const [imgError, setImgError] = useState(false);
  const gradient = getGradient(car.make);

  const hasImages = car.images && car.images.length > 0 && !imgError;

  return (
    <div className="card animate-scale-in">
      {/* Hero section with optional image */}
      {hasImages ? (
        <div className="relative group">
          <img
            src={car.images[imgIdx]}
            alt={`${car.year} ${car.make} ${car.model}`}
            className="w-full h-56 sm:h-72 object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
            Car {carNumber} of {totalCars}
          </div>
          {car.auctionHouse && (
            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
              {car.auctionHouse}
            </div>
          )}
          {car.images.length > 1 && (
            <>
              <button
                onClick={() => setImgIdx((prev) => (prev - 1 + car.images.length) % car.images.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 backdrop-blur-sm w-9 h-9 rounded-full flex items-center justify-center text-white text-lg font-bold sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              >
                ‹
              </button>
              <button
                onClick={() => setImgIdx((prev) => (prev + 1) % car.images.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 backdrop-blur-sm w-9 h-9 rounded-full flex items-center justify-center text-white text-lg font-bold sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              >
                ›
              </button>
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
                {imgIdx + 1} / {car.images.length}
              </div>
            </>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-2xl sm:text-3xl font-black drop-shadow-lg">
              {car.year} {car.make}
            </h2>
            <p className="text-lg sm:text-xl font-semibold text-white/90 drop-shadow">
              {car.model} {car.trim}
            </p>
            {isSalvage && (
              <span className="inline-block mt-2 bg-red-500/40 backdrop-blur-sm border border-red-400/40 px-2.5 py-0.5 rounded-full text-xs font-bold text-red-200">
                ⚠ {car.damage}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className={`relative bg-gradient-to-br ${gradient} p-6 sm:p-8`}>
          <div className="absolute top-4 left-4 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
            Car {carNumber} of {totalCars}
          </div>
          {car.auctionHouse && (
            <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
              {car.auctionHouse}
            </div>
          )}
          <div className="text-center pt-6 pb-2">
            <div className="text-6xl mb-3 opacity-80">🚗</div>
            <h2 className="text-3xl sm:text-4xl font-black">
              {car.year} {car.make}
            </h2>
            <p className="text-xl sm:text-2xl font-semibold text-white/90 mt-1">
              {car.model} {car.trim}
            </p>
            {isSalvage && (
              <div className="inline-block mt-3 bg-red-500/30 border border-red-400/40 px-3 py-1 rounded-full text-sm font-bold text-red-200">
                ⚠ {car.damage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? 'text-accent-400 border-b-2 border-accent-400'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5 min-h-[200px]">
        {activeTab === 'details' && (
          <div className="grid grid-cols-2 gap-4 animate-fade-in">
            <InfoItem label="Mileage" value={car.mileage ? `${car.mileage.toLocaleString()} mi` : 'Unknown'} />
            <InfoItem label="Engine" value={car.engine || 'N/A'} />
            {car.transmission && <InfoItem label="Transmission" value={car.transmission} />}
            <InfoItem label="Drivetrain" value={car.drivetrain || 'N/A'} />
            {car.exteriorColor && <InfoItem label="Exterior" value={car.exteriorColor} />}
            {car.interiorColor && <InfoItem label="Interior" value={car.interiorColor} />}
            {car.location && <InfoItem label="Location" value={car.location} />}
            <InfoItem label="Sold Date" value={car.soldDate || 'N/A'} />
          </div>
        )}

        {activeTab === 'condition' && (
          <div className="animate-fade-in space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoItem
                label="Damage"
                value={car.damage || 'None reported'}
                highlight={hasDamageInfo(car)}
              />
              <InfoItem
                label="Status"
                value={car.status || car.condition || 'Unknown'}
                highlight={car.status === 'Does Not Run'}
                good={car.status === 'Run and Drive'}
              />
              {car.seller && <InfoItem label="Seller" value={car.seller} />}
              {car.saleDocument && <InfoItem label="Sale Doc" value={car.saleDocument} />}
            </div>
            {car.mechanicalNotes && (
              <div className="mt-2 pt-3 border-t border-white/10">
                <p className="text-white/70 text-sm leading-relaxed">{car.mechanicalNotes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'mechanical' && (
          <div className="animate-fade-in">
            <p className="text-white/80 leading-relaxed">{car.mechanicalNotes || 'No notes available.'}</p>
            {(car.auctionSource || car.auctionHouse) && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <span className="text-white/40 text-sm">Source: </span>
                <span className="text-white/70 text-sm font-medium">
                  {car.auctionSource || car.auctionHouse}
                </span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'highlights' && (
          <div className="animate-fade-in">
            {car.highlights && car.highlights.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {car.highlights.map((h, i) => (
                  <span
                    key={i}
                    className="bg-accent-500/20 text-accent-400 border border-accent-500/30 px-3 py-1.5 rounded-lg text-sm font-medium"
                  >
                    {h}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-white/40">No highlights listed.</p>
            )}
            {car.vin && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <span className="text-white/40 text-xs">VIN: </span>
                <span className="text-white/50 text-xs font-mono">{car.vin}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Revealed result */}
      {revealed && scoreData && (
        <div className="border-t border-white/10 p-5 bg-surface-900/50 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/50 text-sm">Your Guess</p>
              <p className="text-xl font-bold font-mono">${userGuess?.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-sm">Actual Price</p>
              <p className="text-xl font-bold font-mono text-accent-400">
                ${car.soldPrice?.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{scoreData.emoji}</span>
              <span className="font-bold text-lg">{scoreData.rating}</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono animate-pulse-score inline-block">
                {scoreData.score}
              </span>
              <span className="text-white/50 text-sm"> / 1,000</span>
            </div>
          </div>
          <div className="mt-3 bg-surface-950 rounded-full overflow-hidden h-3">
            <div
              className={`score-bar ${
                scoreData.score >= 900 ? 'bg-green-500' :
                scoreData.score >= 700 ? 'bg-yellow-400' :
                scoreData.score >= 400 ? 'bg-orange-500' :
                scoreData.score > 0 ? 'bg-red-500' : 'bg-gray-600'
              }`}
              style={{ width: `${scoreData.score / 10}%` }}
            />
          </div>
          <p className="text-white/40 text-sm mt-2 text-center">
            {scoreData.percentOff}% off
          </p>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, highlight, good }) {
  return (
    <div>
      <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${
        highlight ? 'text-red-400' :
        good ? 'text-green-400' :
        'text-white/90'
      }`}>
        {value}
      </p>
    </div>
  );
}
