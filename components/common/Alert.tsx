
import React from 'react';

interface AlertProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose?: () => void;
}

const Alert: React.FC<AlertProps> = ({ message, type, onClose }) => {
  const baseStyles = 'p-4 mb-4 rounded-lg shadow-md flex items-center justify-between';
  const typeStyles = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-yellow-500 text-black',
    info: 'bg-blue-600 text-white',
  };

  const Icon: React.FC<{ type: string }> = ({ type }) => {
    // Basic SVG icons, can be replaced with more sophisticated ones
    if (type === 'error') return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    if (type === 'success') return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; // Default info/warning
  }


  return (
    <div className={`${baseStyles} ${typeStyles[type]}`}>
      <div className="flex items-center">
        <Icon type={type} />
        <span>{message}</span>
      </div>
      {onClose && (
        <button onClick={onClose} className="ml-4 p-1 rounded-full hover:bg-black hover:bg-opacity-20 focus:outline-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default Alert;
    