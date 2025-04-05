import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { InputWithValidation } from "@/components/ui/input-with-validation";
import { Plus, Trash2 } from "lucide-react";
import { validateRelay } from '@/lib/validation';

interface RelayInputProps {
  relays: string[];
  onChange: (relays: string[]) => void;
  className?: string;
}

const RelayInput: React.FC<RelayInputProps> = ({
  relays,
  onChange,
  className
}) => {
  const [newRelayUrl, setNewRelayUrl] = useState("");
  const [isValidRelay, setIsValidRelay] = useState(false);
  const [relayError, setRelayError] = useState<string | undefined>(undefined);
  const [normalizedRelay, setNormalizedRelay] = useState<string | undefined>(undefined);

  const handleRelayChange = (value: string) => {
    setNewRelayUrl(value);
    const validation = validateRelay(value);
    setIsValidRelay(validation.isValid);
    setRelayError(validation.message);
    setNormalizedRelay(validation.normalized);
  };

  const handleAddRelay = () => {
    if (isValidRelay && normalizedRelay && !relays.includes(normalizedRelay)) {
      onChange([...relays, normalizedRelay]);
      setNewRelayUrl("");
      setIsValidRelay(false);
      setRelayError(undefined);
      setNormalizedRelay(undefined);
    }
  };

  const handleRemoveRelay = (urlToRemove: string) => {
    onChange(relays.filter(url => url !== urlToRemove));
  };

  // Add a default relay if the list is empty
  useEffect(() => {
    if (relays.length === 0) {
      const defaultRelay = "wss://relay.primal.net";
      onChange([defaultRelay]);
    }
  }, []);

  return (
    <div className={className}>
      <div className="space-y-2 w-full">
        <div className="flex gap-2 w-full">
          <InputWithValidation
            label="Add Relay"
            placeholder="wss://relay.example.com"
            value={newRelayUrl}
            onChange={handleRelayChange}
            isValid={isValidRelay}
            errorMessage={relayError}
            className="flex-1 w-full"
          />
          <div className="flex items-end">
            <Button
              onClick={handleAddRelay}
              disabled={!isValidRelay}
              className="bg-blue-600 hover:bg-blue-700 transition-colors duration-200 h-10"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {relays.length > 0 && (
        <div className="mt-4 space-y-2 w-full">
          <label className="text-blue-200 text-sm font-medium">Relays</label>
          <div className="space-y-2 w-full">
            {relays.map((relay, index) => (
              <div key={index} className="flex justify-between items-center bg-gray-800/30 p-2 rounded-md border border-gray-700/30 w-full">
                <span className="text-blue-300 text-sm truncate mr-2">{relay}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRelay(relay)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1 h-auto"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export { RelayInput }; 