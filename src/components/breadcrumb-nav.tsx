import { Link, useRouterState } from "@tanstack/react-router";

const LABELS: Record<string, string> = {
  dashboard: "오늘 할 일",
  products: "상품 등록",
  sources: "자료 확인",
  knowledge: "AI 자료 상태",
  content: "문구 만들기",
  images: "이미지 만들기",
  prompts: "AI 지시문",
  jobs: "실패 작업",
  users: "사용자",
  settings: "설정",
};

export function BreadcrumbNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  if (pathname === "/login") {
    return null;
  }

  const effectiveSegments = segments.length > 0 ? segments : ["dashboard"];

  return (
    <nav aria-label="브레드크럼" className="hidden items-center text-sm md:flex">
      <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
        전통문화 RAG
      </Link>
      {effectiveSegments.map((segment, index) => {
        const href = `/${effectiveSegments.slice(0, index + 1).join("/")}`;
        const isLast = index === effectiveSegments.length - 1;
        const label = LABELS[segment] ?? segment;

        return (
          <span key={href} className="flex items-center">
            <span className="mx-2 text-border">/</span>
            {isLast ? (
              <span className="text-foreground">{label}</span>
            ) : (
              <Link to={href} className="text-muted-foreground hover:text-foreground">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
