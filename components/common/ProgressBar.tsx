import React from 'react';

interface ProgressBarProps {
  percentage: number;
  currentStep: number;
  totalSteps: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ percentage, currentStep, totalSteps }) => {
  const displayPercentage = Math.min(100, Math.max(0, percentage)); // Clamp between 0 and 100

  return (
    <div className="w-full my-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-purple-300">
          Question {currentStep} of {totalSteps}
        </span>
        <span className="text-sm font-medium text-purple-300">{Math.round(displayPercentage)}%</span>
      </div>
      <div className="w-full bg-slate-600 rounded-full h-2.5">
        <div
          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${displayPercentage}%` }}
          role="progressbar"
          aria-valuenow={displayPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;