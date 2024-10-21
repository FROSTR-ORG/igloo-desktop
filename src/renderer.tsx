import React from 'react';
import ReactDOM from 'react-dom';
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

ReactDOM.render(<Root />, document.getElementById('root'));
