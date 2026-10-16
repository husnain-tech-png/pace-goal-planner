import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </IconBase>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="16" rx="2" width="18" x="3" y="5" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12 4 4L19 6" />
    </IconBase>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9 18 6-6-6-6" />
    </IconBase>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.6 4.9-4.9 2.6 2.6-4.9 4.9-2.6Z" />
    </IconBase>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 21c4 0 7-2.8 7-6.8 0-3.3-1.8-5.7-4.4-8.6.1 2.5-1.5 4.4-3.3 5.3.2-2.2-1-4.9-3.4-6.9.2 3.5-3.8 5.5-3.8 10.2C4.1 18.2 7.5 21 12 21Z" />
    </IconBase>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3 .9 4.1L17 8l-4.1.9L12 13l-.9-4.1L7 8l4.1-.9L12 3Z" />
      <path d="m19 14 .5 2.5L22 17l-2.5.5L19 20l-.5-2.5L16 17l2.5-.5L19 14ZM5 14l.5 2.5L8 17l-2.5.5L5 20l-.5-2.5L2 17l2.5-.5L5 14Z" />
    </IconBase>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="m15 9 5-5M16 4h4v4" />
    </IconBase>
  );
}

export function TrendIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m4 16 5-5 4 3 7-8" />
      <path d="M15 6h5v5" />
    </IconBase>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.8-3.3 3.1-5 7.5-5s6.7 1.7 7.5 5" />
    </IconBase>
  );
}
