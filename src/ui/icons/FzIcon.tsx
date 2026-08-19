import type { ComponentPropsWithoutRef } from 'react';
import { CircleHelp } from 'lucide-react';
import { publishedIconComponents, publishedIconUsageOverrides } from './published.generated';
import type { IconRoleKey, IconSize } from './contracts';

const sizes: Record<IconSize, number> = { sm: 16, md: 20, lg: 24, xl: 28 };
const filledRoles = new Set<string>(['play', 'pause', 'stop']);

type CommonProps = Omit<ComponentPropsWithoutRef<'svg'>, 'children'> & {
  name: IconRoleKey;
  usageId: string;
  size?: IconSize;
};

type FzIconProps = CommonProps & (
  | { decorative?: true; 'aria-label'?: never }
  | { decorative: false; 'aria-label': string }
);

export function FzIcon({ name, usageId, size = 'md', decorative = true, fill, ...props }: FzIconProps) {
  const Icon = publishedIconUsageOverrides[usageId] ?? publishedIconComponents[name] ?? CircleHelp;
  const resolvedFill = fill ?? (filledRoles.has(name) ? 'currentColor' : undefined);
  return (
    <Icon
      {...(resolvedFill ? { fill: resolvedFill } : {})}
      {...props}
      size={sizes[size]}
      strokeWidth={2}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      data-icon-usage={import.meta.env.DEV ? usageId : undefined}
    />
  );
}
