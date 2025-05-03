import React from 'react';

interface AppHeaderProps {
  subtitle?: React.ReactNode;
}

export function AppHeader({ subtitle }: AppHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-center mb-8">
        <img src="./src/assets/frostr-logo-transparent.png" alt="Frostr Logo" className="w-12 h-12 mr-2" />
        <h1 className="text-4xl font-bold font-orbitron bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-cyan-300">Igloo</h1>
      </div>
      
      {subtitle && (
        <p className="mb-8 text-blue-400 text-center max-w-xl mx-auto text-sm">
          {subtitle}
        </p>
      )}
    </>
  );
} 