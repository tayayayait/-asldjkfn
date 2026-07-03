export type AuthRole = "admin" | "manager" | "editor" | "reviewer" | "viewer";

export type NavigationItem = {
  title: string;
  url: string;
  group: "work" | "admin";
  allowedRoles: AuthRole[];
};

export const ROLE_LABELS: Record<AuthRole, string> = {
  admin: "관리자",
  manager: "매니저",
  editor: "에디터",
  reviewer: "검수자",
  viewer: "조회자",
};

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    title: "오늘 할 일",
    url: "/dashboard",
    group: "work",
    allowedRoles: ["admin", "manager", "editor", "reviewer", "viewer"],
  },
  {
    title: "상품 등록",
    url: "/products",
    group: "work",
    allowedRoles: ["admin", "manager"],
  },
  {
    title: "자료 확인",
    url: "/sources",
    group: "work",
    allowedRoles: ["admin", "manager", "editor", "reviewer"],
  },
  {
    title: "AI 자료 상태",
    url: "/knowledge",
    group: "work",
    allowedRoles: ["admin", "manager", "editor", "reviewer"],
  },
  {
    title: "문구 만들기",
    url: "/content",
    group: "work",
    allowedRoles: ["admin", "manager", "editor", "reviewer", "viewer"],
  },
  {
    title: "이미지 만들기",
    url: "/images",
    group: "work",
    allowedRoles: ["admin", "manager", "editor", "reviewer", "viewer"],
  },
  {
    title: "AI 지시문",
    url: "/prompts",
    group: "work",
    allowedRoles: ["admin", "manager", "editor"],
  },
  {
    title: "실패 작업",
    url: "/jobs",
    group: "work",
    allowedRoles: ["admin", "manager"],
  },
  {
    title: "사용자",
    url: "/users",
    group: "admin",
    allowedRoles: ["admin"],
  },
  {
    title: "설정",
    url: "/settings",
    group: "admin",
    allowedRoles: ["admin"],
  },
];

export function getAllowedNavigationItems(role: AuthRole | null | undefined) {
  const effectiveRole = role ?? "viewer";

  return NAVIGATION_ITEMS.filter((item) =>
    item.allowedRoles.includes(effectiveRole),
  );
}

export function canAccessPath(role: AuthRole | null | undefined, path: string) {
  const normalizedPath = path === "/" ? "/dashboard" : path;
  const item = NAVIGATION_ITEMS.find(
    (navigationItem) =>
      normalizedPath === navigationItem.url ||
      normalizedPath.startsWith(`${navigationItem.url}/`),
  );

  if (!item) {
    return true;
  }

  return getAllowedNavigationItems(role).some(
    (navigationItem) => navigationItem.url === item.url,
  );
}
