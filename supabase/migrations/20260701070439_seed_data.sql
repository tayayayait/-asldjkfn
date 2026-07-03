insert into public.products (
  sku,
  name_ko,
  name_en,
  category,
  materials,
  cultural_keywords,
  description,
  status
)
values
  (
    'KCT-001',
    '나전칠기 손거울',
    'Mother-of-pearl Hand Mirror',
    '생활소품',
    array['자개', '목재', '칠'],
    array['나전칠기', '공예', '길상문'],
    '자개 조각을 붙이고 옻칠 느낌의 표면으로 마감한 휴대용 손거울.',
    'knowledge_ready'
  ),
  (
    'KCT-002',
    '한지 무드등',
    'Hanji Mood Lamp',
    '인테리어',
    array['한지', '목재', 'LED'],
    array['한지', '전통등', '창호'],
    '한지의 섬유 질감과 은은한 확산광을 살린 소형 조명.',
    'knowledge_ready'
  ),
  (
    'KCT-003',
    '청자 찻잔 세트',
    'Celadon Teacup Set',
    '다기',
    array['도자기', '유약'],
    array['고려청자', '상감', '다례'],
    '비취색 유약과 간결한 선을 적용한 2인용 찻잔 세트.',
    'knowledge_ready'
  ),
  (
    'KCT-004',
    '민화 엽서 세트',
    'Minhwa Postcard Set',
    '문구',
    array['종이'],
    array['민화', '모란도', '책가도'],
    '민화 소재를 현대적인 색감으로 정리한 8종 엽서 세트.',
    'draft'
  ),
  (
    'KCT-005',
    '단청 북마크',
    'Dancheong Bookmark',
    '문구',
    array['금속', '에나멜'],
    array['단청', '궁궐', '오방색'],
    '단청의 반복 문양과 오방색을 적용한 금속 책갈피.',
    'draft'
  ),
  (
    'KCT-006',
    '자개 보석함',
    'Mother-of-pearl Jewelry Box',
    '생활소품',
    array['자개', '목재', '패브릭'],
    array['나전', '혼례', '길상'],
    '내부 패브릭 수납칸과 자개 장식을 조합한 소형 보석함.',
    'draft'
  ),
  (
    'KCT-007',
    '봉산탈 마그넷',
    'Bongsan Mask Magnet',
    '기념품',
    array['레진', '자석'],
    array['탈춤', '봉산탈춤', '민속'],
    '봉산탈의 표정을 간결한 부조 형태로 만든 냉장고 자석.',
    'draft'
  ),
  (
    'KCT-008',
    '전통 매듭 팔찌',
    'Traditional Knot Bracelet',
    '패션잡화',
    array['매듭끈', '금속 장식'],
    array['매듭', '장신구', '복주머니'],
    '전통 매듭 기법을 현대적인 팔찌 비율로 조정한 액세서리.',
    'draft'
  ),
  (
    'KCT-009',
    '조각보 파우치',
    'Jogakbo Pouch',
    '패션잡화',
    array['면', '폴리에스터'],
    array['조각보', '보자기', '색동'],
    '조각보의 면 분할과 색 조합을 활용한 지퍼 파우치.',
    'draft'
  ),
  (
    'KCT-010',
    '백자 향꽂이',
    'White Porcelain Incense Holder',
    '생활소품',
    array['도자기'],
    array['백자', '달항아리', '선비문화'],
    '백자의 절제된 흰색과 곡선을 참고한 미니 향꽂이.',
    'draft'
  ),
  (
    'KCT-011',
    '한글 캘리그래피 키링',
    'Hangul Calligraphy Keyring',
    '기념품',
    array['아크릴', '금속'],
    array['한글', '서예', '훈민정음'],
    '한글 자모와 붓글씨 선을 결합한 투명 아크릴 키링.',
    'draft'
  ),
  (
    'KCT-012',
    '떡살 문양 코스터',
    'Rice-cake Mold Pattern Coaster',
    '생활소품',
    array['실리콘', '코르크'],
    array['떡살', '길상문', '잔치'],
    '전통 떡살의 문양을 음각 질감으로 표현한 컵받침.',
    'draft'
  ),
  (
    'KCT-013',
    '연꽃 문양 텀블러',
    'Lotus Pattern Tumbler',
    '생활용품',
    array['스테인리스', '실리콘'],
    array['연꽃', '불교미술', '청정'],
    '연꽃 문양을 절제된 라인으로 적용한 보온 텀블러.',
    'draft'
  ),
  (
    'KCT-014',
    '궁중 문양 스카프',
    'Royal Pattern Scarf',
    '패션잡화',
    array['폴리에스터', '실크 터치 원단'],
    array['궁중복식', '보상화문', '전통문양'],
    '궁중 복식에서 볼 수 있는 장식 문양을 현대적으로 재배치한 스카프.',
    'draft'
  ),
  (
    'KCT-015',
    '전통 창호 무선 충전패드',
    'Lattice Wireless Charging Pad',
    '디지털소품',
    array['ABS', '패브릭', '전자부품'],
    array['창호', '한옥', '격자'],
    '한옥 창호 격자를 패턴으로 적용한 무선 충전 패드.',
    'draft'
  ),
  (
    'KCT-016',
    '십장생 노트',
    'Ten Symbols Notebook',
    '문구',
    array['종이', '패브릭 커버'],
    array['십장생', '장수', '민화'],
    '십장생 소재를 표지 패턴으로 구성한 양장 노트.',
    'draft'
  ),
  (
    'KCT-017',
    '전통 부채 카드',
    'Traditional Fan Card',
    '카드',
    array['종이', '리본'],
    array['부채', '합죽선', '선물'],
    '부채 형상을 접이식 카드로 재해석한 메시지 카드.',
    'draft'
  ),
  (
    'KCT-018',
    '색동 양말',
    'Saekdong Socks',
    '패션잡화',
    array['면', '폴리에스터', '스판덱스'],
    array['색동', '돌복', '오방색'],
    '색동의 띠 배열을 일상 양말에 적용한 패션 잡화.',
    'draft'
  ),
  (
    'KCT-019',
    '기와 문진',
    'Roof Tile Paperweight',
    '문구',
    array['세라믹'],
    array['기와', '한옥', '수막새'],
    '수막새와 기와 곡선을 축소한 세라믹 문진.',
    'draft'
  ),
  (
    'KCT-020',
    '전통 향낭 키트',
    'Traditional Scent Sachet Kit',
    '체험키트',
    array['패브릭', '향재', '실'],
    array['향낭', '규방공예', '단오'],
    '향낭을 직접 조립할 수 있는 체험형 기념품 키트.',
    'draft'
  )
