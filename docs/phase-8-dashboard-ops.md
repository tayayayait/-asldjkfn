# PHASE 8 대시보드, 작업 큐, 사용자, 설정

## 구현 범위

- `src/lib/api/dashboard.ts`: 제품 상태, 승인 대기, 실패 작업, 감사 로그 집계.
- `src/hooks/use-dashboard.ts`: 대시보드 데이터 조회 훅.
- `src/routes/dashboard.tsx`: mock KPI/목록을 실제 Supabase 집계 기반 화면으로 교체.
- `src/lib/api/jobs.ts`: 작업 조회, 작업 통계, 재시도, 취소 API와 재시도 가능 여부 헬퍼.
- `src/hooks/use-jobs.ts`: 작업 목록/통계/재시도/취소 훅.
- `src/routes/jobs.tsx`: 실제 `jobs` 테이블 기반 필터, 진행률, 로그 모달, 재시도/취소 연결.
- `supabase/functions/retry-job/index.ts`: 실패 작업 재시도 Edge Function.
- `src/lib/api/users.ts`, `src/hooks/use-users.ts`, `src/routes/users.tsx`: `profiles` 기반 사용자 역할/활성 상태 관리.
- `src/lib/api/settings.ts`, `src/hooks/use-settings.ts`, `src/routes/settings.tsx`: Supabase DB/Storage health check와 설정 정보 표시.
- `src/lib/errors/error-handler.ts`, `src/lib/errors/toast-handler.ts`: 공통 API 오류 분류와 toast 래퍼.

## 주요 동작

- 2026-07-02 기준 대시보드는 비전문 담당자용 `오늘 할 일` 화면으로 단순화했다.
- 기본 사용 흐름은 `상품 등록 -> 자료 확인 -> 문구 만들기 -> 이미지 만들기` 네 단계로 고정했다.
- `AI 자료 상태`, `AI 지시문`, `실패 작업`은 사이드바의 `고급 기능` 그룹으로 분리해 일반 작업 흐름에서 후순위로 보이게 했다.
- 대시보드는 `products`, `source_documents`, `content_generations`, `image_generations`, `jobs`, `audit_logs`를 직접 조회한다.
- 자료, 문구, 이미지 승인 대기 건수와 실패 작업 수를 첫 화면에서 요약한다.
- 작업 큐는 `job_type`, `status` 필터를 제공하고 실패 작업만 재시도할 수 있다.
- `retry-job`은 실패 작업의 `attempt`를 증가시키고 `queued`로 되돌린다.
- `embed`/`product`, `crawl`/`source_document`처럼 원 입력 복원이 가능한 작업은 관련 Edge Function 재호출을 시도한다.
- 사용자 화면은 `profiles.role`, `profiles.is_active`를 직접 갱신한다.
- 설정 화면은 브라우저에서 안전하게 확인 가능한 Supabase DB/Storage 상태만 live check 한다.

## 제한 사항

- `generate_text`, `generate_image`, `export` 재시도는 원 요청 payload가 `jobs`에 저장되어 있지 않아 자동 재실행하지 않는다. 현재는 대기 상태 복구까지만 보장한다.
- Gemini, Naver, Firecrawl secret은 클라이언트에서 노출하면 안 되므로 설정 화면에서 직접 health check 하지 않는다.
- Deno CLI가 로컬에 없어 Edge Function 단독 타입 검사는 수행하지 못했다.
