import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/components/App';
import '../globals.css';

const Root: React.FC = () => {
  return (
    <div>
      <App />
      {/* <h1 className="text-3xl font-bold underline">Hello Electron with React!</h1>
      <p>This is a minimal Electron TypeScript React boilerplate.</p> */}
    </div>
  );
};

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
const root = createRoot(container);
root.render(<Root />);
