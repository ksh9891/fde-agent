"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") ?? "/my/reservations";
  const { signup } = useAuth();
  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    phone: "",
    email: "",
    ownerNumber: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signup({
      username: form.username,
      password: form.password,
      name: form.name,
      phone: form.phone,
      email: form.email || undefined,
      ownerNumber: form.ownerNumber || undefined,
    });
    if (result.ok) {
      router.push(redirect);
    } else if (result.error === "USERNAME_TAKEN") {
      setError("이미 사용 중인 아이디입니다.");
    } else {
      setError("회원가입에 실패했습니다. 입력값을 확인해주세요.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">회원가입</CardTitle>
          <CardDescription>
            분양회원번호가 있으시면 함께 입력해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field id="username" label="아이디" value={form.username} onChange={update("username")} required />
            <Field id="password" label="비밀번호" type="password" value={form.password} onChange={update("password")} required />
            <Field id="name" label="이름" value={form.name} onChange={update("name")} required />
            <Field id="phone" label="연락처" value={form.phone} onChange={update("phone")} required />
            <Field id="email" label="이메일 (선택)" type="email" value={form.email} onChange={update("email")} />
            <Field id="ownerNumber" label="분양회원번호 (선택)" value={form.ownerNumber} onChange={update("ownerNumber")} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "가입 중..." : "회원가입"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="underline">
                로그인
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={onChange} required={required} />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
