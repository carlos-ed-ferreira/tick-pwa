import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  path.resolve(process.cwd(), '.github/workflows/supabase-migrations.yml'),
  'utf8',
);

describe('production release workflow', () => {
  it('deploys only after migrations and refuses to deploy a superseded SHA', () => {
    const deploymentJob = workflow.slice(
      workflow.indexOf('  deploy-production:'),
      workflow.indexOf('  audit-production-migrations:'),
    );

    expect(deploymentJob).toContain('needs: migrate-production');
    expect(deploymentJob).toContain("if: github.event_name != 'schedule'");
    expect(deploymentJob).toContain('VERCEL_DEPLOY_HOOK_URL');
    expect(deploymentJob).toContain(
      'github.event.workflow_run.head_sha || github.sha',
    );
    expect(deploymentJob).toContain(
      'repos/${{ github.repository }}/commits/main',
    );
    expect(deploymentJob).toContain('curl');
    expect(deploymentJob).toContain('.job.id');
  });

  it('audits production migration drift on a schedule', () => {
    expect(workflow).toContain('schedule:');
    expect(workflow).toMatch(/cron:\s*['"]23 \* \* \* \*['"]/u);

    const auditJob = workflow.slice(
      workflow.indexOf('  audit-production-migrations:'),
      workflow.indexOf('  report-failure:'),
    );

    expect(auditJob).toContain("if: github.event_name == 'schedule'");
    expect(auditJob).toContain('make supabase-prod-migrations-check');
  });

  it('reports deployment and scheduled audit failures', () => {
    const failureJob = workflow.slice(workflow.indexOf('  report-failure:'));

    expect(failureJob).toContain('- deploy-production');
    expect(failureJob).toContain('- audit-production-migrations');
    expect(failureJob).toContain(
      "if: always() && contains(needs.*.result, 'failure')",
    );
    expect(failureJob).toContain('pipeline-failure');
  });
});
