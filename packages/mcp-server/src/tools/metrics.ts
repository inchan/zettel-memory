/**
 * Basic Monitoring Metrics
 * 요청 처리, 인덱스 작업, 에러 추적을 위한 메트릭 수집
 * 향후 Prometheus 통합을 위한 기반
 */

export interface ToolMetric {
  toolName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  errorCode?: string;
}

export interface IndexQueueMetric {
  queueSize: number;
  processingCount: number;
  successCount: number;
  failureCount: number;
  timestamp: number;
}

export interface MetricsSummary {
  // Tool 실행 메트릭
  tools: {
    totalRequests: number;
    successRate: number;
    avgDuration: number;
    byTool: Record<
      string,
      {
        count: number;
        successCount: number;
        failureCount: number;
        avgDuration: number;
        p50Duration: number;
        p95Duration: number;
      }
    >;
  };

  // Index 복구 큐 메트릭
  indexQueue: {
    currentSize: number;
    totalProcessed: number;
    totalSuccess: number;
    totalFailures: number;
  };

  // 전체 시스템
  uptime: number;
  startTime: number;
}

/**
 * 메트릭 수집기
 */
export class MetricsCollector {
  private toolMetrics: ToolMetric[] = [];
  private indexQueueMetrics: IndexQueueMetric[] = [];
  private readonly startTime: number;
  private readonly maxMetricsHistory = 1000; // 최근 1000개만 유지

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Tool 실행 시작 기록
   * @returns startTime 값 (endToolExecution에 전달해야 함)
   */
  startToolExecution(toolName: string): number {
    const startTime = Date.now();
    const metric: ToolMetric = {
      toolName,
      startTime,
    };

    this.toolMetrics.push(metric);

    // 메트릭 히스토리 제한
    if (this.toolMetrics.length > this.maxMetricsHistory) {
      this.toolMetrics.shift();
    }

    return startTime;
  }

  /**
   * Tool 실행 완료 기록
   */
  endToolExecution(
    toolName: string,
    startTime: number,
    success: boolean,
    errorCode?: string
  ): void {
    const metric = this.toolMetrics.find(
      m => m.toolName === toolName && m.startTime === startTime
    );

    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.success = success;
      if (errorCode) {
        metric.errorCode = errorCode;
      }
    }
  }

  /**
   * Index 큐 상태 기록
   */
  recordIndexQueueStatus(
    queueSize: number,
    processingCount: number,
    successCount: number,
    failureCount: number
  ): void {
    const metric: IndexQueueMetric = {
      queueSize,
      processingCount,
      successCount,
      failureCount,
      timestamp: Date.now(),
    };

    this.indexQueueMetrics.push(metric);

    // 최근 100개만 유지
    if (this.indexQueueMetrics.length > 100) {
      this.indexQueueMetrics.shift();
    }
  }

  /**
   * 메트릭 요약 조회
   */
  getSummary(): MetricsSummary {
    const completedMetrics = this.toolMetrics.filter(
      m => m.duration !== undefined
    );
    const totalRequests = completedMetrics.length;
    const successfulRequests = completedMetrics.filter(
      m => m.success === true
    ).length;

    // Tool별 통계 계산
    const byTool: Record<
      string,
      {
        count: number;
        successCount: number;
        failureCount: number;
        avgDuration: number;
        p50Duration: number;
        p95Duration: number;
      }
    > = {};

    const toolNames = [...new Set(completedMetrics.map(m => m.toolName))];

    for (const toolName of toolNames) {
      const toolMetrics = completedMetrics.filter(m => m.toolName === toolName);
      const successCount = toolMetrics.filter(m => m.success === true).length;
      const durations = toolMetrics.map(m => m.duration!).sort((a, b) => a - b);

      byTool[toolName] = {
        count: toolMetrics.length,
        successCount,
        failureCount: toolMetrics.length - successCount,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        p50Duration: durations[Math.floor(durations.length * 0.5)] || 0,
        p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
      };
    }

    // Index 큐 통계
    const latestQueueMetric =
      this.indexQueueMetrics[this.indexQueueMetrics.length - 1];
    const totalSuccess = this.indexQueueMetrics.reduce(
      (sum, m) => sum + m.successCount,
      0
    );
    const totalFailures = this.indexQueueMetrics.reduce(
      (sum, m) => sum + m.failureCount,
      0
    );

    return {
      tools: {
        totalRequests,
        successRate:
          totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100,
        avgDuration:
          completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) /
            totalRequests || 0,
        byTool,
      },
      indexQueue: {
        currentSize: latestQueueMetric?.queueSize || 0,
        totalProcessed: totalSuccess + totalFailures,
        totalSuccess,
        totalFailures,
      },
      uptime: Date.now() - this.startTime,
      startTime: this.startTime,
    };
  }

  /**
   * 메트릭 초기화
   */
  reset(): void {
    this.toolMetrics = [];
    this.indexQueueMetrics = [];
  }

  /**
   * Prometheus 형식 출력 (향후 확장)
   */
  toPrometheusFormat(): string {
    const summary = this.getSummary();
    const lines: string[] = [];

    // Tool 메트릭
    lines.push('# HELP mcp_tool_requests_total Total number of tool requests');
    lines.push('# TYPE mcp_tool_requests_total counter');
    lines.push(`mcp_tool_requests_total ${summary.tools.totalRequests}`);

    lines.push(
      '# HELP mcp_tool_success_rate Success rate of tool requests (0-100)'
    );
    lines.push('# TYPE mcp_tool_success_rate gauge');
    lines.push(`mcp_tool_success_rate ${summary.tools.successRate.toFixed(2)}`);

    lines.push(
      '# HELP mcp_tool_duration_avg_ms Average tool execution duration in milliseconds'
    );
    lines.push('# TYPE mcp_tool_duration_avg_ms gauge');
    lines.push(
      `mcp_tool_duration_avg_ms ${summary.tools.avgDuration.toFixed(2)}`
    );

    // Tool별 메트릭
    for (const [toolName, stats] of Object.entries(summary.tools.byTool)) {
      lines.push(`mcp_tool_requests_total{tool="${toolName}"} ${stats.count}`);
      lines.push(
        `mcp_tool_success_total{tool="${toolName}"} ${stats.successCount}`
      );
      lines.push(
        `mcp_tool_failure_total{tool="${toolName}"} ${stats.failureCount}`
      );
      lines.push(
        `mcp_tool_duration_avg_ms{tool="${toolName}"} ${stats.avgDuration.toFixed(2)}`
      );
      lines.push(
        `mcp_tool_duration_p50_ms{tool="${toolName}"} ${stats.p50Duration.toFixed(2)}`
      );
      lines.push(
        `mcp_tool_duration_p95_ms{tool="${toolName}"} ${stats.p95Duration.toFixed(2)}`
      );
    }

    // Index 큐 메트릭
    lines.push(
      '# HELP mcp_index_queue_size Current size of index recovery queue'
    );
    lines.push('# TYPE mcp_index_queue_size gauge');
    lines.push(`mcp_index_queue_size ${summary.indexQueue.currentSize}`);

    lines.push(
      '# HELP mcp_index_queue_processed_total Total index operations processed'
    );
    lines.push('# TYPE mcp_index_queue_processed_total counter');
    lines.push(
      `mcp_index_queue_processed_total ${summary.indexQueue.totalProcessed}`
    );

    lines.push('# HELP mcp_uptime_ms Server uptime in milliseconds');
    lines.push('# TYPE mcp_uptime_ms counter');
    lines.push(`mcp_uptime_ms ${summary.uptime}`);

    return lines.join('\n');
  }
}
