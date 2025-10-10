import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/components/App';
import '../globals.css';

const Root: React.FC = () => {
  return (
    <div>
      <App />
    </div>
  );
};

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
const root = createRoot(container);
root.render(<Root />);
