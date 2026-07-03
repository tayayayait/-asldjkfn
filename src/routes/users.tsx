import { createFileRoute } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { USER_ROLE_LABELS, type Profile, type UserRole } from "@/lib/api/users";
import {
  useProfiles,
  useUpdateProfileActive,
  useUpdateProfileRole,
} from "@/hooks/use-users";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "사용자 · 전통문화 RAG 어드민" }] }),
  component: UsersPage,
});

function UsersPage() {
  const profilesQuery = useProfiles();
  const updateRole = useUpdateProfileRole();
  const updateActive = useUpdateProfileActive();
  const profiles = profilesQuery.data ?? [];

  async function handleRoleChange(profile: Profile, role: UserRole) {
    try {
      await updateRole.mutateAsync({ id: profile.id, role });
      toast.success("역할을 변경했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleActiveChange(profile: Profile, isActive: boolean) {
    try {
      await updateActive.mutateAsync({ id: profile.id, isActive });
      toast.success(isActive ? "사용자를 활성화했습니다." : "사용자를 비활성화했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="사용자"
        description="프로필, 역할, 계정 활성 상태를 관리합니다."
        actions={
          <Button size="sm" variant="outline" disabled>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> 초대는 Auth 콘솔에서 처리
          </Button>
        }
      />

      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr className="h-10">
                    <th className="px-3 text-left font-medium">이름</th>
                    <th className="px-3 text-left font-medium">이메일</th>
                    <th className="px-3 text-left font-medium">역할</th>
                    <th className="px-3 text-left font-medium">상태</th>
                    <th className="px-3 text-left font-medium">가입일</th>
                    <th className="px-3 text-right font-medium">활성</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {profiles.map((profile) => (
                    <tr key={profile.id} className="h-12 hover:bg-muted/20">
                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                            {(profile.name || profile.email).charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">
                            {profile.name || "이름 없음"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 font-mono text-xs text-muted-foreground">
                        {profile.email}
                      </td>
                      <td className="px-3">
                        <Select
                          value={profile.role}
                          onValueChange={(value) =>
                            void handleRoleChange(profile, value as UserRole)
                          }
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map(
                              (role) => (
                                <SelectItem key={role} value={role}>
                                  {USER_ROLE_LABELS[role]}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3">
                        <StatusBadge tone={profile.is_active ? "success" : "muted"}>
                          {profile.is_active ? "활성" : "비활성"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 text-xs text-muted-foreground">
                        {formatDate(profile.created_at)}
                      </td>
                      <td className="px-3 text-right">
                        <Switch
                          checked={profile.is_active}
                          onCheckedChange={(checked) =>
                            void handleActiveChange(profile, checked)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  {profiles.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-10 text-center text-sm text-muted-foreground"
                      >
                        등록된 사용자가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
