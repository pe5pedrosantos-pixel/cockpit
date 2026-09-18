"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, verifyCredentials } from "@/lib/auth";

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData
) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!(await verifyCredentials(email, password))) {
    return { error: "E-mail ou senha incorretos." };
  }
  await createSession(email);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
