import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-widest font-bold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-muted/50 text-foreground border-border/60 [a]:hover:bg-muted",
        secondary:
          "bg-muted/50 text-foreground border-border/60 [a]:hover:bg-muted before:content-[''] before:inline-block before:w-1.5 before:h-1.5 before:rounded-full before:bg-muted-foreground",
        destructive:
          "bg-muted/50 text-foreground border-border/60 [a]:hover:bg-muted before:content-[''] before:inline-block before:w-1.5 before:h-1.5 before:rounded-full before:bg-destructive",
        success: 
          "bg-muted/50 text-foreground border-border/60 [a]:hover:bg-muted before:content-[''] before:inline-block before:w-1.5 before:h-1.5 before:rounded-full before:bg-green-500",
        warning: 
          "bg-muted/50 text-foreground border-border/60 [a]:hover:bg-muted before:content-[''] before:inline-block before:w-1.5 before:h-1.5 before:rounded-full before:bg-amber-500",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