on conflict (sku) do update
set
  name_ko = excluded.name_ko,
  name_en = excluded.name_en,
  category = excluded.category,
  materials = excluded.materials,
  cultural_keywords = excluded.cultural_keywords,
  description = excluded.description,
  status = excluded.status,
  updated_at = now();

insert into public.prompt_templates (
  purpose,
  language,
  channel,
  tone,
  template_body,
  variables,
  version,
  is_active
)
values
  (
    'product_detail',
    'ko',
    'own_mall',
    '정중한',
    '제품명: {{product_name}}
핵심 키워드: {{keywords}}
참고 자료:
{{rag_context}}

위 자료에 근거하여 제품 상세 설명을 600자 이내로 작성하세요. 참고 자료에 없는 역사적 사실은 단정하지 마세요.',
    array['product_name', 'keywords', 'rag_context'],
    1,
    true
  ),
  (
    'sns_caption',
    'ko',
    'instagram',
    '감성적',
    '제품명 {{product_name}}의 문화적 소재와 사용 장면을 바탕으로 SNS 캡션을 작성하세요.
참고 자료:
{{rag_context}}

문장은 짧게 유지하고 과장된 원산지·역사 표현은 피하세요.',
    array['product_name', 'rag_context'],
    1,
    true
  ),
  (
    'image_generation',
    'ko',
    'image',
    '고급스러운',
    '전통문화 기념품 {{product_name}}을 중심에 둔 제품 이미지를 생성하세요.
문화 키워드: {{keywords}}
콘셉트: {{concept}}
배경 톤: {{background_tone}}
유지 규칙: {{preserve_rules}}
제외 요소: {{exclude_elements}}

제품의 형태와 소재감을 왜곡하지 말고, 문자는 이미지에 넣지 마세요.',
    array[
      'product_name',
      'keywords',
      'concept',
      'background_tone',
      'preserve_rules',
      'exclude_elements'
    ],
    1,
    true
  )
on conflict (purpose, language, channel, tone, version) do update
set
  template_body = excluded.template_body,
  variables = excluded.variables,
  is_active = excluded.is_active,
  updated_at = now();
