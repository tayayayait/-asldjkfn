# PHASE 6 콘텐츠 생성 및 프롬프트 관리

## 구현 범위

- `src/lib/api/prompts.ts`: 프롬프트 템플릿 목록/단건 조회, 생성, 새 버전 생성, 활성화 토글, 삭제, 변수 추출/렌더링 헬퍼.
- `src/hooks/use-prompts.ts`: 프롬프트 템플릿 React Query 훅.
- `src/routes/prompts.tsx`: mock 화면을 실제 Supabase 데이터 기반 CRUD 화면으로 교체.
- `src/lib/api/content.ts`: 콘텐츠 생성 Edge Function 호출, 생성 히스토리 조회, 편집본 저장, 검수 요청, 승인/반려, 금칙어/RAG 헬퍼.
- `src/hooks/use-content.ts`: 콘텐츠 생성/편집/검수 React Query 훅.
- `src/components/tiptap-editor.tsx`: TipTap 기반 편집기, 기본 서식 툴바, 글자 수 표시, 금칙어 하이라이트.
- `src/routes/content.tsx`: 제품 선택, 생성 옵션, 활성 프롬프트 선택, RAG 근거 패널, TipTap 편집, 히스토리 화면 연결.
- `supabase/functions/generate-content/index.ts`: 제품 정보와 `match_embeddings` RAG 검색 결과를 조합해 Gemini 텍스트 생성을 실행하고 `content_generations`에 저장.

## 주요 동작

- 프롬프트 변수는 `{{variable}}` 형식만 지원한다.
- 프롬프트 수정은 기존 행을 덮어쓰지 않고 새 버전을 생성한다.
- 활성화 시 같은 `purpose + language + channel + tone` 조합의 다른 템플릿을 비활성화한다.
- 콘텐츠 생성은 제품, 목적, 언어, 채널, 톤, 길이, 사실성 모드, 금칙어, 프롬프트 템플릿을 입력으로 받는다.
- 생성 결과의 금칙어 포함 여부는 클라이언트와 Edge Function 양쪽에서 검출한다.
- RAG 근거는 `content_generations.rag_context` JSON에 사용 청크, 유사도, 출처 정보를 저장한다.

## 외부 API

- Gemini 텍스트 생성은 `POST https://generativelanguage.googleapis.com/v1beta/interactions` 형식으로 작성했다.
- 임베딩 검색은 기존 PHASE 5의 `gemini-embedding-2` 임베딩과 `match_embeddings` RPC를 재사용한다.

## 검증 메모

- 로컬 타입 검사는 통과했다.
- 실제 Gemini 호출과 Supabase Edge Function 배포 검증은 별도 필요하다.
- DB 마이그레이션 적용은 기존 PHASE 1 제한과 동일하게 Docker/원격 적용 환경이 필요하다.
