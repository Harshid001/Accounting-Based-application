"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, MessageSquare, Send } from "lucide-react"

interface Comment {
  id: string
  content: string
  authorId: string
  createdAt: string
  User?: { name: string | null }
}

export function CommentClient() {
  const { data: session } = useSession()
  const clientId = session?.user?.clientId

  const [comments, setComments] = useState<Comment[]>([])
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)

  const fetchCommentsRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    const doFetch = async () => {
      try {
        const res = await fetch(`/api/comments`)
        if (res.ok) {
          const _resData = await res.json()
          const data = _resData.data || _resData
          if (!cancelled) setComments(data)
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchCommentsRef.current = doFetch
    doFetch()
    return () => { cancelled = true }
  }, [clientId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parentType: "client", parentId: clientId })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to post comment")
      }

      setContent("")
      fetchCommentsRef.current()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col h-[500px]">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Message History
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {comments.length === 0 ? (
            <div className="text-center text-muted-foreground mt-12">No messages yet.</div>
          ) : (
            comments.map((comment) => {
              const isMe = comment.authorId === session?.user?.id
              return (
                <div key={comment.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {new Date(comment.createdAt).toLocaleString()} • {comment.User?.name || 'Unknown'}
                  </span>
                </div>
              )
            })
          )}
        </div>
        <div className="p-4 border-t border-border bg-card">
          <form onSubmit={handleSubmit} className="flex gap-4 items-end">
            <div className="flex-1">
              <Textarea
                placeholder="Type your message..."
                className="min-h-[60px] resize-none"
                value={content}
                onChange={e => setContent(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading || !content.trim()} size="icon" className="h-[60px] w-[60px] rounded-xl">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
