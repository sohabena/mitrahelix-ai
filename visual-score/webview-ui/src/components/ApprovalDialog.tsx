import React, { useMemo } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, FileText, Terminal, Eye } from 'lucide-react';
import { postMessage } from '../utils/vscodeApi';
import type { ToolCallInfo } from '../hooks/useChat';

interface ApprovalDialogProps {
  toolCall: ToolCallInfo;
  onApprove: (toolCallId: string) => void;
  onReject: (toolCallId: string) => void;
}

function DiffPreview({ diff }: { diff: string }) {
  const blocks = useMemo(() => {
    const normalized = diff.replace(/\r\n/g, '\n');
    const parsed: Array<{ search: string; replace: string }> = [];
    const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)>>>>>>> REPLACE/g;
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      parsed.push({
        search: match[1],
        replace: match[2].endsWith('\n') ? match[2].slice(0, -1) : match[2],
      });
    }
    return parsed;
  }, [diff]);

  if (blocks.length === 0) {
    return (
      <pre
        className="text-[10px] p-1.5 rounded overflow-x-auto max-h-32 overflow-y-auto"
        style={{ backgroundColor: 'var(--vscode-editor-background)' }}
      >
        {diff.slice(0, 800)}
        {diff.length > 800 ? '\n...[truncated]' : ''}
      </pre>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
      {blocks.map((block, i) => (
        <div key={i} className="rounded overflow-hidden text-[10px]" style={{ border: '1px solid var(--vscode-panel-border)' }}>
          {block.search.split('\n').map((line, j) => (
            <div
              key={`s${j}`}
              className="px-1.5 py-0 font-mono whitespace-pre-wrap"
              style={{ backgroundColor: 'rgba(248,81,73,0.1)', color: 'var(--vscode-gitDecoration-deletedResourceForeground, #f85149)' }}
            >
              - {line}
            </div>
          ))}
          {block.replace.split('\n').map((line, j) => (
            <div
              key={`r${j}`}
              className="px-1.5 py-0 font-mono whitespace-pre-wrap"
              style={{ backgroundColor: 'rgba(63,185,80,0.1)', color: 'var(--vscode-gitDecoration-addedResourceForeground, #3fb950)' }}
            >
              + {line}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({ toolCall, onApprove, onReject }) => {
  const isWrite = toolCall.name === 'write_to_file' || toolCall.name === 'replace_in_file';
  const isCommand = toolCall.name === 'execute_command';
  const isReplace = toolCall.name === 'replace_in_file';

  const handlePreviewDiff = () => {
    const filePath = toolCall.parameters.path as string;
    if (!filePath) return;
    postMessage({ type: 'previewDiff', toolName: toolCall.name, path: filePath, content: toolCall.parameters.content, diff: toolCall.parameters.diff });
  };

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
        {typeof toolCall.parameters.content === 'string' && !isReplace && (
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
            <DiffPreview diff={String(toolCall.parameters.diff)} />
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
        {isWrite && typeof toolCall.parameters.path === 'string' && (
          <button
            onClick={handlePreviewDiff}
            className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
            style={{ backgroundColor: 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.2))', color: 'var(--vscode-button-secondaryForeground)' }}
          >
            <Eye size={12} />
            Preview
          </button>
        )}
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
