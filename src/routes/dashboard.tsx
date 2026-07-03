import { createFileRoute, Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  Image as ImageIcon,
  PackagePlus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { JOB_TYPE_LABELS, type Job } from "@/lib/api/jobs";
import { useDashboardData } from "@/hooks/use-dashboard";
import { useRetryJob } from "@/hooks/use-jobs";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "오늘 할 일 · 전통문화 RAG 어드민" }] }),
  component: DashboardPage,
});

const productStatusLabels = {
  draft: "상품 등록",
  collecting: "자료 수집 중",
  review_required: "자료 확인 필요",
  knowledge_ready: "AI 자료 준비",
  content_ready: "문구 생성 가능",
  image_ready: "이미지 준비",
  completed: "완료",
  archived: "보관",
};

type WorkflowPath = "/products" | "/sources" | "/content" | "/images";

type WorkflowStep = {
  title: string;
  description: string;
  href: WorkflowPath;
  action: string;
  count: number;
  countLabel: string;
  icon: ComponentType<{ className?: string }>;
  tone: "default" | "attention";
};

function DashboardPage() {
  const dashboard = useDashboardData();
  const retryJob = useRetryJob();
  const data = dashboard.data;
  const kpis = data?.kpis;
  const reviewTotal =
    (kpis?.sourceReviewPending ?? 0) +
    (kpis?.contentReviewPending ?? 0) +
    (kpis?.imageReviewPending ?? 0);
  const hasFailures = (kpis?.failedJobs ?? 0) > 0;

  const workflowSteps: WorkflowStep[] = [
    {
      title: "1. 상품 등록",
      description: "자사몰 상품을 가져오거나 새 상품을 등록합니다.",
      href: "/products",
      action: "상품 관리",
      count: kpis?.totalProducts ?? 0,
      countLabel: "등록 상품",
      icon: PackagePlus,
      tone: "default",
    },
    {
      title: "2. 자료 확인",
      description: "수집된 설명과 웹 자료가 맞는지 확인하고 승인합니다.",
      href: "/sources",
      action: "검수하기",
      count: kpis?.sourceReviewPending ?? 0,
      countLabel: "검수 대기",
      icon: ClipboardCheck,
      tone: (kpis?.sourceReviewPending ?? 0) > 0 ? "attention" : "default",
    },
    {
      title: "3. 문구 만들기",
      description: "상세페이지, SNS, 다국어 문구 초안을 확인합니다.",
      href: "/content",
      action: "문구 확인",
      count: kpis?.contentReviewPending ?? 0,
      countLabel: "승인 대기",
      icon: FileText,
      tone: (kpis?.contentReviewPending ?? 0) > 0 ? "attention" : "default",
    },
    {
      title: "4. 이미지 만들기",
      description: "AI가 만든 연출 이미지를 확인하고 다운로드합니다.",
      href: "/images",
      action: "이미지 확인",
      count: kpis?.imageReviewPending ?? 0,
      countLabel: "승인 대기",
      icon: ImageIcon,
      tone: (kpis?.imageReviewPending ?? 0) > 0 ? "attention" : "default",
    },
  ];

  async function handleRetry(job: Job) {
    try {
      await retryJob.mutateAsync(job.id);
      toast.success("실패 작업을 재시도 대기열에 넣었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="오늘 할 일"
        description="처음 쓰는 담당자는 아래 1번부터 4번까지만 순서대로 처리하면 됩니다."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={dashboard.isFetching}
            onClick={() => dashboard.refetch()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> 새로고침
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <Badge variant={hasFailures ? "destructive" : "secondary"}>
                {hasFailures ? "확인 필요" : "정상"}
              </Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                오늘 확인할 작업 {reviewTotal}건
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                상품을 등록하고, 자료를 승인한 뒤, AI가 만든 문구와 이미지만
                최종 확인하면 됩니다. AI 참고자료 정리는 뒤에서 자동으로
                진행됩니다.
              </p>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-3 sm:min-w-[360px]">
              <SummaryMetric label="전체 상품" value={kpis?.totalProducts ?? 0} />
              <SummaryMetric label="AI 자료 완료" value={kpis?.knowledgeReady ?? 0} />
              <SummaryMetric label="승인 대기" value={reviewTotal} />
              <SummaryMetric label="실패 작업" value={kpis?.failedJobs ?? 0} danger />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-foreground">사용 순서</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              이 네 단계가 일반 담당자가 실제로 사용하는 기본 흐름입니다.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map((step) => (
              <WorkflowCard key={step.href} step={step} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">승인 대기 목록</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <PendingColumn
                title="자료"
                href="/sources"
                items={data?.pending.sources ?? []}
                emptyText="확인할 자료 없음"
              />
              <PendingColumn
                title="문구"
                href="/content"
                items={data?.pending.contents ?? []}
                emptyText="확인할 문구 없음"
              />
              <PendingColumn
                title="이미지"
                href="/images"
                items={data?.pending.images ?? []}
                emptyText="확인할 이미지 없음"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">자동 처리 상태</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  AI 참고자료 준비
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-3xl font-semibold tabular-nums">
                    {kpis?.knowledgeReady ?? 0}
                  </span>
                  <span className="pb-1 text-sm text-muted-foreground">
                    / {kpis?.totalProducts ?? 0}개 상품
                  </span>
                </div>
              </div>

              <ProductPipeline counts={data?.productStatusCounts ?? {}} />

              <FailedJobs
                jobs={data?.failedJobs ?? []}
                isRetrying={retryJob.isPending}
                onRetry={(job) => void handleRetry(job)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          danger
            ? "mt-1 text-2xl font-semibold tabular-nums text-destructive"
            : "mt-1 text-2xl font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}

function WorkflowCard({ step }: { step: WorkflowStep }) {
  const Icon = step.icon;
  const isAttention = step.tone === "attention";

  return (
    <Link
      to={step.href}
      className={
        isAttention
          ? "group block rounded-lg border border-primary/40 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          : "group block rounded-lg border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-md bg-muted p-2 text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold leading-none tabular-nums">
            {step.count}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{step.countLabel}</div>
        </div>
      </div>
      <div className="mt-5">
        <h3 className="font-semibold text-foreground">{step.title}</h3>
        <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
          {step.description}
        </p>
      </div>
      <div className="mt-4 inline-flex items-center text-sm font-medium text-primary">
        {step.action}
        <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function PendingColumn({
  title,
  href,
  items,
  emptyText,
}: {
  title: string;
  href: WorkflowPath;
  items: Array<{
    id: string;
    product_name?: string | null;
    title?: string | null;
    created_at: string;
  }>;
  emptyText: string;
}) {
  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground">{items.length}건 대기</div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to={href}>열기</Link>
        </Button>
      </div>
      <div className="divide-y divide-border">
        {items.slice(0, 4).map((item) => (
          <div key={item.id} className="px-3 py-2.5 text-sm">
            <div className="truncate font-medium text-foreground">
              {item.title ?? item.product_name ?? item.id}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatDate(item.created_at)}
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProductPipeline({
  counts,
}: {
  counts: Partial<Record<keyof typeof productStatusLabels, number>>;
}) {
  const total = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0);
  const activeEntries = Object.entries(productStatusLabels).filter(
    ([status]) => (counts[status as keyof typeof productStatusLabels] ?? 0) > 0,
  );

  if (total === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
        아직 등록된 상품이 없습니다.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        상품 진행 상태
      </div>
      <div className="space-y-3">
        {activeEntries.map(([status, label]) => {
          const count = counts[status as keyof typeof productStatusLabels] ?? 0;
          const pct = Math.round((count / total) * 100);

          return (
            <div key={status}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {count}개 · {pct}%
                </span>
              </div>
              <Progress value={pct} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FailedJobs({
  jobs,
  isRetrying,
  onRetry,
}: {
  jobs: Job[];
  isRetrying: boolean;
  onRetry: (job: Job) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        실패 작업
      </div>
      <div className="space-y-2">
        {jobs.slice(0, 3).map((job) => (
          <div
            key={job.id}
            className="rounded-md border border-border p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {JOB_TYPE_LABELS[job.job_type]}
                  </span>
                  <StatusBadge tone="danger">실패</StatusBadge>
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {job.target_name ?? job.target_id ?? job.id}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isRetrying}
                onClick={() => onRetry(job)}
              >
                재시도
              </Button>
            </div>
            {job.last_error ? (
              <div className="mt-2 truncate text-xs text-destructive">
                {job.last_error}
              </div>
            ) : null}
          </div>
        ))}
        {jobs.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            실패 작업 없음
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
