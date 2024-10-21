import React from 'react';
import ReactDOM from 'react-dom';

const App: React.FC = () => {
  return (
    <div>
      <h1>Hello Electron with React!</h1>
      <p>This is a minimal Electron TypeScript React boilerplate.</p>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));

