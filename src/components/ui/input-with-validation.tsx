import React from 'react';
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InputWithValidationProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string | React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  isValid?: boolean;
  errorMessage?: string;
  isRequired?: boolean;
}

const InputWithValidation: React.FC<InputWithValidationProps> = ({
  label,
  value,
  onChange,
  isValid,
  errorMessage,
  className,
  id,
  ...props
}) => {
  const inputId = id || Math.random().toString(36).substr(2, 9);
  const hasError = value.trim() !== '' && isValid === false;

  return (
    <div className="space-y-2 w-full">
      {label && (
        <label htmlFor={inputId} className="text-blue-200 text-sm font-medium flex">
          {label}
        </label>
      )}
      <Input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm w-full",
          hasError && "border-red-500",
          className
        )}
        {...props}
      />
      {hasError && errorMessage && (
        <p className="text-red-400 text-sm break-words">{errorMessage}</p>
      )}
    </div>
  );
};

export { InputWithValidation }; 