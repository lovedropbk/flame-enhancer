

import React from 'react';
import Button from './common/Button';

interface WelcomeScreenProps {
  onStart: () => void;
}

const FlameLogoLarge: React.FC = () => (
  <svg 
    className="w-full h-full"
    viewBox="0 0 24 24" 
    fill="url(#flameGradientLarge)" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="flameGradientLarge" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#f87171" /> 
        <stop offset="50%" stopColor="#ec4899" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
    </defs>
     <path 
      fillRule="evenodd" 
      clipRule="evenodd" 
      d="M12.25,2C10.23,4.34 8,6.24 8,9.5C8,12.38 10.33,14.54 12.14,16.2C12.19,16.24 12.25,16.28 12.31,16.32L12.25,2ZM13.75,2C15.77,4.34 18,6.24 18,9.5C18,11.83 16.3,13.83 14.68,15.28L13.75,2ZM12.25,17.25C11.19,18.26 10.05,19.22 9.24,20.05C11.23,21.05 13.5,21.05 15.5,20.05C14.53,19.07 13.3,18.06 12.25,17.25Z"
      transform="translate(-1, 0)"
    />
  </svg>
);


const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  return (
    <div className="text-center space-y-8 py-10">
      <div className="relative inline-block">
        <div className="absolute -inset-1.5 bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500 rounded-full blur-xl opacity-75 animate-pulse"></div>
        <div className="relative w-32 h-32 md:w-40 md:h-40 mx-auto mb-6 rounded-full shadow-2xl bg-slate-800 p-6 flex items-center justify-center">
            <FlameLogoLarge />
        </div>
      </div>
      
      <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-orange-400">
        Craft Your Perfect Profile!
      </h2>
      <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto">
        Upload your photos and answer a few questions. We'll craft a magnetic bio and select your best pictures to help you shine.
      </p>
      <div className="pt-6">
        <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
          By continuing, you confirm that you are 18 years of age or older.
        </p>
        <Button onClick={onStart} variant="primary" size="large" className="px-10 py-4 text-xl">
          Let's Get Started!
          <span className="ml-2 animate-bounce inline-block">🚀</span>
        </Button>
      </div>
    </div>
  );
};

export default WelcomeScreen;