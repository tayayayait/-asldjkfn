import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";
import {
  createLoginAttemptState,
  getLoginLockState,
  recordFailedLoginAttempt,
  resetLoginAttemptState,
  type LoginAttemptState,
} from "@/lib/auth/login-attempts";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().email("올바른 이메일을 입력하세요."),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const ATTEMPT_STORAGE_KEY = "traditional-rag-login-attempts";

function readAttemptState(): LoginAttemptState {
  try {
    const raw = window.localStorage.getItem(ATTEMPT_STORAGE_KEY);

    if (!raw) {
      return createLoginAttemptState();
    }

    return {
      ...createLoginAttemptState(),
      ...JSON.parse(raw),
    };
  } catch {
    return createLoginAttemptState();
  }
}

function writeAttemptState(state: LoginAttemptState) {
  window.localStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(state));
}

function clearAttemptState() {
  window.localStorage.removeItem(ATTEMPT_STORAGE_KEY);
}

function LoginPage() {
  const { signIn, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const onSubmit = async (values: LoginFormValues) => {
    const attemptState = readAttemptState();
    const lockState = getLoginLockState(attemptState);

    if (lockState.isLocked) {
      const remainingMinutes = Math.ceil(lockState.remainingMs / 60_000);
      setError("root", {
        message: `${remainingMinutes}분 후 다시 시도하세요.`,
      });
      return;
    }

    try {
      await signIn(values.email, values.password);
      writeAttemptState(resetLoginAttemptState());
      clearAttemptState();
      await navigate({ to: "/dashboard", replace: true });
    } catch {
      writeAttemptState(recordFailedLoginAttempt(attemptState));
      setError("root", {
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      });
    }
  };

  return (
    <div className="flex min-h-screen justify-center bg-muted/30 px-4 pt-24">
      <Card className="h-fit w-full max-w-[400px] rounded-lg">
        <CardHeader>
          <CardTitle className="text-xl">전통문화 RAG 어드민</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
              {errors.password ? (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              ) : null}
            </div>
            {errors.root ? (
              <p className="text-sm text-destructive">{errors.root.message}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              로그인
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
