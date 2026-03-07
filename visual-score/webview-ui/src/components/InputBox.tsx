import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Square, PlusCircle, Workflow } from 'lucide-react';
import type { AgentState, WorkflowInfo } from '../hooks/useChat';

interface InputBoxProps {
  onSend: (text: string) => void;
  onCancel: () => void;
  onNewTask: () => void;
  onRunWorkflow: (workflowName: string, userText: string) => void;
  agentState: AgentState;
  workflows: WorkflowInfo[];
}

export const InputBox: React.FC<InputBoxProps> = ({ onSend, onCancel, onNewTask, onRunWorkflow, agentState, workflows }) => {
  const [text, setText] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isIdle = agentState === 'idle';

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [text]);

  useEffect(() => {
    if (text.startsWith('/') && workflows.length > 0 && isIdle) {
      setShowSlashMenu(true);
      setSlashFilter(text.slice(1).toLowerCase());
    } else {
      setShowSlashMenu(false);
    }
  }, [text, workflows, isIdle]);

  const filteredWorkflows = useMemo(() => {
    if (!slashFilter) return workflows;
    return workflows.filter((w) =>
      w.name.toLowerCase().includes(slashFilter) || w.description.toLowerCase().includes(slashFilter)
    );
  }, [workflows, slashFilter]);

  const handleSend = () => {
    if (!text.trim() || !isIdle) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSelectWorkflow = (workflow: WorkflowInfo) => {
    setShowSlashMenu(false);
    const userText = text.replace(/^\/\S*\s*/, '').trim();
    onRunWorkflow(workflow.name, userText);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlashMenu && e.key === 'Escape') {
      e.preventDefault();
      setShowSlashMenu(false);
      return;
    }
    if (showSlashMenu && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (filteredWorkflows.length > 0) {
        handleSelectWorkflow(filteredWorkflows[0]);
      } else {
        setShowSlashMenu(false);
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="border-t px-2 py-2"
      style={{ borderColor: 'var(--vscode-panel-border, rgba(128,128,128,0.2))' }}
    >
      {/* Action buttons row */}
      <div className="flex items-center gap-1 mb-1.5">
        <button
          onClick={onNewTask}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] opacity-60 hover:opacity-100 transition-opacity"
          title="New Chat"
        >
          <PlusCircle size={11} />
          New
        </button>

        {!isIdle && (
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ml-auto"
            style={{ color: 'var(--vscode-errorForeground)' }}
            title="Cancel"
          >
            <Square size={10} />
            Cancel
          </button>
        )}
      </div>

      {/* Slash command workflow picker */}
      {showSlashMenu && filteredWorkflows.length > 0 && (
        <div
          className="mb-1 rounded-md border overflow-y-auto"
          style={{
            maxHeight: '150px',
            backgroundColor: 'var(--vscode-dropdown-background, var(--vscode-input-background))',
            borderColor: 'var(--vscode-dropdown-border, var(--vscode-input-border, rgba(128,128,128,0.3)))',
          }}
        >
          {filteredWorkflows.map((w) => (
            <button
              key={w.name}
              onClick={() => handleSelectWorkflow(w)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] hover:opacity-80 transition-opacity text-left"
              style={{ backgroundColor: 'transparent' }}
            >
              <Workflow size={12} className="opacity-50 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">/{w.name}</div>
                {w.description && (
                  <div className="text-[9px] opacity-50 truncate">{w.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div
        className="flex items-end gap-1.5 rounded-md border px-2 py-1.5"
        style={{
          backgroundColor: 'var(--vscode-input-background)',
          borderColor: 'var(--vscode-input-border, var(--vscode-panel-border, rgba(128,128,128,0.3)))',
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isIdle ? 'Ask MitraHelix anything...' : 'Waiting for agent...'}
          disabled={!isIdle}
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none text-sm leading-5"
          style={{
            color: 'var(--vscode-input-foreground)',
            fontFamily: 'var(--vscode-font-family)',
            minHeight: '20px',
            maxHeight: '150px',
          }}
        />
        <button
          onClick={isIdle ? handleSend : onCancel}
          disabled={isIdle && !text.trim()}
          className="flex-shrink-0 p-1 rounded transition-opacity disabled:opacity-30"
          style={{
            backgroundColor: text.trim() && isIdle ? 'var(--vscode-button-background)' : 'transparent',
            color: text.trim() && isIdle ? 'var(--vscode-button-foreground)' : 'var(--vscode-input-foreground)',
          }}
          title={isIdle ? 'Send (Enter)' : 'Cancel (Escape)'}
        >
          {isIdle ? <Send size={14} /> : <Square size={14} />}
        </button>
      </div>

      <div className="text-[9px] opacity-30 mt-1 text-center">
        Enter to send · Shift+Enter for newline · /workflow · @file, @folder, @problems
      </div>
    </div>
  );
};
