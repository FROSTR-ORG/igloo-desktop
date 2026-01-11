import React from 'react';
import { Button } from './ui/button';
import { ArrowRight, Snowflake, ExternalLink } from 'lucide-react';

interface OnboardingWelcomeProps {
  onGetStarted: () => void;
}

export const OnboardingWelcome: React.FC<OnboardingWelcomeProps> = ({ onGetStarted }) => {
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center">
          <div className="p-3 bg-blue-600/10 rounded-xl border border-blue-600/20">
            <Snowflake className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-blue-200">
          Welcome to Igloo Desktop
        </h2>
        <p className="text-sm text-blue-300/70 max-w-sm mx-auto">
          FROSTR keyset manager and remote signer
        </p>
      </div>

      {/* About */}
      <div className="bg-gray-800/30 border border-blue-900/30 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold text-blue-200">About</h3>
        <p className="text-sm text-blue-100/80 leading-relaxed">
          Igloo Desktop is one of only two apps (along with{' '}
          <a
            href="https://www.npmjs.com/package/@frostr/igloo-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 hover:underline"
          >
            igloo-cli
          </a>
          ) that can create FROSTR keysets.
          Your private key is split into multiple shares using FROST cryptography, and signing requires
          a threshold of shares to cooperate. The full key is never stored in one place.
        </p>
      </div>

      {/* How It Works */}
      <div className="bg-gray-800/30 border border-blue-900/30 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-blue-200">How It Works</h3>
        <ol className="text-sm text-blue-100/80 leading-relaxed space-y-2 list-decimal list-inside">
          <li>Create a keyset by providing a Nostr private key (nsec) or generating a new one</li>
          <li>Choose how many shares to create and how many are needed to sign (threshold)</li>
          <li>Save shares to this device and distribute others to separate devices or apps</li>
          <li>Run signing nodes that work together to sign Nostr events</li>
        </ol>
      </div>

      {/* Getting Started */}
      <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-amber-200">Getting Started</h3>
        <div className="space-y-3 text-sm text-amber-100/80 leading-relaxed">
          <p>
            <span className="font-medium text-amber-200">New to FROSTR?</span>{' '}
            Create your first keyset to split an existing nsec or generate a new Nostr identity.
          </p>
          <p>
            <span className="font-medium text-amber-200">Have a share?</span>{' '}
            Import an existing share from another device to run as a signing node.
          </p>
        </div>
      </div>

      {/* Using Your Keyset */}
      <div className="bg-gray-800/30 border border-blue-900/30 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-blue-200">Using Your Keyset</h3>
        <p className="text-sm text-blue-100/80 leading-relaxed">
          Igloo Desktop creates keysets and runs as a signer. To sign into Nostr clients,
          you'll need one of these apps with a share loaded:
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href="https://github.com/FROSTR-ORG/frost2x"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded text-blue-300 text-xs transition-colors"
          >
            Frost2x
            <span className="text-blue-400/60">(NIP-07)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://github.com/FROSTR-ORG/igloo-server"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded text-blue-300 text-xs transition-colors"
          >
            igloo-server
            <span className="text-blue-400/60">(NIP-46)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://github.com/FROSTR-ORG/igloo-android"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded text-blue-300 text-xs transition-colors"
          >
            igloo-android
            <span className="text-blue-400/60">(NIP-55)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="pt-2">
          <a
            href="https://frostr.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition-colors"
          >
            View all FROSTR apps
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Get Started Button */}
      <Button
        onClick={onGetStarted}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
      >
        <span className="flex items-center justify-center">
          Get Started
          <ArrowRight className="ml-2 h-5 w-5" />
        </span>
      </Button>
    </div>
  );
};

export default OnboardingWelcome;
