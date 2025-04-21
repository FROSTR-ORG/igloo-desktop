import React from 'react';
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      maxWidth="max-w-md"
      showCloseButton={false}
    >
      <div className="space-y-6">
        <div className="text-gray-300 space-y-4">
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
    </Modal>
  );
};

export default ConfirmModal; 