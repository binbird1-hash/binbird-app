import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export default function HomePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const codeParam = searchParams?.code;
  const nextParam = searchParams?.next;

  const code = Array.isArray(codeParam) ? codeParam[0] : codeParam;

  if (code) {
    const nextValue = Array.isArray(nextParam) ? nextParam[0] : nextParam;

    const callbackUrl = new URLSearchParams({ code });

    if (nextValue) {
      callbackUrl.set("next", nextValue);
    }

    redirect(`/auth/callback?${callbackUrl.toString()}`);
  }

  redirect("/auth/login");
}
