"use client";

import { Bot, Send, Sparkles, X } from "lucide-react";
import * as React from "react";

import { Button } from "@code-main/ui/components/button";
import { ScrollArea } from "@code-main/ui/components/scroll-area";
import { Separator } from "@code-main/ui/components/separator";
import { Textarea } from "@code-main/ui/components/textarea";
import { cn } from "@code-main/ui/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const PLACEHOLDER_RESPONSES = [
  "I can help you manage your inbox! You have 128 unread messages. Would you like me to summarize the most important ones?",
  "Based on your email patterns, I notice several threads that may need your attention. The most urgent appears to be from William Howard about a meeting.",
  "I can draft a reply, search your inbox, or help you organize your emails. What would you like to do?",
];

export function AskAIPanel({
  isOpen,
  onClose,
}: {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}) {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      content:
        "Hi! I'm your AI email assistant. I can help you search emails, draft replies, summarize threads, or answer questions about your inbox.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const responseIndex = React.useRef(0);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: PLACEHOLDER_RESPONSES[responseIndex.current % PLACEHOLDER_RESPONSES.length],
      };
      responseIndex.current += 1;
      setIsTyping(false);
      setMessages((prev) => [...prev, reply]);
    }, 1200);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col border-l bg-background transition-all duration-300 ease-in-out",
        isOpen ? "w-[340px] opacity-100" : "w-0 overflow-hidden opacity-0",
      )}
    >
      {/* Header */}
      <div className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <Sparkles className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Ask AI</span>
        <Button className="ml-auto size-7" onClick={onClose} size="icon" variant="ghost">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>
      <Separator />

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1 px-4 py-3">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
            >
              {msg.role === "assistant" && (
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[250px] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "rounded-tr-sm bg-primary text-primary-foreground"
                    : "rounded-tl-sm bg-muted text-foreground",
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2">
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-3.5 text-primary" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-3">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </ScrollArea>

      <Separator />

      {/* Input */}
      <div className="shrink-0 p-3">
        <div className="flex items-end gap-2 rounded-xl border bg-muted/40 px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
          <Textarea
            className="min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your emails…"
            rows={1}
            value={input}
          />
          <Button
            className="size-7 shrink-0"
            disabled={!input.trim() || isTyping}
            onClick={handleSend}
            size="icon"
          >
            <Send className="size-3.5" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
