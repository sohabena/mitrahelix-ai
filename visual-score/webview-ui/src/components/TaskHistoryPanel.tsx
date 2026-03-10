import React, { useEffect, useState } from 'react';
import { History, Trash2, Download, X, Clock, DollarSign, MessageSquare, RotateCcw } from 'lucide-react';
import { postMessage, onMessage } from '../utils/vscodeApi';

interface TaskHistorySummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  provider: string;
  totalCost: number;
  messageCount: number;
  status: string;
}

interface TaskHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TaskHistoryPanel({ isOpen, onClose }: TaskHistoryPanelProps) {
  const [tasks, setTasks] = useState<TaskHistorySummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    postMessage({ type: 'requestTaskHistory' });

    const cleanup = onMessage((data: unknown) => {
      const msg = data as Record<string, unknown>;
      if (msg.type === 'taskHistory') {
        setTasks(msg.tasks as TaskHistorySummary[]);
        setLoading(false);
      }
    });

    return cleanup;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = (id: string) => {
    postMessage({ type: 'deleteTaskHistory', taskId: id });
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleExport = (id: string) => {
    postMessage({ type: 'exportTaskHistory', taskId: id, format: 'markdown' });
  };

  const handleResume = (id: string) => {
    postMessage({ type: 'resumeTask', taskId: id });
    onClose();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const statusColors: Record<string, string> = {
    completed: 'var(--vscode-terminal-ansiGreen)',
    error: 'var(--vscode-errorForeground)',
    cancelled: 'var(--vscode-disabledForeground)',
    in_progress: 'var(--vscode-terminal-ansiYellow)',
  };

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: 'var(--vscode-sideBar-background)' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--vscode-panel-border)' }}
      >
        <div className="flex items-center gap-2">
          <History size={14} />
          <span className="text-sm font-medium">Task History</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-xs opacity-60">Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-xs opacity-60 gap-2">
            <History size={24} className="opacity-30" />
            <span>No task history yet</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {tasks.map(task => (
              <div
                key={task.id}
                className="px-3 py-2.5 border-b hover:bg-[var(--vscode-list-hoverBackground)] cursor-default"
                style={{ borderColor: 'var(--vscode-panel-border)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{task.title}</div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] opacity-60">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(task.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare size={10} />
                        {task.messageCount}
                      </span>
                      {task.totalCost > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign size={10} />
                          {task.totalCost.toFixed(4)}
                        </span>
                      )}
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ background: statusColors[task.status] || 'var(--vscode-disabledForeground)' }}
                      />
                    </div>
                    <div className="mt-0.5 text-[10px] opacity-40">{task.model}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleResume(task.id)}
                      className="p-1 rounded opacity-40 hover:opacity-100 hover:bg-[var(--vscode-toolbar-hoverBackground)]"
                      title="Resume task"
                    >
                      <RotateCcw size={12} />
                    </button>
                    <button
                      onClick={() => handleExport(task.id)}
                      className="p-1 rounded opacity-40 hover:opacity-100 hover:bg-[var(--vscode-toolbar-hoverBackground)]"
                      title="Export"
                    >
                      <Download size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-1 rounded opacity-40 hover:opacity-100 hover:bg-[var(--vscode-toolbar-hoverBackground)]"
                      title="Delete"
                      style={{ color: 'var(--vscode-errorForeground)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
