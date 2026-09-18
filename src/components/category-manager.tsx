"use client";

import { useRef, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createCategory, deleteCategory } from "@/lib/actions/registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CategoryManager({
  categories,
}: {
  categories: { id: number; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-3">
      <form
        ref={formRef}
        action={(fd) =>
          startTransition(async () => {
            await createCategory(fd);
            formRef.current?.reset();
          })
        }
        className="flex gap-2"
      >
        <Input
          name="name"
          required
          placeholder="Nova categoria…"
          className="max-w-xs"
        />
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Badge key={c.id} tone="outline" className="gap-1.5 py-1 pl-2.5 pr-1">
            {c.name}
            <button
              aria-label={`Remover ${c.name}`}
              className="rounded p-0.5 hover:bg-muted cursor-pointer"
              onClick={() => {
                if (confirm(`Remover a categoria "${c.name}"?`))
                  startTransition(() => deleteCategory(c.id));
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
