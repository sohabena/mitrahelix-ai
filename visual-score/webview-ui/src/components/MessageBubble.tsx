import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { User, Bot, AlertCircle, Copy, Check } from 'lucide-react';
import type { ChatMessage, ToolCallInfo } from '../hooks/useChat';
import { ToolCallCard } from './ToolCallCard';

interface MessageBubbleProps {
  message: ChatMessage;
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onApprove, onReject }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isAssistant = message.role === 'assistant';

  if (isSystem) {
    return (
      <div className="flex items-start gap-2 px-3 py-2 my-1 rounded bg-opacity-20 animate-fadeIn" style={{ backgroundColor: 'var(--vscode-inputValidation-errorBackground, rgba(255,0,0,0.1))' }}>
        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--vscode-errorForeground)' }} />
        <span className="text-xs" style={{ color: 'var(--vscode-errorForeground)' }}>{message.content}</span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 px-3 py-2 my-1 animate-fadeIn ${isUser ? '' : ''}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--vscode-button-background)' }}>
            <User size={12} style={{ color: 'var(--vscode-button-foreground)' }} />
          </div>
        ) : (
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--vscode-badge-background)' }}>
            <Bot size={12} style={{ color: 'var(--vscode-badge-foreground)' }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="text-[10px] opacity-60 mb-0.5">
          {isUser ? 'You' : 'MitraHelix'}
        </div>

        {isAssistant ? (
          <div className="markdown-body text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code: ({ children, className, ...props }) => {
                  const isInline = !className;
                  if (isInline) {
                    return <code {...props}>{children}</code>;
                  }
                  return <CodeBlockWithCopy className={className} {...props}>{children}</CodeBlockWithCopy>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse" style={{ backgroundColor: 'var(--vscode-editor-foreground)' }} />
            )}
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolCalls.map((tc: ToolCallInfo) => (
              <ToolCallCard key={tc.id} toolCall={tc} onApprove={onApprove} onReject={onReject} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CodeBlockWithCopy: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => {
  const [copied, setCopied] = React.useState(false);
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className={className}>
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }}
        title="Copy code"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
};
