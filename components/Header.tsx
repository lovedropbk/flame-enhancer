
import React from 'react';

const FlameLogo: React.FC = () => (
  <svg 
    className="w-10 h-10" 
    viewBox="0 0 24 24" 
    fill="url(#flameGradient)" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="flameGradient" x1="50%" y1="0%" x2="50%" y2="100%">
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


const Header: React.FC = () => {
  return (
    <header className="flex justify-end items-center gap-3 mb-8">
      <h1 className="text-2xl md:text-3xl font-bold">
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-orange-400">
          FlameEnhancer
        </span>
      </h1>
      <FlameLogo />
    </header>
  );
};

export default Header;