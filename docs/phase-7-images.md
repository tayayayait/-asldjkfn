# PHASE 7 이미지 생성 및 갤러리

## 구현 범위

- `src/lib/api/images.ts`: 원본 이미지 업로드, 원본 자산 조회, 이미지 생성 히스토리 조회, 생성/승인/반려/내보내기 API, signed URL 생성.
- `src/hooks/use-images.ts`: 이미지 업로드, 생성, 승인, 반려, 내보내기 React Query 훅.
- `src/components/image-upload.tsx`: 드래그 앤 드롭 업로드, 파일 형식 검증, 이미지 크기 읽기, 기존 원본 자산 선택.
- `src/components/image-gallery.tsx`: 생성 이미지 그리드, 미리보기 모달, 승인/반려/재생성/내보내기 액션.
- `src/routes/images.tsx`: mock 화면을 제품 선택, 원본 업로드, 생성 옵션, 갤러리 중심 화면으로 교체.
- `supabase/functions/generate-image/index.ts`: 제품 정보와 이미지 프롬프트를 Gemini 이미지 모델에 전달하고 결과를 `generated-images` Storage와 `image_generations`에 저장.
- `supabase/functions/resize-export-image/index.ts`: 생성 이미지를 SNS 규격으로 변환해 `approved-public-assets` public bucket에 저장.

## 주요 동작

- 원본 이미지는 `product-originals/products/{product_id}/...` 경로에 저장하고 `product_assets`에 메타데이터를 기록한다.
- 생성 이미지는 `generated-images/products/{product_id}/{generation_id}.png` 경로에 저장한다.
- 이미지 생성 프롬프트는 활성 `image_generation` 템플릿이 있으면 우선 사용하고, 없으면 기본 템플릿을 사용한다.
- 갤러리는 private Storage 경로를 직접 노출하지 않고 Supabase signed URL을 받아 표시한다.
- 내보내기는 Supabase Storage transform signed URL을 우선 사용하고, 변환 URL을 사용할 수 없으면 원본 파일 복사로 fallback한다.

## 검증 메모

- 로컬 타입 검사와 빌드 대상 코드에는 포함된다.
- 실제 Gemini 이미지 생성, Supabase Edge Function 배포, Storage transform 동작은 원격 환경에서 별도 검증이 필요하다.
- Deno CLI가 로컬에 없어 Edge Function 단독 타입 검사는 수행하지 못했다.
