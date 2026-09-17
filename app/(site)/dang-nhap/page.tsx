import { Suspense } from 'react';
import { LoginForm } from './login-form';

export default function Page() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-pitch">Đăng nhập</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Xem lịch sân thì không cần đăng nhập. Chỉ khi đặt sân mới cần, để chủ sân biết ai đặt.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
