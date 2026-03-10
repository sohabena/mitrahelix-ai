import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MessageBubble } from './MessageBubble';
import { ApprovalDialog } from './ApprovalDialog';
import { ChevronDown } from 'lucide-react';
import type { ChatMessage, ToolCallInfo, AgentState } from '../hooks/useChat';

interface ChatPanelProps {
  messages: ChatMessage[];
  agentState: AgentState;
  pendingApproval: ToolCallInfo | null;
  followUpSuggestions: string[];
  onApprove: (toolCallId: string) => void;
  onReject: (toolCallId: string) => void;
  onSendMessage: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  agentState,
  pendingApproval,
  followUpSuggestions,
  onApprove,
  onReject,
  onSendMessage,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distFromBottom > 80);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUserScrolledUp(false);
  }, []);

  useEffect(() => {
    if (!userScrolledUp) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, pendingApproval, userScrolledUp]);

  const isActive = agentState !== 'idle';

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto relative" onScroll={handleScroll}>
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center opacity-40">
          <div className="text-3xl mb-3">⚡</div>
          <div className="text-sm font-medium mb-1">MitraHelix AI Agent</div>
          <div className="text-xs leading-relaxed">
            Ask me to read files, write code, run commands, search your project, or debug issues.
            I can see your workspace and help you build anything.
          </div>
          <div className="text-[10px] mt-3 space-y-0.5">
            <div>Try: "List the files in this project"</div>
            <div>Try: "Read package.json and explain the dependencies"</div>
            <div>Try: "Create a hello world Express server"</div>
          </div>
        </div>
      ) : (
        <div className="pb-2">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </div>
      )}

      {/* Pending approval dialog */}
      {pendingApproval && (
        <ApprovalDialog
          toolCall={pendingApproval}
          onApprove={onApprove}
          onReject={onReject}
        />
      )}

      {/* Follow-up suggestion chips */}
      {followUpSuggestions.length > 0 && agentState === 'idle' && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2">
          {followUpSuggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => onSendMessage(suggestion)}
              className="px-2.5 py-1 rounded-full text-[11px] border transition-opacity hover:opacity-80"
              style={{
                borderColor: 'var(--vscode-button-background, rgba(0,120,212,0.5))',
                color: 'var(--vscode-button-background, #007acc)',
                backgroundColor: 'transparent',
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Thinking indicator */}
      {isActive && agentState === 'thinking' && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs opacity-50">
          <div className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: 'var(--vscode-editor-foreground)', animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: 'var(--vscode-editor-foreground)', animationDelay: '200ms' }} />
            <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: 'var(--vscode-editor-foreground)', animationDelay: '400ms' }} />
          </div>
          Thinking...
        </div>
      )}

      <div ref={bottomRef} />

      {userScrolledUp && (
        <button
          onClick={scrollToBottom}
          className="sticky bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] shadow-lg transition-opacity"
          style={{
            backgroundColor: 'var(--vscode-button-background, #007acc)',
            color: 'var(--vscode-button-foreground, #fff)',
          }}
        >
          <ChevronDown size={12} />
          Scroll to bottom
        </button>
      )}
    </div>
  );
};
