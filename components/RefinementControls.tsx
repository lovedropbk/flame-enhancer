


import React, { useState, useEffect, useCallback, useRef } from 'react';
import Button from './common/Button';
import { RefinementSettings } from '../types';
import { MAJOR_CITIES } from '../constants';

interface RefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (settings: RefinementSettings) => void;
}

const RefinementModal: React.FC<RefinementModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [targetVibe, setTargetVibe] = useState<number>(50);
  const [isVibeNotSure, setIsVibeNotSure] = useState(false);
  
  const [relationshipGoal, setRelationshipGoal] = useState<number>(50);
  const [isGoalNotSure, setIsGoalNotSure] = useState(false);

  const [targetSophistication, setTargetSophistication] = useState<number>(50);
  const [isSophisticationNotSure, setIsSophisticationNotSure] = useState(false);

  const [useSimpleLanguage, setUseSimpleLanguage] = useState(false);

  const [swipeLocation, setSwipeLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [locationStatus, setLocationStatus] = useState<'living' | 'visiting' | null>(null);
  
  const [originLocation, setOriginLocation] = useState('');
  const [originLocationSuggestions, setOriginLocationSuggestions] = useState<string[]>([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);


  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset state when modal is closed to ensure it's fresh on next open
    if (!isOpen) {
        setTargetVibe(50);
        setIsVibeNotSure(false);
        setRelationshipGoal(50);
        setIsGoalNotSure(false);
        setTargetSophistication(50);
        setIsSophisticationNotSure(false);
        setUseSimpleLanguage(false);
        setSwipeLocation('');
        setAdditionalInfo('');
        setLocationStatus(null);
        setOriginLocation('');
        setLocationSuggestions([]);
        setShowSuggestions(false);
        setOriginLocationSuggestions([]);
        setShowOriginSuggestions(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setShowOriginSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [modalRef]);


  if (!isOpen) {
    return null;
  }
  
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSwipeLocation(value);
    setLocationStatus(null); // Reset subsequent choices
    setOriginLocation('');

    if (value.trim().length > 1) {
      const filtered = MAJOR_CITIES.filter(city => 
        city.toLowerCase().includes(value.toLowerCase())
      );
      setLocationSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };
  
  const selectLocationSuggestion = (location: string) => {
      setSwipeLocation(location);
      setShowSuggestions(false);
  }

  const handleOriginLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setOriginLocation(value);

    if (value.trim().length > 1) {
      const filtered = MAJOR_CITIES.filter(city => 
        city.toLowerCase().includes(value.toLowerCase())
      );
      setOriginLocationSuggestions(filtered.slice(0, 5));
      setShowOriginSuggestions(true);
    } else {
      setShowOriginSuggestions(false);
    }
  };

  const selectOriginLocationSuggestion = (location: string) => {
      setOriginLocation(location);
      setShowOriginSuggestions(false);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      targetVibe: isVibeNotSure ? null : targetVibe,
      relationshipGoal: isGoalNotSure ? null : relationshipGoal,
      targetSophistication: isSophisticationNotSure ? null : targetSophistication,
      useSimpleLanguage,
      swipeLocation,
      locationStatus,
      originLocation,
      additionalInfo
    });
  };
  
  const getSliderLabel = (value: number, labels: [string, string, string, string, string]) => {
      if (value <= 15) return labels[0];
      if (value <= 40) return labels[1];
      if (value <= 65) return labels[2];
      if (value <= 90) return labels[3];
      return labels[4];
  }

  const vibeLabels: [string, string, string, string, string] = ['Sweet & Wholesome 😇', 'Kind & Easygoing 😊', 'Fun & Balanced 😎', 'Confident & Bold 😏', 'Edgy & Daring 😈'];
  const goalLabels: [string, string, string, string, string] = ['Ready for Marriage 💍', 'Serious Relationship 💞', 'Something Meaningful ❤️', 'Open to Dating 🥂', 'Casual Fun 🎉'];
  const sophisticationLabels: [string, string, string, string, string] = ['University Professor 🎓', 'Cultured Intellectual 📚', 'Witty Professional 💼', 'Life of the Party 🎉', 'Insta-Model 💅'];


  const showLocationStatusSelector = swipeLocation.trim() !== '' && locationStatus === null && !showSuggestions;

  return (
    <div 
      className="fixed inset-0 bg-slate-900 bg-opacity-75 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        className="bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-lg border border-purple-700 relative transform transition-all duration-300 scale-95 animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-2 rounded-full"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">
          Target Your Perfect Match
        </h2>
        <p className="text-slate-300 mb-6">
          Give us more direction to tailor your profile's vibe and focus.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Target Vibe Slider */}
          <div>
             <div className="flex justify-between items-center mb-2">
                <label htmlFor="targetVibe" className="block text-lg font-semibold text-slate-100">
                Target Vibe: <span className="text-purple-400 font-bold">{isVibeNotSure ? 'Not Sure' : getSliderLabel(targetVibe, vibeLabels)}</span>
                </label>
                <Button type="button" size="small" variant={isVibeNotSure ? 'primary' : 'secondary'} onClick={() => setIsVibeNotSure(!isVibeNotSure)}>Not Sure</Button>
            </div>
            <input
                id="targetVibe"
                type="range"
                min="0"
                max="100"
                step="1"
                value={targetVibe}
                onChange={(e) => { setTargetVibe(Number(e.target.value)); setIsVibeNotSure(false); }}
                disabled={isVibeNotSure}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{'--thumb-color': '#a855f7'} as React.CSSProperties}
            />
          </div>
          
          {/* Dating Goal Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
                <label htmlFor="relationshipGoal" className="block text-lg font-semibold text-slate-100">
                Dating Goal: <span className="text-purple-400 font-bold">{isGoalNotSure ? 'Not Sure' : getSliderLabel(relationshipGoal, goalLabels)}</span>
                </label>
                <Button type="button" size="small" variant={isGoalNotSure ? 'primary' : 'secondary'} onClick={() => setIsGoalNotSure(!isGoalNotSure)}>Not Sure</Button>
            </div>
            <input
                id="relationshipGoal"
                type="range"
                min="0"
                max="100"
                step="1"
                value={relationshipGoal}
                onChange={(e) => { setRelationshipGoal(Number(e.target.value)); setIsGoalNotSure(false); }}
                disabled={isGoalNotSure}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{'--thumb-color': '#a855f7'} as React.CSSProperties}
            />
          </div>

          {/* Target Partner Sophistication Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
                <label htmlFor="targetSophistication" className="block text-lg font-semibold text-slate-100">
                Partner Intellect: <span className="text-purple-400 font-bold">{isSophisticationNotSure ? 'Not Sure' : getSliderLabel(targetSophistication, sophisticationLabels)}</span>
                </label>
                <Button type="button" size="small" variant={isSophisticationNotSure ? 'primary' : 'secondary'} onClick={() => setIsSophisticationNotSure(!isSophisticationNotSure)}>Not Sure</Button>
            </div>
            <input
                id="targetSophistication"
                type="range"
                min="0"
                max="100"
                step="1"
                value={targetSophistication}
                onChange={(e) => { setTargetSophistication(Number(e.target.value)); setIsSophisticationNotSure(false); }}
                disabled={isSophisticationNotSure}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{'--thumb-color': '#a855f7'} as React.CSSProperties}
            />
          </div>

          {/* Simple Language Checkbox */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={useSimpleLanguage}
                    onChange={(e) => setUseSimpleLanguage(e.target.checked)}
                    className="form-checkbox h-5 w-5 text-purple-500 focus:ring-purple-400 rounded bg-slate-700 border-slate-600"
                />
                <span className="text-slate-100 font-semibold">Use Simple Language</span>
            </label>
            <p className="text-sm text-slate-400 mt-1 ml-8">
                Crucial for non-native English speakers. This drastically simplifies vocabulary and sentence structure.
            </p>
          </div>
          
          {/* Swipe Location */}
          <div className="relative">
            <label htmlFor="swipeLocation" className="block text-lg font-semibold text-slate-100 mb-2">
              Swipe Location
            </label>
            <input
              id="swipeLocation"
              type="text"
              value={swipeLocation}
              onChange={handleLocationChange}
              onFocus={() => { if(swipeLocation.trim().length > 1) setShowSuggestions(true)}}
              placeholder="e.g., New York, NY or Bangkok"
              autoComplete="off"
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-100 placeholder-slate-400"
            />
            {showSuggestions && locationSuggestions.length > 0 && (
                <ul className="absolute z-20 w-full bg-slate-600 border border-slate-500 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                    {locationSuggestions.map(loc => (
                        <li key={loc} onClick={() => selectLocationSuggestion(loc)}
                            className="px-4 py-2 text-slate-200 hover:bg-purple-600 cursor-pointer">
                            {loc}
                        </li>
                    ))}
                </ul>
            )}
          </div>

          {/* Location Status Selector */}
          {showLocationStatusSelector && (
            <div className="p-3 bg-slate-700/50 rounded-lg animate-fade-in-up">
              <p className="text-sm text-slate-300 mb-3 text-center">And are you living there or just passing through?</p>
              <div className="flex justify-center gap-4">
                <Button type="button" variant="secondary" onClick={() => setLocationStatus('living')}>I Live Here</Button>
                <Button type="button" variant="secondary" onClick={() => setLocationStatus('visiting')}>I'm Visiting</Button>
              </div>
            </div>
          )}

          {/* Origin Location Input */}
          {locationStatus === 'visiting' && (
             <div className="relative animate-fade-in-up">
                <label htmlFor="originLocation" className="block text-lg font-semibold text-slate-100 mb-2">
                Where are you from?
                </label>
                <input
                  id="originLocation"
                  type="text"
                  value={originLocation}
                  onChange={handleOriginLocationChange}
                  onFocus={() => { if(originLocation.trim().length > 1) setShowOriginSuggestions(true)}}
                  placeholder="e.g., California, USA"
                  autoComplete="off"
                  className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-100 placeholder-slate-400"
                />
                {showOriginSuggestions && originLocationSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full bg-slate-600 border border-slate-500 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                        {originLocationSuggestions.map(loc => (
                            <li key={loc} onClick={() => selectOriginLocationSuggestion(loc)}
                                className="px-4 py-2 text-slate-200 hover:bg-purple-600 cursor-pointer">
                                {loc}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
          )}

          {/* Additional Info */}
          <div>
            <label htmlFor="additionalInfo" className="block text-lg font-semibold text-slate-100 mb-2">
              Anything else we should know?
            </label>
            <textarea
              id="additionalInfo"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              rows={3}
              placeholder="e.g., Looking for someone who is vegetarian, loves dogs, is into hiking..."
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-100 placeholder-slate-400"
            />
          </div>
          
          <div className="pt-2">
            <Button type="submit" variant="primary" size="large" className="w-full">
              Regenerate My Profile
            </Button>
          </div>
        </form>
      </div>
       <style>{`
          .animate-fade-in-up {
              animation: fadeInUp 0.5s ease-out forwards;
          }
          @keyframes fadeInUp {
              from {
                  opacity: 0;
                  transform: translateY(10px);
              }
              to {
                  opacity: 1;
                  transform: translateY(0);
              }
          }
          input[type=range]:not(:disabled)::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 20px;
              height: 20px;
              background: var(--thumb-color, #8b5cf6);
              cursor: pointer;
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 0 5px var(--thumb-color, #8b5cf6);
          }
          input[type=range]:not(:disabled)::-moz-range-thumb {
              width: 20px;
              height: 20px;
              background: var(--thumb-color, #8b5cf6);
              cursor: pointer;
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 0 5px var(--thumb-color, #8b5cf6);
          }
       `}</style>
    </div>
  );
};

export default RefinementModal;