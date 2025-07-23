

import React, { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  message?: string;
  progress?: number | null;
}

const loadingSubMessages = [
  "Analyzing your pictures for the best angles...",
  "Reviewing your answers for personality cues...",
  "Crafting a compelling bio that stands out...",
  "Weaving in your unique strengths and charms...",
  "Assembling your new profile preview...",
  "Just a few more seconds...",
];

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message, progress }) => {
  const showProgress = typeof progress === 'number' && progress >= 0;
  
  const [dynamicSubMessage, setDynamicSubMessage] = useState(loadingSubMessages[0]);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    let intervalId: number;
    if (showProgress) {
        setDynamicSubMessage(loadingSubMessages[0]); // Reset on show
        let currentIndex = 0;
        intervalId = window.setInterval(() => {
            setIsFading(true); // Trigger fade-out
            setTimeout(() => {
                currentIndex = (currentIndex + 1) % loadingSubMessages.length;
                setDynamicSubMessage(loadingSubMessages[currentIndex]);
                setIsFading(false); // Trigger fade-in
            }, 500); // This duration should match the transition duration
        }, 3000); // Change message every 3 seconds (2.5s visible, 0.5s fade out)
    }
    return () => {
        if(intervalId) window.clearInterval(intervalId);
    };
  }, [showProgress]);

  if (showProgress) {
    const safeProgress = Math.min(100, Math.max(0, progress!));
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (safeProgress / 100) * circumference;

    return (
      <div className="flex flex-col items-center justify-center space-y-6 my-10 p-8">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              className="text-slate-700"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="50"
              cy="50"
            />
            {/* Progress circle */}
            <circle
              className="text-purple-500"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="50"
              cy="50"
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '50% 50%',
                transition: 'stroke-dashoffset 0.1s linear' // Smooth transition for frequent updates
              }}
            />
          </svg>
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
            <span className="text-2xl font-bold text-slate-200">
              {`${Math.round(safeProgress)}%`}
            </span>
          </div>
        </div>
        <p className="text-2xl text-slate-300 font-semibold tracking-wide">{message || "Crafting your profile..."}</p>
        <div className="text-center h-10 flex items-center justify-center max-w-sm">
            <p className={`text-md text-slate-400 text-center transition-opacity duration-500 ease-in-out ${isFading ? 'opacity-0' : 'opacity-100'}`}>
                {dynamicSubMessage}
            </p>
        </div>
      </div>
    );
  }

  // Fallback to original spinner if no progress prop
  return (
    <div className="flex flex-col items-center justify-center space-y-4 my-10 p-8">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-purple-500"></div>
      <p className="text-xl text-slate-300 font-semibold">{message || "Analyzing your profile..."}</p>
      {!message && <p className="text-md text-slate-400">Working our magic! Please wait a moment.</p>}
    </div>
  );
};

export default LoadingSpinner;