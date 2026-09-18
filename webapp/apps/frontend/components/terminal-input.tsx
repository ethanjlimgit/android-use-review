import { useState } from "react";

interface TerminalInputProps {
  onSubmit?: (value: string) => void;
}

export function TerminalInput({ onSubmit }: TerminalInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && onSubmit) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/50">
        <span className="font-mono text-xs text-muted-foreground">USER@DROID-USE:~/NEW_TASK</span>
        <div className="ml-auto flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
          <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
          <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
        </div>
      </div>
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex items-start gap-2">
          <span className="text-primary font-mono text-sm">$</span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Describe the task you want to automate..."
            className="flex-1 bg-transparent font-mono text-sm placeholder:text-muted-foreground focus:outline-none"
            data-testid="input-terminal"
          />
          <span className="terminal-cursor inline-block w-2 h-5 bg-primary" />
        </div>
      </form>
    </div>
  );
}
