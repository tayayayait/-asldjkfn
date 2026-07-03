import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GitBranch, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  extractPromptVariables,
  PROMPT_CHANNEL_LABELS,
  PROMPT_LANGUAGE_LABELS,
  PROMPT_PURPOSE_LABELS,
  type PromptTemplate,
} from "@/lib/api/prompts";
import {
  useCreatePromptTemplate,
  useCreatePromptTemplateVersion,
  useDeletePromptTemplate,
  usePromptTemplates,
  useTogglePromptActive,
} from "@/hooks/use-prompts";

export const Route = createFileRoute("/prompts")({
  head: () => ({ meta: [{ title: "AI 지시문 · 전통문화 RAG 어드민" }] }),
  component: PromptsPage,
});

const purposeOptions = [
  "product_detail",
  "sns_caption",
  "ad_copy",
  "email_card",
  "blog_post",
  "image_generation",
];
const languageOptions = ["ko", "en", "ja", "zh-CN"];
const channelOptions = [
  "own_mall",
  "instagram",
  "blog",
  "newsletter",
  "ads",
  "image",
];
const toneOptions = ["정중한", "감성적", "고급스러운", "친근한", "스토리텔링"];

type PromptFormState = {
  purpose: string;
  language: string;
  channel: string;
  tone: string;
  templateBody: string;
  isActive: boolean;
};

const emptyForm: PromptFormState = {
  purpose: "product_detail",
  language: "ko",
  channel: "own_mall",
  tone: "정중한",
  templateBody:
    "상품명: {{product_name}}\n문화 키워드: {{keywords}}\n참고 자료:\n{{rag_context}}\n\n위 자료만 근거로 상품 상세 문안을 작성하세요.",
  isActive: true,
};

