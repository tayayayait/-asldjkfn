# PHASE 5: RAG 지식베이스

## 구현 범위

- `src/lib/api/knowledge.ts`
  - 청크 분할, 토큰 수 추정, pgvector RPC 입력 포맷 변환
  - 지식 청크 목록 조회
  - 제품별 지식베이스 통계 조회
  - `embed-product-story`, `search-knowledge` Edge Function 호출
- `src/hooks/use-knowledge.ts`
  - React Query 기반 청크/통계 조회
  - 재임베딩 실행
  - 유사도 검색 테스트
- `src/routes/knowledge.tsx`
  - 제품, 임베딩 상태, 본문 검색 필터
  - 청크 목록과 임베딩 상태 표시
  - 제품별/전체 재임베딩 실행
  - 유사도 검색 테스트와 낮은 유사도 결과 접기
- `supabase/functions/embed-product-story`
  - 승인 원문(`approved`, `approved_with_edit`)을 청크로 분할
  - Gemini Embedding 2로 768차원 벡터 생성
  - `story_chunks`, `story_embeddings` 저장
  - 성공 시 제품 상태를 `knowledge_ready`로 변경
- `supabase/functions/search-knowledge`
  - 검색어를 Gemini Embedding 2로 768차원 벡터화
  - `match_embeddings` RPC 호출
  - 출처/제품 정보를 붙여 검색 결과 반환

## 모델 및 벡터 기준

- 임베딩 모델: `gemini-embedding-2`
- 출력 차원: 768
- DB 컬럼: `story_embeddings.embedding extensions.vector(768)`
- 검색 경로: `public.match_embeddings(query_embedding, match_threshold, match_count, filter_product_id)`

계획서의 `text-embedding-004`는 현재 기준에서 사용하지 않는다. Gemini 공식 문서는 `gemini-embedding-2`를 최신 임베딩 모델로 안내하며, 768 차원 출력도 지원한다.

## 필요한 환경 변수

```env
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
```

기존 PHASE 4 환경 변수와 함께 Supabase Edge Function secret에 등록해야 한다.

## 검증 상태

- 청크 분할/벡터 포맷/낮은 유사도 판정은 단위 테스트로 검증했다.
- 프론트 타입 검사는 통과했다.
- 원격 Supabase 배포와 실제 Gemini 호출은 별도 운영 작업이다.

## 남은 운영 작업

- `embed-product-story`, `search-knowledge` Edge Functions 배포
- `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL` secret 등록
- 승인 원문이 있는 제품으로 실제 임베딩 실행
- `story_chunks`, `story_embeddings` 실제 insert 확인
- `/knowledge` 유사도 검색 결과 확인
