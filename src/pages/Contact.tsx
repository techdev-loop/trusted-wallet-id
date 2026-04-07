import { useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import MarketingPageLayout from "@/components/MarketingPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || "support@fiulink.com";

const Contact = () => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sub = subject.trim() || "FIU ID inquiry";
    const text = body.trim();
    if (!text) {
      toast.error("Please enter a message.");
      return;
    }
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(text)}`;
    window.location.href = mailto;
    toast.success("Opening your email client…");
  };

  return (
    <MarketingPageLayout
      title="Contact"
      description="Reach the team for product questions, privacy requests, or support."
    >
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/60 bg-muted/25 px-4 py-4">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Email</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-base sm:text-lg font-medium text-accent hover:underline break-all"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center gap-2 text-foreground mb-1">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm sm:text-base">Send a message</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-subject">Subject</Label>
            <Input
              id="contact-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this about?"
              className="h-11 sm:h-12 rounded-xl"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-body">Message</Label>
            <Textarea
              id="contact-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe your question or request…"
              rows={6}
              className="min-h-[140px] rounded-xl resize-y text-base sm:text-sm"
            />
          </div>
          <Button type="submit" variant="accent" size="lg" className="w-full sm:w-auto min-h-11 rounded-xl">
            Open in email app
          </Button>
          <p className="text-xs text-muted-foreground">
            This opens your default mail client with a pre-filled message. If nothing opens, copy the address above.
          </p>
        </form>
      </div>
    </MarketingPageLayout>
  );
};

export default Contact;