function PromptsPage() {
  const [purpose, setPurpose] = useState<string>("all");
  const [language, setLanguage] = useState<string>("all");
  const [channel, setChannel] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(
    null,
  );
  const [form, setForm] = useState<PromptFormState>(emptyForm);

  const templatesQuery = usePromptTemplates({
    purpose,
    language,
    channel,
    search,
  });
  const createTemplate = useCreatePromptTemplate();
  const createVersion = useCreatePromptTemplateVersion();
  const toggleActive = useTogglePromptActive();
  const deleteTemplate = useDeletePromptTemplate();
  const templates = templatesQuery.data ?? [];
  const selectedTemplate =
    templates.find((template) => template.id === selectedId) ?? templates[0];
  const variables = useMemo(
    () => extractPromptVariables(form.templateBody),
    [form.templateBody],
  );

  function openCreateDialog() {
    setEditingTemplate(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openVersionDialog(template: PromptTemplate) {
    setEditingTemplate(template);
    setForm({
      purpose: template.purpose,
      language: template.language,
      channel: template.channel,
      tone: template.tone,
      templateBody: template.template_body,
      isActive: true,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      if (editingTemplate) {
        const next = await createVersion.mutateAsync({
          id: editingTemplate.id,
          input: {
            ...form,
            variables,
          },
        });
        setSelectedId(next.id);
        toast.success("새 프롬프트 버전을 저장했습니다.");
      } else {
        const created = await createTemplate.mutateAsync({
          ...form,
          variables,
        });
        setSelectedId(created.id);
        toast.success("프롬프트 템플릿을 추가했습니다.");
      }

      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleToggleActive(template: PromptTemplate) {
    try {
      await toggleActive.mutateAsync({
        id: template.id,
        isActive: !template.is_active,
      });
      toast.success(
        template.is_active
          ? "프롬프트를 비활성화했습니다."
          : "프롬프트를 활성화했습니다.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleDelete(template: PromptTemplate) {
    if (!window.confirm("이 프롬프트 템플릿을 삭제할까요?")) {
      return;
    }

    try {
      await deleteTemplate.mutateAsync(template.id);
      if (selectedId === template.id) {
        setSelectedId(null);
      }
      toast.success("프롬프트 템플릿을 삭제했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="AI 지시문"
        description="AI가 문구와 이미지를 만들 때 따르는 기본 지시문을 관리합니다."
        actions={
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> 템플릿 추가
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="프롬프트 본문, 목적, 톤 검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <FilterSelect
            value={purpose}
            onValueChange={setPurpose}
            allLabel="전체 목적"
            values={purposeOptions}
            labels={PROMPT_PURPOSE_LABELS}
          />
          <FilterSelect
            value={language}
            onValueChange={setLanguage}
            allLabel="전체 언어"
            values={languageOptions}
            labels={PROMPT_LANGUAGE_LABELS}
          />
          <FilterSelect
            value={channel}
            onValueChange={setChannel}
            allLabel="전체 채널"
            values={channelOptions}
            labels={PROMPT_CHANNEL_LABELS}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">템플릿 목록</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr className="h-9">
                      <th className="px-3 text-left font-medium">목적</th>
                      <th className="px-3 text-left font-medium">언어</th>
                      <th className="px-3 text-left font-medium">채널</th>
                      <th className="px-3 text-left font-medium">톤</th>
                      <th className="px-3 text-right font-medium">버전</th>
                      <th className="px-3 text-left font-medium">상태</th>
                      <th className="px-3 text-left font-medium">수정일</th>
                      <th className="px-3 text-right font-medium">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {templates.map((template) => (
                      <tr
                        key={template.id}
                        className={
                          selectedTemplate?.id === template.id
                            ? "bg-muted/40"
                            : "hover:bg-muted/20"
                        }
                        onClick={() => setSelectedId(template.id)}
                      >
                        <td className="px-3 py-2">
                          {labelFor(PROMPT_PURPOSE_LABELS, template.purpose)}
                        </td>
                        <td className="px-3 py-2">
                          {labelFor(PROMPT_LANGUAGE_LABELS, template.language)}
                        </td>
                        <td className="px-3 py-2">
                          {labelFor(PROMPT_CHANNEL_LABELS, template.channel)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {template.tone}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                            {template.version}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            tone={template.is_active ? "success" : "muted"}
                          >
                            {template.is_active ? "활성" : "비활성"}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {formatDate(template.updated_at)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="새 버전"
                              onClick={(event) => {
                                event.stopPropagation();
                                openVersionDialog(template);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title={template.is_active ? "비활성화" : "활성화"}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleToggleActive(template);
                              }}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              title="삭제"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDelete(template);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {templates.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-10 text-center text-sm text-muted-foreground"
                        >
                          조건에 맞는 프롬프트가 없습니다.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <CardTitle className="min-w-0 truncate text-base">
                {selectedTemplate
                  ? `${labelFor(PROMPT_PURPOSE_LABELS, selectedTemplate.purpose)} · ${selectedTemplate.language} · ${selectedTemplate.tone}`
                  : "프롬프트 미리보기"}
              </CardTitle>
              {selectedTemplate ? (
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge tone="info">v.{selectedTemplate.version}</StatusBadge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openVersionDialog(selectedTemplate)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> 새 버전
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedTemplate ? (
                <>
                  <Textarea
                    className="min-h-[420px] font-mono text-sm"
                    readOnly
                    value={selectedTemplate.template_body}
                  />
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.variables.map((variable) => (
                      <code
                        key={variable}
                        className="rounded bg-muted px-1.5 py-0.5 text-xs"
                      >
                        {`{{${variable}}}`}
                      </code>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  왼쪽 목록에서 프롬프트를 선택하세요.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "새 프롬프트 버전 저장" : "프롬프트 템플릿 추가"}
            </DialogTitle>
            <DialogDescription>
              저장 시 본문에서 {"{{variable}}"} 형식의 변수를 자동 추출합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-4">
              <FormSelect
                label="목적"
                value={form.purpose}
                values={purposeOptions}
                labels={PROMPT_PURPOSE_LABELS}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, purpose: value }))
                }
              />
              <FormSelect
                label="언어"
                value={form.language}
                values={languageOptions}
                labels={PROMPT_LANGUAGE_LABELS}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, language: value }))
                }
              />
              <FormSelect
                label="채널"
                value={form.channel}
                values={channelOptions}
                labels={PROMPT_CHANNEL_LABELS}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, channel: value }))
                }
              />
              <FormSelect
                label="톤"
                value={form.tone}
                values={toneOptions}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, tone: value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>템플릿 본문</Label>
              <Textarea
                className="min-h-[300px] font-mono text-sm"
                value={form.templateBody}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    templateBody: event.target.value,
                  }))
                }
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {variables.length > 0 ? (
                  variables.map((variable) => (
                    <code
                      key={variable}
                      className="rounded bg-muted px-1.5 py-0.5 text-xs"
                    >
                      {`{{${variable}}}`}
                    </code>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    추출된 변수가 없습니다.
                  </span>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, isActive: checked }))
                  }
                />
                활성 버전으로 지정
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={createTemplate.isPending || createVersion.isPending}
            >
              {editingTemplate ? "새 버전 저장" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({
  value,
  onValueChange,
  allLabel,
  values,
  labels = {},
}: {
  value: string;
  onValueChange: (value: string) => void;
  allLabel: string;
  values: string[];
  labels?: Record<string, string>;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {values.map((item) => (
          <SelectItem key={item} value={item}>
            {labelFor(labels, item)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FormSelect({
  label,
  value,
  values,
  labels = {},
  onValueChange,
}: {
  label: string;
  value: string;
  values: string[];
  labels?: Record<string, string>;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
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
    </div>
  );
}

function labelFor(labels: Record<string, string>, value: string) {
  return labels[value] ?? value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
