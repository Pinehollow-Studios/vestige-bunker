"use server";

import { redirect } from "next/navigation";
import { createDevClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "error";
  message?: string;
};

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { status: "error", message: "Incorrect email or password." };
  }

  const supabase = await createDevClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately generic — never leak whether the email exists, the admin
    // gate, rate limits, or any Supabase internals to an anonymous visitor.
    return { status: "error", message: "Incorrect email or password." };
  }

  redirect("/");
}
