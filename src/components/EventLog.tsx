import React, { useRef, useEffect, useCallback, memo, useState } from "react"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Badge } from "@/components/ui/badge"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Collapsible } from "@/components/ui/collapsible"
import { Trash2, ChevronRight, ChevronDown, ChevronUp, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export interface LogEntryData {
  timestamp: string;
  type: string;
  message: string;
  data?: any;
  id: string;
}

interface EventLogProps {
  logs: LogEntryData[];
  isSignerRunning: boolean;
  onClearLogs: () => void;
  hideHeader?: boolean;
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

// Separate component for log entries
const LogEntryComponent: React.FC<LogEntryProps> = memo(({ log }) => {
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
    } catch (error) {
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

LogEntryComponent.displayName = 'LogEntryComponent';

export const EventLog: React.FC<EventLogProps> = memo(({ logs, isSignerRunning, onClearLogs }) => {
  const logEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollHeight, clientHeight } = containerRef.current;
    const maxScrollTop = scrollHeight - clientHeight;
    const isScrolledNearBottom = containerRef.current.scrollTop >= maxScrollTop - 100;

    if (isScrolledNearBottom) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (isExpanded) {
      scrollToBottom();
    }
  }, [logs, isExpanded, scrollToBottom]);

  const handleClearClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClearLogs();
  }, [onClearLogs]);

  const getStatusIndicator = () => {
    if (logs.length === 0) return 'success';
    return isSignerRunning ? 'success' : 'error';
  };

  const actions = (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 italic">
        {isExpanded ? "Click to collapse" : "Click to expand"}
      </span>
      <IconButton
        variant="default"
        size="sm"
        icon={<Trash2 className="h-4 w-4" />}
        onClick={handleClearClick}
        tooltip="Clear logs"
      />
    </div>
  );

  const handleToggle = () => {
    setIsExpanded(prev => !prev);
  };

  return (
    <div className="space-y-2 mt-8 pt-6 border-t border-gray-800/30">
      <div 
        className="flex items-center justify-between bg-gray-800/50 p-2.5 rounded cursor-pointer hover:bg-gray-800/70 transition-colors"
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? 
            <ChevronUp className="h-4 w-4 text-blue-400" /> : 
            <ChevronDown className="h-4 w-4 text-blue-400" />
          }
          <span className="text-blue-200 text-sm font-medium select-none">Event Log</span>
          <StatusIndicator 
            status={getStatusIndicator()}
            count={logs.length}
          />
        </div>
        <div onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      </div>
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isExpanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div 
          ref={containerRef}
          className="bg-gray-900/70 rounded p-3 font-mono text-sm overflow-y-auto h-[300px] border border-gray-800/50 shadow-inner"
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm italic">
              No events logged yet
            </div>
          ) : (
            logs.map((log) => (
              <LogEntryComponent key={log.id} log={log} />
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {!hideHeader && hideHeader === false && (
        <Button
          onClick={handleClearClick}
          variant="ghost"
          className="text-xs text-gray-500 hover:text-gray-400 p-0 h-auto"
        >
          Clear log
        </Button>
      )}
    </div>
  );
});

EventLog.displayName = 'EventLog'; 