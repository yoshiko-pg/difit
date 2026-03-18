/* oxlint-disable react-hooks-js/refs */
// @floating-ui/react uses callback refs which trigger false positives in react-hooks/refs rule
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFocus,
  useFloating,
  useHover,
  useInteractions,
  useRole,
  useTransitionStyles,
} from '@floating-ui/react';
import {
  cloneElement,
  useId,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';

type TooltipChildProps = HTMLAttributes<HTMLElement> & {
  ref?: Ref<HTMLElement>;
};

interface TooltipProps {
  content: ReactNode;
  children: ReactElement<TooltipChildProps>;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const getClosedTransform = (side: string) => {
  if (side === 'top') {
    return 'translateY(4px)';
  }

  if (side === 'bottom') {
    return 'translateY(-4px)';
  }

  if (side === 'left') {
    return 'translateX(4px)';
  }

  return 'translateX(-4px)';
};

const assignRef = <T,>(ref: Ref<T> | undefined, value: T | null) => {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  if (ref && 'current' in ref) {
    ref.current = value;
  }
};

export function Tooltip({ content, children, placement = 'top', className = '' }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { move: false });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });
  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: {
      open: 180,
      close: 120,
    },
    initial: ({ side }) => ({
      opacity: 0,
      transform: getClosedTransform(side),
    }),
    open: {
      opacity: 1,
      transform: 'translate(0, 0)',
    },
    close: ({ side }) => ({
      opacity: 0,
      transform: getClosedTransform(side),
    }),
    common: {
      willChange: 'opacity, transform',
    },
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);
  const childProps = children.props;
  const referenceProps = getReferenceProps({
    ...childProps,
    'aria-describedby': isOpen ? tooltipId : undefined,
  });
  const contentClassName = [
    'w-64 rounded-md border border-github-border bg-github-bg-primary px-3 py-2 text-xs text-github-text-primary',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {cloneElement(children, {
        ...referenceProps,
        ref: (node: HTMLElement | null) => {
          assignRef(childProps.ref, node);
          refs.setReference(node);
        },
      })}
      {isMounted ? (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            {...getFloatingProps()}
            id={tooltipId}
            style={floatingStyles}
            className="z-[60]"
          >
            <div style={transitionStyles} className={contentClassName}>
              {content}
            </div>
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
