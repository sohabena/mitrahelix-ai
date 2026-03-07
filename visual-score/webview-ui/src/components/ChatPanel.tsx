import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { ApprovalDialog } from './ApprovalDialog';
import type { ChatMessage, ToolCallInfo, AgentState } from '../hooks/useChat';

interface ChatPanelProps {
  messages: ChatMessage[];
  agentState: AgentState;
  pendingApproval: ToolCallInfo | null;
  onApprove: (toolCallId: string) => void;
  onReject: (toolCallId: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  agentState,
  pendingApproval,
  onApprove,
  onReject,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingApproval]);

  const isActive = agentState !== 'idle';

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
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
    </div>
  );
};
