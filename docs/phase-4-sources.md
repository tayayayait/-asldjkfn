# PHASE 4: 원문 수집/검수

## 구현 범위

- `src/lib/api/sources.ts`
  - 원문 목록/상세 조회
  - URL 정규화 및 Naver `<b>` 강조 태그 제거
  - 수동 원문 추가
  - 승인, 수정 승인, 반려, 중복 처리 및 `review_events` 기록
  - `search-sources`, `crawl-source` Edge Function 호출
- `src/hooks/use-sources.ts`
  - React Query 기반 원문 조회/검수/수집 훅
- `src/routes/sources.tsx`
  - 제품, 상태, 출처, 검색어 필터
  - 원문 상세 검수 화면
  - 본문 수집 실행
  - 수동 원문 등록
- `src/components/collection-job-modal.tsx`
  - 선택 제품 또는 전체 활성 제품 대상 수집 작업 생성
  - 출처 유형, URL 수, 추가 검색어 설정
- `supabase/functions/search-sources`
  - 제품별 자사몰 URL 및 Naver 검색 결과를 `source_documents`에 등록
  - URL 중복 정규화 후 중복 등록 방지
  - URL별 `crawl` 작업을 `jobs`에 등록
- `supabase/functions/crawl-source`
  - Firecrawl `v2/scrape`로 URL 본문을 Markdown으로 수집
  - 수집 후 `extract-source-metadata` 호출
- `supabase/functions/extract-source-metadata`
  - Gemini Interactions API로 요약, 문화 키워드, 소재, 시대, 기법, 주의사항, 신뢰도 추출
  - 완료 시 `review_pending` 상태로 전환

## 외부 API 기준

- Naver 검색 API
  - 웹문서: `https://openapi.naver.com/v1/search/webkr.json`
  - 블로그: `https://openapi.naver.com/v1/search/blog.json`
  - 뉴스: `https://openapi.naver.com/v1/search/news.json`
  - 인증 헤더: `X-Naver-Client-Id`, `X-Naver-Client-Secret`
- Firecrawl
  - `POST https://api.firecrawl.dev/v2/scrape`
  - `formats: ["markdown"]`, `onlyMainContent: true`
  - 응답의 원문 페이지 HTTP 상태(`metadata.statusCode`)가 400 이상이거나 Markdown이 404 오류 페이지로 판단되면 본문으로 저장하지 않는다.
- Gemini
  - `POST https://generativelanguage.googleapis.com/v1beta/interactions`
  - 기본 모델: `gemini-3.5-flash`
  - REST Interactions 응답은 SDK 편의 속성 `output_text`가 없을 수 있으므로 `steps`의 마지막 `model_output` 텍스트를 우선 읽고, `output_text`와 `candidates`는 호환용 fallback으로 처리한다.

## 필요한 환경 변수

`.env.local` 및 Supabase Edge Function secret에 다음 값이 필요하다.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
FIRECRAWL_API_KEY=
```

## 남은 운영 작업

- 원격 Supabase 프로젝트에 migrations 적용 여부 확인
- Edge Functions 배포
- Supabase secrets 등록
- 실제 Naver/Firecrawl/Gemini 호출 테스트
- 장기적으로 `jobs` 큐를 자동 처리하는 스케줄러 또는 워커 추가

## 크롤링 실패 처리

- `crawl-source`는 DNS 해석 실패, 빈 `source_url`, 잘못된 URL, 대상 페이지 HTTP 오류, 404 오류 페이지 Markdown처럼 수집 대상 자체가 실패한 경우 `source_documents.status`를 `parse_failed`로 저장하고 실패 메시지를 `review_note`에 기록한다.
- `extract-source-metadata`는 Gemini 응답에서 텍스트를 찾지 못하거나 JSON 객체를 파싱할 수 없을 때 `source_documents.status`를 `parse_failed`로 저장하고 원인 메시지를 `review_note`에 기록한다.
- 재수집 또는 메타데이터 재추출이 성공하면 이전 실패 원인이 남지 않도록 `review_note`를 비운다.
- 위 실패는 서버 설정 오류가 아니므로 HTTP 200과 `ok:false` 본문으로 반환한다. 브라우저 DevTools의 실패 리소스 로그를 피하기 위한 정책이다.
- 클라이언트는 Supabase Edge Function 응답 본문의 `ok:false`와 `error`를 읽어 toast로 표시하고, 실패 시에도 자료/작업 목록을 갱신한다.
