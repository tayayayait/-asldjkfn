import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Clipboard,
  History,
  RefreshCcw,
  Save,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TipTapEditor } from "@/components/tiptap-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTENT_STATUS_LABELS,
  FACTUALITY_MODE_LABELS,
  findForbiddenTerms,
  getContentText,
  parseForbiddenTerms,
  ragContextChunks,
  type ContentGenerationWithRelations,
  type FactualityMode,
} from "@/lib/api/content";
import {
  PROMPT_CHANNEL_LABELS,
  PROMPT_LANGUAGE_LABELS,
  PROMPT_PURPOSE_LABELS,
} from "@/lib/api/prompts";
import {
  useApproveContent,
  useContentGenerations,
  useGenerateContent,
  useRejectContent,
  useSubmitContentForReview,
  useUpdateContentText,
} from "@/hooks/use-content";
import { useProducts } from "@/hooks/use-products";
import { usePromptTemplates } from "@/hooks/use-prompts";

export const Route = createFileRoute("/content")({
  head: () => ({ meta: [{ title: "문구 만들기 · 전통문화 RAG 어드민" }] }),
  component: ContentPage,
});

const purposeOptions = ["product_detail", "sns_caption", "ad_copy", "email_card"];
const languageOptions = ["ko", "en", "ja", "zh-CN"];
const channelOptions = ["own_mall", "instagram", "blog", "newsletter", "ads"];
const toneOptions = ["정중한", "감성적", "고급스러운", "친근한", "스토리텔링"];
const lengthOptions = ["300자 내외", "600자 이내", "1000자 이내"];

