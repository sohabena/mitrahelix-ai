import React, { useState } from 'react';
import { Play, SkipForward, Edit3, Check, X, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import type { Plan, PlanStep, AgentState } from '../hooks/useChat';

interface PlanViewProps {
  plan: Plan;
  agentState: AgentState;
  onExecute: (planId: string) => void;
  onSkipStep: (planId: string, stepId: string) => void;
  onEditStep: (planId: string, stepId: string, title: string, description: string) => void;
}

const STATUS_CONFIG: Record<PlanStep['status'], { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: 'var(--vscode-editor-foreground)', label: 'Pending' },
  in_progress: { icon: '◉', color: 'var(--vscode-charts-yellow, #cca700)', label: 'In Progress' },
  completed: { icon: '●', color: 'var(--vscode-charts-green, #388a34)', label: 'Completed' },
  skipped: { icon: '⊘', color: 'var(--vscode-disabledForeground, #888)', label: 'Skipped' },
};

function StepItem({
  step,
  index,
  planId,
  isActive,
  onSkip,
  onEdit,
}: {
  step: PlanStep;
  index: number;
  planId: string;
  isActive: boolean;
  onSkip: (planId: string, stepId: string) => void;
  onEdit: (planId: string, stepId: string, title: string, description: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(step.title);
  const [editDesc, setEditDesc] = useState(step.description);

  React.useEffect(() => {
    if (!editing) {
      setEditTitle(step.title);
      setEditDesc(step.description);
    }
  }, [step.title, step.description, editing]);

  const config = STATUS_CONFIG[step.status];

  const handleSaveEdit = () => {
    onEdit(planId, step.id, editTitle, editDesc);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(step.title);
    setEditDesc(step.description);
    setEditing(false);
  };

  return (
    <div
      className="border rounded-md mb-1.5 overflow-hidden transition-all"
      style={{
        borderColor: step.status === 'in_progress'
          ? 'var(--vscode-charts-yellow, rgba(204,167,0,0.5))'
          : 'var(--vscode-panel-border, rgba(128,128,128,0.15))',
        backgroundColor: step.status === 'in_progress'
          ? 'rgba(204,167,0,0.05)'
          : 'transparent',
      }}
    >
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs flex-shrink-0" style={{ color: config.color }}>
          {config.icon}
        </span>
        <span className="text-[10px] opacity-40 flex-shrink-0 w-4 text-right">{index + 1}</span>
        {expanded ? <ChevronDown size={10} className="opacity-40 flex-shrink-0" /> : <ChevronRight size={10} className="opacity-40 flex-shrink-0" />}
        <span
          className="text-[11px] flex-1 truncate"
          style={{
            textDecoration: step.status === 'skipped' ? 'line-through' : 'none',
            opacity: step.status === 'skipped' ? 0.5 : 1,
          }}
        >
          {step.title}
        </span>
        {!isActive && step.status === 'pending' && (
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setEditing(true)}
              className="p-0.5 rounded opacity-30 hover:opacity-70 transition-opacity"
              title="Edit step"
            >
              <Edit3 size={10} />
            </button>
            <button
              onClick={() => onSkip(planId, step.id)}
              className="p-0.5 rounded opacity-30 hover:opacity-70 transition-opacity"
              title="Skip step"
            >
              <SkipForward size={10} />
            </button>
          </div>
        )}
      </div>

      {expanded && !editing && (
        <div className="px-2.5 pb-2 pt-0">
          {step.description && (
            <p className="text-[10px] opacity-70 leading-relaxed mb-1.5 whitespace-pre-wrap">
              {step.description}
            </p>
          )}
          {step.fileReferences.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {step.fileReferences.map((file, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px]"
                  style={{
                    backgroundColor: 'var(--vscode-badge-background, rgba(0,120,212,0.2))',
                    color: 'var(--vscode-badge-foreground, inherit)',
                  }}
                >
                  <FileText size={8} />
                  {file}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="px-2.5 pb-2 pt-0 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full px-2 py-1 rounded text-[10px]"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              border: '1px solid var(--vscode-input-border, rgba(128,128,128,0.3))',
              color: 'inherit',
            }}
            placeholder="Step title"
          />
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={3}
            className="w-full px-2 py-1 rounded text-[10px] resize-y"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              border: '1px solid var(--vscode-input-border, rgba(128,128,128,0.3))',
              color: 'inherit',
            }}
            placeholder="Step description"
          />
          <div className="flex gap-1 justify-end">
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={10} /> Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px]"
              style={{
                backgroundColor: 'var(--vscode-button-background, #007acc)',
                color: 'var(--vscode-button-foreground, #fff)',
              }}
            >
              <Check size={10} /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const PlanView: React.FC<PlanViewProps> = ({
  plan,
  agentState,
  onExecute,
  onSkipStep,
  onEditStep,
}) => {
  const isActive = agentState !== 'idle';
  const completedCount = plan.steps.filter(s => s.status === 'completed').length;
  const skippedCount = plan.steps.filter(s => s.status === 'skipped').length;
  const totalActive = plan.steps.length - skippedCount;
  const progress = totalActive > 0 ? (completedCount / totalActive) * 100 : 0;
  const allDone = completedCount === totalActive && totalActive > 0;

  return (
    <div
      className="border-b"
      style={{ borderColor: 'var(--vscode-panel-border, rgba(128,128,128,0.2))' }}
    >
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">📋</span>
            <span className="text-[11px] font-semibold truncate">{plan.title}</span>
          </div>
          <span className="text-[9px] opacity-40">
            {completedCount}/{totalActive} steps
          </span>
        </div>

        {plan.summary && (
          <p className="text-[10px] opacity-60 mb-2 leading-relaxed">{plan.summary}</p>
        )}

        <div
          className="h-1 rounded-full mb-2 overflow-hidden"
          style={{ backgroundColor: 'var(--vscode-progressBar-background, rgba(128,128,128,0.15))' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              backgroundColor: allDone
                ? 'var(--vscode-charts-green, #388a34)'
                : 'var(--vscode-progressBar-background, #007acc)',
            }}
          />
        </div>

        <div className="space-y-0">
          {plan.steps.map((step, i) => (
            <StepItem
              key={step.id}
              step={step}
              index={i}
              planId={plan.id}
              isActive={isActive}
              onSkip={onSkipStep}
              onEdit={onEditStep}
            />
          ))}
        </div>

        {!allDone && (
          <button
            onClick={() => onExecute(plan.id)}
            disabled={isActive}
            className="flex items-center justify-center gap-1.5 w-full mt-2 py-1.5 rounded text-[11px] font-medium transition-opacity"
            style={{
              backgroundColor: isActive
                ? 'var(--vscode-button-secondaryBackground, #333)'
                : 'var(--vscode-button-background, #007acc)',
              color: isActive
                ? 'var(--vscode-button-secondaryForeground, #888)'
                : 'var(--vscode-button-foreground, #fff)',
              opacity: isActive ? 0.5 : 1,
              cursor: isActive ? 'not-allowed' : 'pointer',
            }}
          >
            <Play size={12} />
            Execute Plan
          </button>
        )}

        {allDone && (
          <div
            className="flex items-center justify-center gap-1.5 w-full mt-2 py-1.5 rounded text-[11px] font-medium"
            style={{ color: 'var(--vscode-charts-green, #388a34)' }}
          >
            <Check size={12} />
            Plan Complete
          </div>
        )}
      </div>
    </div>
  );
};
