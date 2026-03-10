import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { User, Bot, AlertCircle, Info, Copy, Check, Play, FileEdit } from 'lucide-react';
import type { ChatMessage, ToolCallInfo } from '../hooks/useChat';
import { ToolCallCard } from './ToolCallCard';
import { ThinkingRow } from './ThinkingRow';
import { postMessage } from '../utils/vscodeApi';

interface MessageBubbleProps {
  message: ChatMessage;
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, onApprove, onReject }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isAssistant = message.role === 'assistant';

  if (isSystem) {
    if (message.content.startsWith('[THINKING]\n')) {
      return (
        <div className="px-3 my-1 animate-fadeIn">
          <ThinkingRow content={message.content.replace('[THINKING]\n', '')} />
        </div>
      );
    }

    const isError = message.content.startsWith('Error:') || message.content.startsWith('Error ');
    const bgColor = isError
      ? 'var(--vscode-inputValidation-errorBackground, rgba(255,0,0,0.1))'
      : 'var(--vscode-inputValidation-infoBackground, rgba(0,120,212,0.1))';
    const fgColor = isError
      ? 'var(--vscode-errorForeground)'
      : 'var(--vscode-foreground)';
    const Icon = isError ? AlertCircle : Info;
    return (
      <div className="flex items-start gap-2 px-3 py-2 my-1 rounded bg-opacity-20 animate-fadeIn" style={{ backgroundColor: bgColor }}>
        <Icon size={14} className="mt-0.5 flex-shrink-0" style={{ color: fgColor }} />
        <span className="text-xs" style={{ color: fgColor }}>{message.content}</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2 px-3 py-2 my-1 animate-fadeIn">
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
                a: ({ href, children }) => (
                  <a
                    href={href}
                    onClick={(e) => {
                      e.preventDefault();
                      if (href) postMessage({ type: 'openUrl', url: href });
                    }}
                  >
                    {children}
                  </a>
                ),
                code: ({ children, className, node, ...props }) => {
                  const hasLang = !!className;
                  const isBlock = node?.position && node.position.start.line !== node.position.end.line;
                  if (!hasLang && !isBlock) {
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
});

function extractTextFromChildren(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractTextFromChildren).join('');
  if (typeof node === 'object' && 'props' in node) {
    return extractTextFromChildren((node as React.ReactElement).props.children);
  }
  return '';
}

const SHELL_LANGUAGES = ['bash', 'sh', 'shell', 'zsh', 'powershell', 'cmd', 'bat'];

const CodeBlockWithCopy: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => {
  const [copied, setCopied] = React.useState(false);
  const codeRef = React.useRef<HTMLElement>(null);

  const language = className?.replace(/^language-/, '') || '';
  const isShell = SHELL_LANGUAGES.includes(language);

  const getCodeText = () => {
    return (codeRef.current?.textContent ?? extractTextFromChildren(children)).replace(/\n$/, '');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCodeText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = () => {
    postMessage({ type: 'runCodeBlock', code: getCodeText(), language });
  };

  const handleApply = () => {
    postMessage({ type: 'applyCodeBlock', code: getCodeText(), language });
  };

  return (
    <div className="relative group">
      <pre className={className}>
        <code ref={codeRef}>{children}</code>
      </pre>
      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {isShell && (
          <button
            onClick={handleRun}
            className="p-1 rounded"
            style={{ backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }}
            title="Run in terminal"
          >
            <Play size={12} />
          </button>
        )}
        {!isShell && language && (
          <button
            onClick={handleApply}
            className="p-1 rounded"
            style={{ backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }}
            title="Apply to file"
          >
            <FileEdit size={12} />
          </button>
        )}
        <button
          onClick={handleCopy}
          className="p-1 rounded"
          style={{ backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }}
          title="Copy code"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
};
