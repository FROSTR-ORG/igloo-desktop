import React, { useRef, useEffect, useCallback, memo, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogEntry, type LogEntryData } from "@/components/ui/log-entry";

interface EventLogProps {
  logs: LogEntryData[];
  isSignerRunning?: boolean;
  onClearLogs: () => void;
  title?: string;
  hideHeader?: boolean;
}

export const EventLog = memo(({ 
  logs, 
  isSignerRunning = false, 
  onClearLogs,
  title = "Event Log",
  hideHeader = false
}: EventLogProps) => {
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
      {!hideHeader && (
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
            <span className="text-blue-200 text-sm font-medium select-none">{title}</span>
            <StatusIndicator 
              status={getStatusIndicator()}
              count={logs.length}
            />
          </div>
          <div onClick={e => e.stopPropagation()}>
            {actions}
          </div>
        </div>
      )}
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isExpanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div 
          ref={containerRef}
          className="bg-gray-900/30 rounded border border-gray-800/30 p-3 overflow-y-auto h-[300px] scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900/30"
        >
          {logs.length > 0 ? (
            <>
              {logs.map((log) => (
                <LogEntry key={log.id} log={log} />
              ))}
              <div ref={logEndRef} />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 text-sm">No logs available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

EventLog.displayName = 'EventLog'; 