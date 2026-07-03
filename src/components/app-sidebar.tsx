import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ClipboardCheck,
  LayoutDashboard,
  Package,
  Database,
  FileText,
  Image as ImageIcon,
  Sparkles,
  ListChecks,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import {
  getAllowedNavigationItems,
  ROLE_LABELS,
  type NavigationItem,
} from "@/lib/auth/roles";

const ICONS: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/products": Package,
  "/sources": ClipboardCheck,
  "/knowledge": Database,
  "/content": FileText,
  "/images": ImageIcon,
  "/prompts": Sparkles,
  "/jobs": ListChecks,
  "/users": Users,
  "/settings": Settings,
};

const SIMPLE_LABELS: Record<string, string> = {
  "/dashboard": "오늘 할 일",
  "/products": "상품 등록",
  "/sources": "자료 확인",
  "/knowledge": "AI 자료 상태",
  "/content": "문구 만들기",
  "/images": "이미지 만들기",
  "/prompts": "AI 지시문",
  "/jobs": "실패 작업",
  "/users": "사용자",
  "/settings": "설정",
};

const DAILY_PATHS = new Set([
  "/dashboard",
  "/products",
  "/sources",
  "/content",
  "/images",
]);

function SidebarSection({ items }: { items: NavigationItem[] }) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (path: string) =>
    currentPath === path || currentPath.startsWith(path + "/");

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = ICONS[item.url] ?? LayoutDashboard;
        const label = SIMPLE_LABELS[item.url] ?? item.title;

        return (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={label}>
              <Link to={item.url}>
                <Icon />
                <span>{label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const { profile, role, session, signOut } = useAuth();
  const navigate = useNavigate();
  const allowedItems = getAllowedNavigationItems(role);
  const daily = allowedItems.filter((item) => DAILY_PATHS.has(item.url));
  const advanced = allowedItems.filter(
    (item) => item.group === "work" && !DAILY_PATHS.has(item.url),
  );
  const admin = allowedItems.filter((item) => item.group === "admin");
  const initials = (profile?.name || profile?.email || "U").slice(0, 2).toUpperCase();
  const displayName = profile?.name || profile?.email || "사용자";
  const roleLabel = role ? ROLE_LABELS[role] : "권한 없음";

  const handleSignOut = async () => {
    if (!session) {
      return;
    }

    await signOut();
    await navigate({ to: "/login", replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
            傳
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground">전통문화 RAG</span>
            <span className="text-[11px] text-sidebar-foreground/60">콘텐츠 자동화</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>기본 순서</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarSection items={daily} />
          </SidebarGroupContent>
        </SidebarGroup>
        {advanced.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>고급 기능</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarSection items={advanced} />
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        {admin.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>관리자</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarSection items={admin} />
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
            {initials}
          </div>
          <div className="min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-xs font-medium text-sidebar-foreground">
              {displayName}
            </span>
            <span className="text-[11px] text-sidebar-foreground/60">
              {session ? roleLabel : `${roleLabel} / Demo`}
            </span>
          </div>
          {session ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 group-data-[collapsible=icon]:hidden"
              aria-label="로그아웃"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
