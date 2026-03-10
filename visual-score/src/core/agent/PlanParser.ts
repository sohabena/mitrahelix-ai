import type { Plan, PlanStep } from '../../shared/MessageTypes.js';

export function parsePlanFromResponse(text: string): Plan | null {
  const planMatch = text.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!planMatch) return null;

  const planContent = planMatch[1];

  const titleMatch = planContent.match(/<plan_title>([\s\S]*?)<\/plan_title>/);
  const summaryMatch = planContent.match(/<plan_summary>([\s\S]*?)<\/plan_summary>/);

  const title = titleMatch?.[1]?.trim() || 'Implementation Plan';
  const summary = summaryMatch?.[1]?.trim() || '';

  const steps: PlanStep[] = [];
  const stepRegex = /<plan_step>([\s\S]*?)<\/plan_step>/g;
  let stepMatch;
  let stepIndex = 0;

  while ((stepMatch = stepRegex.exec(planContent)) !== null) {
    const stepContent = stepMatch[1];

    const stepTitleMatch = stepContent.match(/<step_title>([\s\S]*?)<\/step_title>/);
    const stepDescMatch = stepContent.match(/<step_description>([\s\S]*?)<\/step_description>/);
    const stepFilesMatch = stepContent.match(/<step_files>([\s\S]*?)<\/step_files>/);

    const stepTitle = stepTitleMatch?.[1]?.trim() || `Step ${stepIndex + 1}`;
    const stepDescription = stepDescMatch?.[1]?.trim() || '';
    const filesStr = stepFilesMatch?.[1]?.trim() || '';

    const fileReferences = filesStr
      ? filesStr.split(',').map(f => f.trim()).filter(Boolean)
      : [];

    steps.push({
      id: `step_${stepIndex}_${Date.now().toString(36)}`,
      title: stepTitle,
      description: stepDescription,
      status: 'pending',
      fileReferences,
    });

    stepIndex++;
  }

  if (steps.length === 0) return null;

  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    summary,
    steps,
    createdAt: Date.now(),
  };
}

export function planToMarkdown(plan: Plan): string {
  const lines: string[] = [
    `## ${plan.title}`,
    '',
    plan.summary,
    '',
  ];

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const statusIcon = step.status === 'completed' ? '[x]'
      : step.status === 'in_progress' ? '[~]'
      : step.status === 'skipped' ? '[-]'
      : '[ ]';

    lines.push(`${i + 1}. ${statusIcon} **${step.title}**`);
    if (step.description) {
      lines.push(`   ${step.description}`);
    }
    if (step.fileReferences.length > 0) {
      lines.push(`   Files: ${step.fileReferences.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
