import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Terminal, FileText, Search, FolderOpen, Code, HelpCircle, Flag, GitCompare, Globe, MessageSquare, PlusCircle, Monitor } from 'lucide-react';
import type { ToolCallInfo } from '../hooks/useChat';
import { postMessage } from '../utils/vscodeApi';

const TOOL_ICONS: Record<string, React.ReactNode> = {
  read_file: <FileText size={12} />,
  write_to_file: <FileText size={12} />,
  replace_in_file: <FileText size={12} />,
  apply_patch: <GitCompare size={12} />,
  execute_command: <Terminal size={12} />,
  search_files: <Search size={12} />,
  list_files: <FolderOpen size={12} />,
  list_code_definition_names: <Code size={12} />,
  ask_followup_question: <HelpCircle size={12} />,
  attempt_completion: <Flag size={12} />,
  web_fetch: <Globe size={12} />,
  condense: <Code size={12} />,
  new_rule: <FileText size={12} />,
  plan_mode_respond: <MessageSquare size={12} />,
  act_mode_respond: <MessageSquare size={12} />,
  new_task: <PlusCircle size={12} />,
  browser_action: <Monitor size={12} />,
};

function computeInlineDiff(original: string, modified: string, maxLines = 20): { type: 'add' | 'remove' | 'context'; text: string }[] {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const result: { type: 'add' | 'remove' | 'context'; text: string }[] = [];
  const maxLen = Math.max(origLines.length, modLines.length);
  let diffCount = 0;

  for (let i = 0; i < maxLen && result.length < maxLines * 3; i++) {
    const ol = i < origLines.length ? origLines[i] : undefined;
    const ml = i < modLines.length ? modLines[i] : undefined;

    if (ol === ml && ol !== undefined) {
      if (diffCount > 0 || result.length === 0) {
        result.push({ type: 'context', text: ol });
      }
    } else {
      if (ol !== undefined) { result.push({ type: 'remove', text: ol }); diffCount++; }
      if (ml !== undefined) { result.push({ type: 'add', text: ml }); diffCount++; }
    }
  }

  return result.slice(0, maxLines * 2);
}

interface ToolCallCardProps {
  toolCall: ToolCallInfo;
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall, onApprove, onReject }) => {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[toolCall.name] || <Terminal size={12} />;

  const statusIcon = (() => {
    switch (toolCall.status) {
      case 'running': return <Loader2 size={12} className="animate-spin" style={{ color: 'var(--vscode-charts-yellow)' }} />;
      case 'approved': return <CheckCircle2 size={12} style={{ color: 'var(--vscode-charts-blue)' }} />;
      case 'completed': return <CheckCircle2 size={12} style={{ color: 'var(--vscode-charts-green)' }} />;
      case 'failed': return <XCircle size={12} style={{ color: 'var(--vscode-errorForeground)' }} />;
      case 'rejected': return <XCircle size={12} style={{ color: 'var(--vscode-errorForeground)' }} />;
      case 'pending': return <Loader2 size={12} className="animate-spin opacity-50" style={{ color: 'var(--vscode-charts-blue)' }} />;
      default: return <Loader2 size={12} className="animate-spin opacity-50" />;
    }
  })();

  const paramSummary = (() => {
    const params = toolCall.parameters;
    if (params.path) return String(params.path);
    if (params.command) return String(params.command).slice(0, 60);
    if (params.question) return String(params.question).slice(0, 60);
    if (params.result) return String(params.result).slice(0, 60);
    if (params.regex) return `/${params.regex}/`;
    return '';
  })();

  return (
    <div
      className="rounded border text-xs animate-fadeIn"
      style={{
        borderColor: 'var(--vscode-panel-border, rgba(128,128,128,0.2))',
        backgroundColor: 'var(--vscode-editor-background)',
      }}
    >
      {/* Header */}
      <button
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-left hover:opacity-80 transition-opacity"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {statusIcon}
        <span className="opacity-60">{icon}</span>
        <span className="font-medium">{toolCall.name}</span>
        {paramSummary && (
          <span className="opacity-50 truncate ml-1">{paramSummary}</span>
        )}
        {toolCall.result?.diff && (
          <span className="text-[10px] opacity-60">
            <span style={{ color: 'var(--vscode-terminal-ansiGreen)' }}>+{toolCall.result.diff.addedLines}</span>
            {' / '}
            <span style={{ color: 'var(--vscode-terminal-ansiRed)' }}>-{toolCall.result.diff.removedLines}</span>
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-2 pb-2 border-t" style={{ borderColor: 'var(--vscode-panel-border, rgba(128,128,128,0.1))' }}>
          {/* Parameters */}
          <div className="mt-1.5">
            <div className="opacity-50 mb-0.5">Parameters:</div>
            <pre className="text-[10px] overflow-x-auto p-1.5 rounded" style={{ backgroundColor: 'var(--vscode-sideBar-background)' }}>
              {JSON.stringify(toolCall.parameters, null, 2)}
            </pre>
          </div>

          {/* Inline Diff */}
          {toolCall.result?.diff && (
            <div className="mt-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="opacity-50">Changes:</span>
                <button
                  onClick={() => postMessage({
                    type: 'showDiff',
                    filePath: toolCall.result!.diff!.filePath,
                    original: toolCall.result!.diff!.original,
                    modified: toolCall.result!.diff!.modified,
                  })}
                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)' }}
                >
                  <GitCompare size={10} /> Full Diff
                </button>
              </div>
              <div className="text-[10px] overflow-x-auto rounded max-h-48 overflow-y-auto font-mono" style={{ backgroundColor: 'var(--vscode-sideBar-background)' }}>
                {computeInlineDiff(toolCall.result.diff.original, toolCall.result.diff.modified).map((line, i) => (
                  <div
                    key={i}
                    className="px-1.5 leading-4"
                    style={{
                      backgroundColor: line.type === 'add'
                        ? 'rgba(0, 180, 0, 0.12)'
                        : line.type === 'remove'
                        ? 'rgba(220, 0, 0, 0.12)'
                        : 'transparent',
                      color: line.type === 'add'
                        ? 'var(--vscode-terminal-ansiGreen)'
                        : line.type === 'remove'
                        ? 'var(--vscode-terminal-ansiRed)'
                        : 'inherit',
                    }}
                  >
                    <span className="opacity-50 select-none mr-1">{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}</span>
                    {line.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {toolCall.result && (
            <div className="mt-1.5">
              <div className="opacity-50 mb-0.5">
                {toolCall.result.success ? 'Output:' : 'Error:'}
              </div>
              <pre
                className="text-[10px] overflow-x-auto p-1.5 rounded max-h-40 overflow-y-auto"
                style={{
                  backgroundColor: 'var(--vscode-sideBar-background)',
                  color: toolCall.result.success ? 'inherit' : 'var(--vscode-errorForeground)',
                }}
              >
                {toolCall.result.success ? toolCall.result.output : toolCall.result.error}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Approval buttons */}
      {toolCall.status === 'pending' && onApprove && onReject && (
        <div className="flex gap-1.5 px-2 pb-2">
          <button
            onClick={() => onApprove(toolCall.id)}
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }}
          >
            Approve
          </button>
          <button
            onClick={() => onReject(toolCall.id)}
            className="px-2 py-0.5 rounded text-xs font-medium opacity-70 hover:opacity-100"
            style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)' }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
};
