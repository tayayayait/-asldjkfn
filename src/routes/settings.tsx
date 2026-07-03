import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSystemHealth } from "@/hooks/use-settings";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "설정 · 전통문화 RAG 어드민" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const health = useSystemHealth();
  const data = health.data;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="설정"
        description="외부 API 연결 상태, 파일 저장소, 운영 정책을 확인합니다."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={health.isFetching}
            onClick={() => health.refetch()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> 다시 확인
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">외부 API 연결 상태</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.checks ?? []).map((check) => {
              const ok = check.status === "connected";

              return (
                <div
                  key={check.name}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {ok ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                    ) : (
                      <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {check.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {check.detail}
                      </div>
                    </div>
                  </div>
                  <StatusBadge
                    tone={
                      check.status === "connected"
                        ? "success"
                        : check.status === "error"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {check.status === "connected"
                      ? "연결됨"
                      : check.status === "error"
                        ? "오류"
                        : "서버 설정 필요"}
                  </StatusBadge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Storage Buckets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.buckets ?? []).map((bucket) => (
              <div
                key={bucket.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <div>
                  <div className="font-mono text-xs">{bucket.name}</div>
                  <div className="text-xs text-muted-foreground">
                    public={String(bucket.public)}
                  </div>
                </div>
                <StatusBadge tone={bucket.public ? "info" : "muted"}>
                  {bucket.public ? "public" : "private"}
                </StatusBadge>
              </div>
            ))}
            {(data?.buckets ?? []).length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                표시할 bucket 정보가 없습니다.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">RAG / 생성 파라미터</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="자료 조각 길이">
              <Input value="1200자" readOnly />
            </Field>
            <Field label="자료 조각 겹침">
              <Input value="160자" readOnly />
            </Field>
            <Field label="임베딩 모델">
              <Input value="gemini-embedding-2" readOnly />
            </Field>
            <Field label="검색 topK">
              <Input value="8" readOnly />
            </Field>
            <Field label="유사도 임계값">
              <Input value="0.50" readOnly />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">운영 정책</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SwitchRow label="5회 로그인 실패 시 10분 제한" defaultChecked />
            <SwitchRow label="승인 대기 24시간 초과 알림" defaultChecked />
            <SwitchRow label="실패 작업 Slack 알림" />
            <SwitchRow label="공개 링크 다운로드 허용" />
          </CardContent>
        </Card>
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
    <div className="grid grid-cols-[1fr_180px] items-center gap-3">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SwitchRow({
  label,
  defaultChecked,
}: {
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
      <span className="text-sm">{label}</span>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
