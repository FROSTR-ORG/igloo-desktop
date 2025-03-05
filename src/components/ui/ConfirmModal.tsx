import React from 'react';
import { Button } from "@/components/ui/button";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  body: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  body,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-gray-900 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold text-blue-200 mb-4">{title}</h3>
        <div className="text-gray-300 mb-6 space-y-4">
          {body}
        </div>
        <div className="flex justify-end space-x-3">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-green-600 hover:bg-green-700 text-green-100"
          >
            Yes, continue
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal; 