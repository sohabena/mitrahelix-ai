import React from 'react';
import { ShieldAlert, CheckCircle2, XCircle, FileText, Terminal } from 'lucide-react';
import type { ToolCallInfo } from '../hooks/useChat';

interface ApprovalDialogProps {
  toolCall: ToolCallInfo;
  onApprove: (toolCallId: string) => void;
  onReject: (toolCallId: string) => void;
}

export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({ toolCall, onApprove, onReject }) => {
  const isWrite = toolCall.name === 'write_to_file' || toolCall.name === 'replace_in_file';
  const isCommand = toolCall.name === 'execute_command';

  return (
    <div
      className="mx-3 my-2 rounded-md border p-3 animate-fadeIn"
      style={{
        borderColor: 'var(--vscode-inputValidation-warningBorder, rgba(255,200,0,0.5))',
        backgroundColor: 'var(--vscode-inputValidation-warningBackground, rgba(255,200,0,0.05))',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert size={14} style={{ color: 'var(--vscode-charts-yellow)' }} />
        <span className="text-xs font-medium">Approval Required</span>
      </div>

      <div className="text-xs mb-2">
        <div className="flex items-center gap-1.5 mb-1">
          {isWrite ? <FileText size={11} /> : isCommand ? <Terminal size={11} /> : <ShieldAlert size={11} />}
          <span className="font-medium">{toolCall.name}</span>
        </div>

        {/* Show key parameter */}
        {typeof toolCall.parameters.path === 'string' && (
          <div className="opacity-70 ml-4">
            File: <code className="px-1 rounded" style={{ backgroundColor: 'var(--vscode-editor-background)' }}>
              {String(toolCall.parameters.path)}
            </code>
          </div>
        )}
        {typeof toolCall.parameters.command === 'string' && (
          <div className="mt-1 ml-4">
            <pre
              className="text-[10px] p-1.5 rounded overflow-x-auto"
              style={{ backgroundColor: 'var(--vscode-editor-background)' }}
            >
              $ {String(toolCall.parameters.command)}
            </pre>
          </div>
        )}
        {typeof toolCall.parameters.content === 'string' && (
          <div className="mt-1 ml-4">
            <pre
              className="text-[10px] p-1.5 rounded overflow-x-auto max-h-24 overflow-y-auto"
              style={{ backgroundColor: 'var(--vscode-editor-background)' }}
            >
              {String(toolCall.parameters.content).slice(0, 500)}
              {String(toolCall.parameters.content).length > 500 ? '\n...[truncated]' : ''}
            </pre>
          </div>
        )}
        {typeof toolCall.parameters.diff === 'string' && (
          <div className="mt-1 ml-4">
            <pre
              className="text-[10px] p-1.5 rounded overflow-x-auto max-h-24 overflow-y-auto"
              style={{ backgroundColor: 'var(--vscode-editor-background)' }}
            >
              {String(toolCall.parameters.diff).slice(0, 500)}
              {String(toolCall.parameters.diff).length > 500 ? '\n...[truncated]' : ''}
            </pre>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onApprove(toolCall.id)}
          className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }}
        >
          <CheckCircle2 size={12} />
          Approve
        </button>
        <button
          onClick={() => onReject(toolCall.id)}
          className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
          style={{ backgroundColor: 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.2))', color: 'var(--vscode-button-secondaryForeground)' }}
        >
          <XCircle size={12} />
          Reject
        </button>
      </div>
    </div>
  );
};
