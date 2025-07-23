
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('Script loaded');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Could not find root element");
  throw new Error("Could not find root element to mount to");
}

console.log('Root element found, creating React root');

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('React root created, rendering app');
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('App rendered successfully');
} catch (error) {
  console.error('Error rendering app:', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  rootElement.innerHTML = '<div style="color: white; padding: 20px;">Error loading app: ' + errorMessage + '</div>';
}
    