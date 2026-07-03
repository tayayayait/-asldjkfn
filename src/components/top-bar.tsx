import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, Search, UserCircle } from "lucide-react";
import { toast } from "sonner";

import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth/auth-context";
import { ROLE_LABELS } from "@/lib/auth/roles";

export function TopBar() {
  const { profile, role, session, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = profile?.name || profile?.email || "사용자";
  const roleLabel = role ? ROLE_LABELS[role] : "권한 없음";

  const handleSignOut = async () => {
    if (!session) {
      return;
    }

    await signOut();
    toast.success("로그아웃되었습니다.");
    await navigate({ to: "/login", replace: true });
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <SidebarTrigger />
      <BreadcrumbNav />
      <div className="relative ml-auto hidden w-full max-w-sm sm:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="상품명 또는 SKU 검색" className="h-9 pl-8" />
      </div>
      <Button variant="ghost" size="icon" aria-label="알림">
        <Bell className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="사용자 메뉴">
            <UserCircle className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <span className="block truncate text-sm">{displayName}</span>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              {session ? roleLabel : `${roleLabel} / Demo`}
            </span>
          </DropdownMenuLabel>
          {session ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                로그아웃
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
