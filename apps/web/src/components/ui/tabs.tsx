import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

/**
 * Say when a tab strip continues past its edge, and keep the selected tab in it.
 *
 * The list scrolls sideways with its scrollbar hidden, which is right on a
 * phone and left no sign that there was more: /connections cut "Sent" to
 * "Ser", /data-room cut "Settings", and nothing said the strip moved. While it
 * overflows, the edge that hides tabs fades (`data-fade`, styled in
 * globals.css), and the selected tab is scrolled into the strip whenever the
 * selection changes - by the list's own scroll offset, so the page never jumps.
 */
function useTabStripOverflow(ref: React.RefObject<HTMLDivElement | null>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1) {
        el.removeAttribute('data-fade');
        return;
      }
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft < max - 1;
      el.setAttribute('data-fade', start && end ? 'both' : start ? 'start' : end ? 'end' : '');
    };
    const reveal = () => {
      const active = el.querySelector<HTMLElement>('[data-state="active"]');
      if (!active || el.scrollWidth <= el.clientWidth) return;
      const left = active.offsetLeft;
      const right = left + active.offsetWidth;
      if (left < el.scrollLeft) el.scrollLeft = left - 8;
      else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth + 8;
      update();
    };
    update();
    reveal();
    el.addEventListener('scroll', update, { passive: true });
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    resize?.observe(el);
    const selection = typeof MutationObserver !== 'undefined' ? new MutationObserver(reveal) : null;
    selection?.observe(el, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
    return () => {
      el.removeEventListener('scroll', update);
      resize?.disconnect();
      selection?.disconnect();
    };
  }, [ref]);
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, forwardedRef) => {
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  useTabStripOverflow(innerRef);
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );
  return (
    <TabsPrimitive.List
      ref={setRef}
      className={cn(
        // No frame around the strip: the selected tab's quiet fill is the
        // only shape, so a row of tabs reads as text rather than a control box.
        'tab-strip inline-flex min-h-11 max-w-full items-center gap-0.5 overflow-x-auto scrollbar-hide rounded-lg p-0.5 text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

/**
 * Keep `aria-controls` pointing at something that exists.
 *
 * Radix gives every trigger `aria-controls="<base>-content-<value>"`, which is
 * right when a `<TabsContent>` for that value is on the page. About twenty
 * screens here use tabs as a *filter* instead - /feed's All / Following /
 * Trending, /shortlist's roles, the admin queues - and render one list below
 * them rather than a panel per value. On those, the selected tab referenced an
 * id that was never in the document, which axe reports as
 * aria-valid-attr-value and which leaves a screen reader's "go to controlled
 * element" pointing at nothing.
 *
 * After each commit (so a panel mounted in the same render is already there)
 * the attribute is kept only while its target exists; the id is remembered in
 * `data-controls` so it comes back the moment a panel for it appears. React
 * does not rewrite an attribute whose prop has not changed, so it does not
 * fight this.
 */
function useControlledTargetExists(ref: React.RefObject<HTMLButtonElement | null>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = el.getAttribute('data-controls') ?? el.getAttribute('aria-controls');
    if (!id) return;
    el.setAttribute('data-controls', id);
    if (document.getElementById(id)) el.setAttribute('aria-controls', id);
    else el.removeAttribute('aria-controls');
  });
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, forwardedRef) => {
  const innerRef = React.useRef<HTMLButtonElement | null>(null);
  useControlledTargetExists(innerRef);
  const setRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );
  return (
    <TabsPrimitive.Trigger
      ref={setRef}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150',
        'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.035]',
        'focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-40',
        'data-[state=active]:bg-foreground/[0.07] data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:border-0',
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-4 focus-visible:outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
