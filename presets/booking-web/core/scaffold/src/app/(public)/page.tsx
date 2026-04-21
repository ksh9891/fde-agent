import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          편안한 시간을 예약하세요
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          로그인 후 원하시는 상품을 선택해 바로 예약하실 수 있습니다.
        </p>
        <div className="flex gap-3">
          <Link href="/signup">
            <Button size="lg">회원가입</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              로그인
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
