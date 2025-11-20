/**
 * Application Constants
 * 중앙화된 상수 정의 및 환경변수 지원
 */

/**
 * Ollama 설정
 */
export const OLLAMA_DEFAULTS = {
    /** Ollama 서버 기본 URL */
    BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    /** 기본 LLM 모델 (llama3.2:3b는 로컬 실행에 최적화된 경량 모델) */
    MODEL: process.env.OLLAMA_MODEL || "llama3.2:3b",
    /** Ollama API 타임아웃 (ms) */
    TIMEOUT_MS: parseInt(process.env.OLLAMA_TIMEOUT_MS || "30000", 10),
} as const;

/**
 * 인덱스 복구 큐 설정
 */
export const RECOVERY_QUEUE_DEFAULTS = {
    /** 최대 재시도 횟수 */
    MAX_RETRIES: parseInt(process.env.RECOVERY_MAX_RETRIES || "3", 10),
    /** 기본 재시도 지연 시간 (ms) */
    BASE_DELAY_MS: parseInt(process.env.RECOVERY_BASE_DELAY_MS || "1000", 10),
    /** 워커 실행 간격 (ms) */
    WORKER_INTERVAL_MS: parseInt(process.env.RECOVERY_WORKER_INTERVAL_MS || "2000", 10),
} as const;

/**
 * 노트 조직화 설정
 */
export const ORGANIZE_NOTES_DEFAULTS = {
    /** 기본 분석 노트 수 */
    DEFAULT_LIMIT: 10,
    /** 최대 분석 노트 수 */
    MAX_LIMIT: 50,
    /** 콘텐츠 미리보기 길이 (문자) */
    CONTENT_PREVIEW_LENGTH: 200,
    /** 콘텐츠 미리보기 최대 줄 수 */
    CONTENT_PREVIEW_MAX_LINES: 5,
} as const;

/**
 * 검색 설정
 */
export const SEARCH_DEFAULTS = {
    /** 기본 검색 결과 수 */
    DEFAULT_LIMIT: 10,
    /** 최대 검색 결과 수 */
    MAX_LIMIT: 100,
    /** 기본 오프셋 */
    DEFAULT_OFFSET: 0,
} as const;

/**
 * 노트 목록 설정
 */
export const LIST_NOTES_DEFAULTS = {
    /** 기본 목록 크기 */
    DEFAULT_LIMIT: 100,
    /** 최대 목록 크기 */
    MAX_LIMIT: 1000,
    /** 기본 정렬 기준 */
    DEFAULT_SORT_BY: "updated" as const,
    /** 기본 정렬 순서 */
    DEFAULT_SORT_ORDER: "desc" as const,
} as const;

/**
 * 성능 목표 (KPI)
 */
export const PERFORMANCE_TARGETS = {
    /** 검색 P95 목표 (ms) */
    SEARCH_P95_MS: 120,
    /** 증분 인덱싱 목표 (ms) */
    INCREMENTAL_INDEX_MS: 3000,
    /** 전체 인덱싱 목표 (10,000 노트 기준, ms) */
    FULL_INDEX_MS: 300000, // 5분
    /** 부팅 후 인덱스 준비 목표 (ms) */
    BOOT_INDEX_READY_MS: 8000,
} as const;

/**
 * 보안 설정
 */
export const SECURITY_DEFAULTS = {
    /** 민감정보 마스킹 정탐율 목표 (%) */
    MASKING_ACCURACY_TARGET: 95,
} as const;

/**
 * 파일 이름 설정
 */
export const FILE_NAMING = {
    /** 파일명 최대 길이 (UID 제외) */
    MAX_TITLE_LENGTH: 50,
    /** 파일 확장자 */
    EXTENSION: ".md",
} as const;

/**
 * 로깅 설정
 */
export const LOGGING_DEFAULTS = {
    /** 기본 로그 레벨 */
    DEFAULT_LEVEL: process.env.LOG_LEVEL || "info",
    /** 구조적 로그 활성화 */
    STRUCTURED: process.env.LOG_STRUCTURED === "true",
} as const;
