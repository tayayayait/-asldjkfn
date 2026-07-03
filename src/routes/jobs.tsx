import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canRetryJob,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  type Job,
  type JobStatus,
  type JobType,
} from "@/lib/api/jobs";
import { useCancelJob, useJobs, useJobStats, useRetryJob } from "@/hooks/use-jobs";

export const Route = createFileRoute("/jobs")({
  head: () => ({ meta: [{ title: "실패 작업 · 전통문화 RAG 어드민" }] }),
  component: JobsPage,
});

function JobsPage() {
  const [jobType, setJobType] = useState<JobType | "all">("all");
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const jobsQuery = useJobs({ jobType, status, pageSize: 50 });
  const statsQuery = useJobStats();
  const retryJob = useRetryJob();
  const cancelJob = useCancelJob();
  const jobs = jobsQuery.data?.data ?? [];
  const stats = statsQuery.data;

  async function handleRetry(job: Job) {
    try {
      await retryJob.mutateAsync(job.id);
      toast.success("작업을 재시도했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleCancel(job: Job) {
    try {
      await cancelJob.mutateAsync(job.id);
      toast.success("작업을 취소했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="실패 작업"
        description="자동 수집, 자료 준비, 문구, 이미지 작업의 실패 원인을 확인하고 재시도합니다."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={jobsQuery.isFetching}
            onClick={() => jobsQuery.refetch()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> 새로고침
          </Button>
        }
      />

      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {(Object.keys(JOB_TYPE_LABELS) as JobType[]).map((type) => {
            const item = stats?.get(type);

            return (
              <Card key={type}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">
                    {JOB_TYPE_LABELS[type]}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold tabular-nums">
                      {(item?.running ?? 0) + (item?.retrying ?? 0)}
                    </span>
                    <span className="text-xs text-muted-foreground">실행 중</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <StatusBadge tone="warning">대기 {item?.queued ?? 0}</StatusBadge>
                    <StatusBadge tone="danger">실패 {item?.failed ?? 0}</StatusBadge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base">작업 목록</CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={jobType}
                onValueChange={(value) => setJobType(value as JobType | "all")}
              >
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 유형</SelectItem>
                  {Object.entries(JOB_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as JobStatus | "all")}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  {Object.entries(JOB_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr className="h-9">
                    <th className="px-3 text-left font-medium">Job ID</th>
                    <th className="px-3 text-left font-medium">유형</th>
                    <th className="px-3 text-left font-medium">대상</th>
                    <th className="px-3 text-left font-medium">상태</th>
                    <th className="px-3 text-left font-medium">진행률</th>
                    <th className="px-3 text-left font-medium">시도</th>
                    <th className="px-3 text-left font-medium">생성일</th>
                    <th className="px-3 text-right font-medium">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="h-11 hover:bg-muted/20"
                      onDoubleClick={() => setSelectedJob(job)}
                    >
                      <td className="px-3 font-mono text-xs">
                        {job.id.slice(0, 8)}
                      </td>
                      <td className="px-3">
                        <StatusBadge tone="muted">
                          {JOB_TYPE_LABELS[job.job_type]}
                        </StatusBadge>
                      </td>
                      <td className="max-w-[320px] truncate px-3">
                        {job.target_name ?? job.target_id ?? "-"}
                      </td>
                      <td className="px-3">
                        <StatusBadge tone={statusTone(job.status)}>
                          {JOB_STATUS_LABELS[job.status]}
                        </StatusBadge>
                      </td>
                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <Progress value={job.progress ?? 0} className="h-1.5 w-24" />
                          <span className="tabular-nums text-xs text-muted-foreground">
                            {job.progress ?? 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 text-xs text-muted-foreground">
                        {job.attempt ?? 0}/{job.max_attempts ?? 3}
                      </td>
                      <td className="px-3 text-xs text-muted-foreground">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="px-3">
                        <div className="flex justify-end gap-1">
                          {canRetryJob(job) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={retryJob.isPending}
                              onClick={() => void handleRetry(job)}
                            >
                              <Play className="mr-1 h-3 w-3" /> 재시도
                            </Button>
                          ) : null}
                          {["queued", "running", "retrying"].includes(job.status) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={cancelJob.isPending}
                              onClick={() => void handleCancel(job)}
                            >
                              <Pause className="mr-1 h-3 w-3" /> 취소
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedJob(job)}
                          >
                            로그
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-10 text-center text-sm text-muted-foreground"
                      >
                        작업이 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedJob)} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>작업 로그</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
            {JSON.stringify(selectedJob, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusTone(status: JobStatus) {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
    case "canceled":
      return "danger";
    case "running":
    case "retrying":
      return "info";
    default:
      return "warning";
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
