import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';

interface ThinkingRowProps {
  content: string;
  isStreaming?: boolean;
}

export const ThinkingRow: React.FC<ThinkingRowProps> = ({ content, isStreaming }) => {
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  const previewLength = 120;
  const preview = content.length > previewLength
    ? content.slice(0, previewLength) + '…'
    : content;

  return (
    <div
      className="mb-2 rounded text-xs border"
      style={{
        borderColor: 'var(--vscode-editorWidget-border)',
        backgroundColor: 'var(--vscode-editorWidget-background)',
        opacity: 0.8,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left hover:opacity-100 transition-opacity"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        <Brain size={12} className="flex-shrink-0" />
        <span className="font-medium">Thinking</span>
        {isStreaming && (
          <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse ml-1"
            style={{ backgroundColor: 'var(--vscode-progressBar-background)' }} />
        )}
        {!expanded && (
          <span className="ml-1 truncate opacity-60 flex-1">{preview}</span>
        )}
        <span className="flex-shrink-0 ml-auto">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>

      {expanded && (
        <div
          className="px-2.5 pb-2.5 whitespace-pre-wrap break-words"
          style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '11px', lineHeight: '1.5' }}
        >
          {content}
        </div>
      )}
    </div>
  );
};
