import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ImageComparisonSliderProps {
  beforeImageUrl: string;
  afterImageUrl: string;
  altText: string;
}

const ImageComparisonSlider: React.FC<ImageComparisonSliderProps> = ({ beforeImageUrl, afterImageUrl, altText }) => {
  const [sliderPosition, setSliderPosition] = useState(98);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPosition(percent);
  }, []);

  const handleDragStart = () => {
    isDragging.current = true;
  };

  const handleDragEnd = () => {
    isDragging.current = false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleDragStart();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      handleMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      handleMove(e.touches[0].clientX);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [handleMove]);

  return (
    <div
      ref={imageContainerRef}
      className="relative w-full h-full select-none overflow-hidden"
    >
      <img
        src={beforeImageUrl}
        alt={`Before ${altText}`}
        className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none"
      />
      <div
        className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={afterImageUrl}
          alt={`After ${altText}`}
          className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none"
        />
      </div>
      <div
        className="absolute top-0 bottom-0 w-1.5 bg-white/80 cursor-ew-resize"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-md">
          <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l-4 4 4 4m8-8l4 4-4 4"></path>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default ImageComparisonSlider;