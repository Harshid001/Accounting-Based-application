import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { CommentClient } from "./comment-client"

export default async function ClientCommentsPage() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || session.user.role !== "CLIENT") {
    redirect("/login")
  }

  const clientId = session.user.clientId
  if (!clientId) {
    return <div className="p-8 text-center text-muted-foreground">No client account associated.</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground mt-1">Communicate directly with your assigned accountant.</p>
      </div>

      <CommentClient />
    </div>
  )
}
