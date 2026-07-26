import { redirect } from "next/navigation";

type Ctx = { params: Promise<{ chatId: string }> };

export default async function LegacyChatRedirect({ params }: Ctx) {
  const { chatId } = await params;
  redirect(`/c/${chatId}`);
}
