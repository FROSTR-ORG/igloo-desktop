import React, { memo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LogEntryData {
  timestamp: string;
  type: string;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  id: string;
}

interface LogEntryProps {
  log: LogEntryData;
}

// Map log types to badge variants
const getLogVariant = (type: string) => {
  switch(type) {
    case 'error': return 'error';
    case 'ready': return 'success';
    case 'disconnect': return 'warning';
    case 'bifrost': return 'info';
    case 'ecdh': return 'purple';
    case 'sign': return 'orange';
    default: return 'default';
  }
};

export const LogEntry = memo(({ log }: LogEntryProps) => {
  const [isMessageExpanded, setIsMessageExpanded] = React.useState(false);
  const hasData = log.data && Object.keys(log.data).length > 0;

  const handleClick = useCallback(() => {
    if (hasData) {
      setIsMessageExpanded(prev => !prev);
    }
  }, [hasData]);

  const formattedData = React.useMemo(() => {
    if (!hasData) return null;
    try {
      return JSON.stringify(log.data, null, 2);
    } catch {
      return 'Error: Unable to format data';
    }
  }, [log.data, hasData]);

  return (
    <div className="mb-2 last:mb-0 bg-gray-800/40 p-2 rounded hover:bg-gray-800/50 transition-colors">
      <div 
        className={cn(
          "flex items-center gap-2",
          hasData && "cursor-pointer select-none"
        )}
        onClick={handleClick}
        role={hasData ? "button" : undefined}
        tabIndex={hasData ? 0 : undefined}
        onKeyDown={hasData ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        } : undefined}
      >
        {hasData ? (
          <div 
            className="text-blue-400 transition-transform duration-200 w-4 h-4 flex-shrink-0" 
            style={{ 
              transform: isMessageExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
            aria-label={isMessageExpanded ? "Collapse details" : "Expand details"}
          >
            <ChevronRight className="h-4 w-4" />
          </div>
        ) : (
          <div className="w-4 h-4 flex-shrink-0 text-gray-600/30">
            <Info className="h-4 w-4" />
          </div>
        )}
        <span className="text-gray-500 text-xs font-light">{log.timestamp}</span>
        <Badge variant={getLogVariant(log.type)}>
          {log.type.toUpperCase()}
        </Badge>
        <span className="text-gray-300">{log.message}</span>
      </div>
      {hasData && (
        <div className={cn(
          "transition-all duration-200 ease-in-out overflow-hidden",
          isMessageExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}>
          <pre className="mt-2 text-xs bg-gray-900/50 p-2 rounded overflow-x-auto text-gray-400 shadow-inner">
            {formattedData}
          </pre>
        </div>
      )}
    </div>
  );
});

LogEntry.displayName = 'LogEntry'; 