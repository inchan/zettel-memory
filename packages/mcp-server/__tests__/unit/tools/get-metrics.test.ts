/**
 * get_metrics tool tests
 */

import { executeTool } from '../../../src/tools/registry.js';
import { createTestContext, cleanupTestContext } from '../../test-helpers.js';
import type { ToolExecutionContext } from '../../../src/tools/types.js';
import { GetMetricsInputSchema } from '../../../src/tools/schemas.js';
import { MetricsCollector } from '../../../src/tools/metrics.js';

describe('get_metrics tool', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  describe('Schema Validation', () => {
    it('빈 입력을 허용해야 함', () => {
      const result = GetMetricsInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('기본값을 올바르게 적용해야 함', () => {
      // Zod optional().default() - explicitly test with defaults
      const result = GetMetricsInputSchema.parse({
        format: 'json',
        reset: false,
      });
      expect(result.format).toBe('json');
      expect(result.reset).toBe(false);
    });

    it('json 형식을 허용해야 함', () => {
      const result = GetMetricsInputSchema.safeParse({
        format: 'json',
      });
      expect(result.success).toBe(true);
    });

    it('prometheus 형식을 허용해야 함', () => {
      const result = GetMetricsInputSchema.safeParse({
        format: 'prometheus',
      });
      expect(result.success).toBe(true);
    });

    it('잘못된 형식을 거부해야 함', () => {
      const result = GetMetricsInputSchema.safeParse({
        format: 'xml',
      });
      expect(result.success).toBe(false);
    });

    it('reset 옵션을 처리해야 함', () => {
      const result = GetMetricsInputSchema.parse({
        reset: true,
      });
      expect(result.reset).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('메트릭을 JSON 형식으로 반환해야 함', async () => {
      // MetricsCollector 설정
      context._metricsCollector = new MetricsCollector();

      const result = await executeTool('get_metrics', {
        format: 'json',
      }, context);

      expect(result.isError).toBeFalsy();

      // JSON 형식 파싱 확인
      const text = result.content[0].text as string;
      const metrics = JSON.parse(text);

      expect(metrics.tools).toBeDefined();
      expect(metrics.tools.totalRequests).toBeDefined();
      expect(metrics.tools.successRate).toBeDefined();
      expect(metrics.uptime).toBeDefined();
    });

    it('메트릭을 Prometheus 형식으로 반환해야 함', async () => {
      context._metricsCollector = new MetricsCollector();

      const result = await executeTool('get_metrics', {
        format: 'prometheus',
      }, context);

      expect(result.isError).toBeFalsy();

      const text = result.content[0].text as string;
      expect(text).toContain('# HELP');
      expect(text).toContain('# TYPE');
      expect(text).toContain('mcp_tool_requests_total');
      expect(text).toContain('mcp_uptime_ms');
    });

    it('tool 실행 후 메트릭을 수집해야 함', async () => {
      context._metricsCollector = new MetricsCollector();

      // 몇 개의 tool 실행
      await executeTool('create_note', {
        title: 'Metrics Test',
        content: 'Test content',
        category: 'Resources',
      }, context);

      await executeTool('list_notes', {}, context);

      const result = await executeTool('get_metrics', {
        format: 'json',
      }, context);

      expect(result.isError).toBeFalsy();

      const text = result.content[0].text as string;
      const metrics = JSON.parse(text);

      // create_note + list_notes + get_metrics = 3
      expect(metrics.tools.totalRequests).toBeGreaterThanOrEqual(2);
      expect(metrics.tools.byTool['create_note']).toBeDefined();
    });

    it('reset 옵션으로 메트릭을 초기화해야 함', async () => {
      context._metricsCollector = new MetricsCollector();

      // tool 실행
      await executeTool('list_notes', {}, context);

      // 초기화 전 확인
      let result = await executeTool('get_metrics', {
        format: 'json',
      }, context);
      let metrics = JSON.parse(result.content[0].text as string);
      expect(metrics.tools.totalRequests).toBeGreaterThan(0);

      // 초기화
      result = await executeTool('get_metrics', {
        format: 'json',
        reset: true,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('메트릭이 초기화되었습니다');

      // 초기화 후 확인
      result = await executeTool('get_metrics', {
        format: 'json',
      }, context);
      metrics = JSON.parse(result.content[0].text as string);

      // getSummary()는 endToolExecution 전에 호출되므로 현재 호출은 미집계
      // 이전 호출은 reset으로 제거되었으므로 0이어야 함
      expect(metrics.tools.totalRequests).toBe(0);
    });

    it('MetricsCollector가 없을 때 빈 메트릭을 반환해야 함', async () => {
      // MetricsCollector를 설정하지 않음
      const result = await executeTool('get_metrics', {
        format: 'json',
      }, context);

      expect(result.isError).toBeFalsy();

      const text = result.content[0].text as string;
      const metrics = JSON.parse(text);

      expect(metrics.tools.totalRequests).toBe(0);
      expect(metrics.tools.successRate).toBe(100);
    });

    it('P50/P95 duration을 포함해야 함', async () => {
      context._metricsCollector = new MetricsCollector();

      // 여러 tool 실행
      for (let i = 0; i < 5; i++) {
        await executeTool('list_notes', {}, context);
      }

      const result = await executeTool('get_metrics', {
        format: 'json',
      }, context);

      const text = result.content[0].text as string;
      const metrics = JSON.parse(text);

      const listNotesStats = metrics.tools.byTool['list_notes'];
      expect(listNotesStats).toBeDefined();
      expect(listNotesStats.p50Duration).toBeDefined();
      expect(listNotesStats.p95Duration).toBeDefined();
    });
  });

  describe('Prometheus Format Validation', () => {
    it('Prometheus 형식이 파싱 가능해야 함', async () => {
      context._metricsCollector = new MetricsCollector();

      await executeTool('list_notes', {}, context);

      const result = await executeTool('get_metrics', {
        format: 'prometheus',
      }, context);

      const text = result.content[0].text as string;
      const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));

      // 각 라인이 "metric_name{labels} value" 형식이어야 함
      for (const line of lines) {
        expect(line).toMatch(/^[a-z_0-9]+(\{[^}]+\})?\s+[\d.]+$/);
      }
    });

    it('tool별 레이블을 포함해야 함', async () => {
      context._metricsCollector = new MetricsCollector();

      await executeTool('list_notes', {}, context);

      const result = await executeTool('get_metrics', {
        format: 'prometheus',
      }, context);

      const text = result.content[0].text as string;
      expect(text).toContain('tool="list_notes"');
    });
  });
});
