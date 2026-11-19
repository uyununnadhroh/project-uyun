"use client";
import { useActionState } from "react";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next ?? "/admin"} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={pending}>Masuk</Button>
    </form>
  );
}
