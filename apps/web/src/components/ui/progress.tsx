"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /**
   * What the bar measures, e.g. "Profile completeness". Combined with the
   * value into the accessible name.
   *
   * Radix renders role="progressbar", and a progressbar with no name is
   * announced as a bare number — the axe sweep found 8 of them across the
   * dashboards. When no label is passed the percentage is still announced,
   * which is strictly better than silence.
   */
  label?: string
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, max = 100, label, ...props }, ref) => {
  const maximum = Number.isFinite(max) && max > 0 ? max : 100
  const current = typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum ? value : null

  // `label` was declared and documented on ProgressProps — including a note
  // that the axe sweep had found nameless progressbars on the dashboards —
  // and then never wired: the component was typed against the Radix props
  // rather than its own, so the prop could not even be passed. All 85 call
  // sites render without one, and axe reports `aria-progressbar-name
  // (serious)` on every authenticated route that draws a bar.
  //
  // The name is set here rather than at 85 call sites so no bar can ever be
  // nameless again; a call site that knows what its bar measures should still
  // pass `label`, and that is strictly better than the fallback.
  const named = props["aria-label"] ?? props["aria-labelledby"]
  const percent = current === null ? null : Math.round((current / maximum) * 100)

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={current}
      max={maximum}
      aria-label={named ? undefined : (label ?? "Progress")}
      // The name says what the bar is; the value label says where it stands.
      // Putting the number in the name instead would make the name change on
      // every tick, which screen readers re-announce as a new control.
      getValueLabel={() => (percent === null ? "Loading" : `${percent}%`)}
      className={cn(
        "relative h-[5px] w-full overflow-hidden rounded-full bg-foreground/[0.06]",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-foreground/25 transition-all duration-300 ease-out"
        style={{ transform: `translateX(-${100 - ((current ?? 0) / maximum) * 100}%)` }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