function ContentPage() {
  const productsQuery = useProducts({ pageSize: 100 });
  const products = productsQuery.data?.data ?? [];
  const [productId, setProductId] = useState("");
  const [purpose, setPurpose] = useState("product_detail");
  const [language, setLanguage] = useState("ko");
  const [channel, setChannel] = useState("own_mall");
  const [tone, setTone] = useState("정중한");
  const [lengthRule, setLengthRule] = useState("600자 이내");
  const [factualityMode, setFactualityMode] =
    useState<FactualityMode>("normal");
  const [forbiddenText, setForbiddenText] = useState("최고, 완벽, 명품");
  const [promptTemplateId, setPromptTemplateId] = useState<string>("auto");
  const [selectedGeneration, setSelectedGeneration] =
    useState<ContentGenerationWithRelations | null>(null);
  const [editorText, setEditorText] = useState("");

  const promptTemplatesQuery = usePromptTemplates({
    purpose,
    language,
    channel,
    isActive: true,
  });
  const historyQuery = useContentGenerations({
    productId: productId || "all",
    pageSize: 12,
  });
  const generateContent = useGenerateContent();
  const updateContent = useUpdateContentText();
  const submitReview = useSubmitContentForReview();
  const approveContent = useApproveContent();
  const rejectContent = useRejectContent();

  const promptTemplates = promptTemplatesQuery.data ?? [];
  const history = historyQuery.data?.data ?? [];
  const forbiddenTerms = useMemo(
    () => parseForbiddenTerms(forbiddenText),
    [forbiddenText],
  );
  const forbiddenMatches = useMemo(
    () => findForbiddenTerms(editorText, forbiddenTerms),
    [editorText, forbiddenTerms],
  );
  const ragChunks = useMemo(
    () => ragContextChunks(selectedGeneration?.rag_context ?? []),
    [selectedGeneration],
  );

  useEffect(() => {
    if (!productId && products[0]) {
      setProductId(products[0].id);
    }
  }, [productId, products]);

  useEffect(() => {
    setPromptTemplateId("auto");
  }, [purpose, language, channel, tone]);

  useEffect(() => {
    if (selectedGeneration) {
      setEditorText(getContentText(selectedGeneration));
    }
  }, [selectedGeneration]);

  async function handleGenerate() {
    if (!productId) {
      toast.error("제품을 먼저 선택해야 합니다.");
      return;
    }

    try {
      const generation = await generateContent.mutateAsync({
        productId,
        purpose,
        language,
        tone,
        channel,
        lengthRule,
        factualityMode,
        forbiddenTerms,
        promptTemplateId:
          promptTemplateId !== "auto" ? promptTemplateId : undefined,
      });
      setSelectedGeneration(generation);
      setEditorText(getContentText(generation));
      toast.success("콘텐츠 초안을 생성했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSave() {
    if (!selectedGeneration) {
      return;
    }

    try {
      const updated = await updateContent.mutateAsync({
        id: selectedGeneration.id,
        text: editorText,
      });
      setSelectedGeneration(updated);
      toast.success("편집본을 저장했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSubmitReview() {
    if (!selectedGeneration) {
      return;
    }

    try {
      const updated = await submitReview.mutateAsync(selectedGeneration.id);
      setSelectedGeneration(updated);
      toast.success("검수를 요청했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleApprove() {
    if (!selectedGeneration) {
      return;
    }

    try {
      const updated = await approveContent.mutateAsync({
        id: selectedGeneration.id,
      });
      setSelectedGeneration(updated);
      toast.success("콘텐츠를 승인했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleReject() {
    if (!selectedGeneration) {
      return;
    }

    const note = window.prompt("반려 사유를 입력하세요.");

    if (!note?.trim()) {
      toast.error("반려 사유가 필요합니다.");
      return;
    }

    try {
      const updated = await rejectContent.mutateAsync({
        id: selectedGeneration.id,
        note,
      });
      setSelectedGeneration(updated);
      toast.success("콘텐츠를 반려했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleCopy() {
    if (!editorText.trim()) {
      return;
    }

    await navigator.clipboard.writeText(editorText);
    toast.success("콘텐츠를 복사했습니다.");
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="문구 만들기"
        description="상품 자료를 바탕으로 상세페이지, SNS, 다국어 문구 초안을 만듭니다."
        actions={
          <Button variant="outline" size="sm" onClick={() => historyQuery.refetch()}>
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> 새로고침
          </Button>
        }
      />

      <div className="grid flex-1 gap-4 p-6 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">생성 옵션</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="제품">
              <Select value={productId || "none"} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products.length === 0 ? (
                    <SelectItem value="none" disabled>
                      제품 없음
                    </SelectItem>
                  ) : null}
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name_ko}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="목적">
                <OptionSelect
                  value={purpose}
                  values={purposeOptions}
                  labels={PROMPT_PURPOSE_LABELS}
                  onValueChange={setPurpose}
                />
              </Field>
              <Field label="언어">
                <OptionSelect
                  value={language}
                  values={languageOptions}
                  labels={PROMPT_LANGUAGE_LABELS}
                  onValueChange={setLanguage}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="채널">
                <OptionSelect
                  value={channel}
                  values={channelOptions}
                  labels={PROMPT_CHANNEL_LABELS}
                  onValueChange={setChannel}
                />
              </Field>
              <Field label="톤">
                <OptionSelect
                  value={tone}
                  values={toneOptions}
                  onValueChange={setTone}
                />
              </Field>
            </div>

            <Field label="길이">
              <OptionSelect
                value={lengthRule}
                values={lengthOptions}
                onValueChange={setLengthRule}
              />
            </Field>

            <Field label="사실성 모드">
              <RadioGroup
                className="grid grid-cols-3 gap-2"
                value={factualityMode}
                onValueChange={(value) =>
                  setFactualityMode(value as FactualityMode)
                }
              >
                {(["strict", "normal", "creative"] as FactualityMode[]).map(
                  (mode) => (
                    <label
                      key={mode}
                      className="flex items-center justify-center gap-1.5 rounded-md border border-border px-2 py-2 text-xs"
                    >
                      <RadioGroupItem value={mode} />
                      {FACTUALITY_MODE_LABELS[mode]}
                    </label>
                  ),
                )}
              </RadioGroup>
            </Field>

            <Field label="프롬프트 템플릿">
              <Select
                value={promptTemplateId}
                onValueChange={setPromptTemplateId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">활성 템플릿 자동 선택</SelectItem>
                  {promptTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      v.{template.version} · {template.tone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="금칙어">
              <Input
                value={forbiddenText}
                onChange={(event) => setForbiddenText(event.target.value)}
                placeholder="쉼표로 구분"
              />
            </Field>

            <Button
              className="w-full"
              disabled={generateContent.isPending}
              onClick={handleGenerate}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {generateContent.isPending ? "생성 중" : "문구 생성"}
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <CardTitle className="min-w-0 truncate text-base">
                {selectedGeneration
                  ? `생성 초안 · ${selectedGeneration.id.slice(0, 8)}`
                  : "생성 초안"}
              </CardTitle>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {selectedGeneration ? (
                  <StatusBadge tone={statusTone(selectedGeneration.status)}>
                    {CONTENT_STATUS_LABELS[selectedGeneration.status]}
                  </StatusBadge>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!editorText.trim()}
                  onClick={handleCopy}
                >
                  <Clipboard className="mr-1 h-3.5 w-3.5" /> 복사
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedGeneration || updateContent.isPending}
                  onClick={handleSave}
                >
                  <Save className="mr-1 h-3.5 w-3.5" /> 저장
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedGeneration || submitReview.isPending}
                  onClick={handleSubmitReview}
                >
                  <Send className="mr-1 h-3.5 w-3.5" /> 검수 요청
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!selectedGeneration || rejectContent.isPending}
                  onClick={handleReject}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> 반려
                </Button>
                <Button
                  size="sm"
                  disabled={!selectedGeneration || approveContent.isPending}
                  onClick={handleApprove}
                >
                  <Check className="mr-1 h-3.5 w-3.5" /> 승인
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <TipTapEditor
                value={editorText}
                onChange={setEditorText}
                targetLength={targetLengthFromRule(lengthRule)}
                highlightTerms={forbiddenMatches.map((match) => match.term)}
              />
              {forbiddenMatches.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {forbiddenMatches.map((match) => (
                    <StatusBadge key={`${match.term}-${match.index}`} tone="danger">
                      {match.term} @{match.index}
                    </StatusBadge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">최근 생성 히스토리</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr className="h-9">
                      <th className="px-3 text-left font-medium">제품</th>
                      <th className="px-3 text-left font-medium">목적</th>
                      <th className="px-3 text-left font-medium">언어</th>
                      <th className="px-3 text-left font-medium">상태</th>
                      <th className="px-3 text-left font-medium">모델</th>
                      <th className="px-3 text-left font-medium">생성일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.map((generation) => (
                      <tr
                        key={generation.id}
                        className="cursor-pointer hover:bg-muted/20"
                        onClick={() => setSelectedGeneration(generation)}
                      >
                        <td className="px-3 py-2">
                          {generation.products?.name_ko ?? generation.product_id}
                        </td>
                        <td className="px-3 py-2">
                          {labelFor(PROMPT_PURPOSE_LABELS, generation.purpose)}
                        </td>
                        <td className="px-3 py-2">
                          {labelFor(PROMPT_LANGUAGE_LABELS, generation.language)}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge tone={statusTone(generation.status)}>
                            {CONTENT_STATUS_LABELS[generation.status]}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {generation.model ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {formatDate(generation.created_at)}
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-center text-sm text-muted-foreground"
                        >
                          생성 히스토리가 없습니다.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">AI가 참고한 자료</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ragChunks.length > 0 ? (
                ragChunks.map((chunk, index) => (
                  <div
                    key={`${chunk.chunk_id ?? chunk.id ?? index}`}
                    className="rounded-md border border-border p-3 text-sm"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">
                        #{index + 1} {chunk.chunk_id ?? chunk.id}
                      </span>
                      <StatusBadge tone="muted">
                        {typeof chunk.similarity === "number"
                          ? chunk.similarity.toFixed(3)
                          : "n/a"}
                      </StatusBadge>
                    </div>
                    <p className="line-clamp-4 text-xs leading-5 text-muted-foreground">
                      {chunk.content}
                    </p>
                    {chunk.source_url ? (
                      <a
                        className="mt-2 block truncate text-xs text-primary"
                        href={chunk.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {chunk.source_title || chunk.source_url}
                      </a>
                    ) : (
                      <div className="mt-2 truncate text-xs text-muted-foreground">
                        {chunk.source_title ?? "출처 정보 없음"}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  생성 결과를 선택하면 AI가 참고한 자료가 표시됩니다.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">생성 메타데이터</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <MetaRow label="모델" value={selectedGeneration?.model ?? "-"} />
              <MetaRow
                label="템플릿"
                value={
                  selectedGeneration?.prompt_templates
                    ? `v.${selectedGeneration.prompt_templates.version}`
                    : selectedGeneration?.prompt_template_id ?? "-"
                }
              />
              <MetaRow
                label="금칙어"
                value={
                  selectedGeneration?.forbidden_terms.length
                    ? selectedGeneration.forbidden_terms.join(", ")
                    : "-"
                }
              />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  토큰 사용량
                </Label>
                <pre className="max-h-28 overflow-auto rounded-md bg-muted p-2 text-xs">
                  {JSON.stringify(selectedGeneration?.token_usage ?? {}, null, 2)}
                </pre>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  사용 프롬프트
                </Label>
                <pre className="max-h-56 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
                  {selectedGeneration?.prompt_used ?? "-"}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function OptionSelect({
  value,
  values,
  labels = {},
  onValueChange,
}: {
  value: string;
  values: string[];
  labels?: Record<string, string>;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {values.map((item) => (
          <SelectItem key={item} value={item}>
            {labelFor(labels, item)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono text-xs">{value}</span>
    </div>
  );
}

function labelFor(labels: Record<string, string>, value: string) {
  return labels[value] ?? value;
}

function targetLengthFromRule(value: string) {
  const match = value.match(/\d+/);

  return match ? Number(match[0]) : undefined;
}

function statusTone(status: ContentGenerationWithRelations["status"]) {
  switch (status) {
    case "approved":
    case "exported":
      return "success";
    case "rejected":
      return "danger";
    case "review_pending":
    case "generating":
      return "warning";
    case "generated":
    case "editing":
      return "info";
    default:
      return "muted";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
