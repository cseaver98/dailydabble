import type { ReactNode } from "react";

export type DailydabbleNavProps = {
  subtitle?: string;
  subtitleHref?: string;
  label?: string;
  labelId?: string;
  labelClassName?: string;
  homeHref?: string;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  headerClassName?: string;
  innerClassName?: string;
};

export type DailydabbleMenuLink = {
  label: string;
  href: string;
  id?: string;
  hidden?: boolean;
  brand?: boolean;
  iconSrc?: string;
  iconAlt?: string;
  iconBackground?: string;
  completed?: boolean;
};

export type DailydabbleUnavailableProps = {
  title?: string;
  message?: string;
  className?: string;
};

export type DailydabbleMenuProps = {
  items?: DailydabbleMenuLink[];
  legalLinks?: DailydabbleMenuLink[];
  buttonId?: string;
  menuId?: string;
  buttonAriaLabel?: string;
  buttonText?: string;
};

export declare function DailydabbleNav(props: DailydabbleNavProps): ReactNode;
export declare function DailydabbleMenu(props: DailydabbleMenuProps): ReactNode;
export declare function DailydabbleUnavailable(props: DailydabbleUnavailableProps): ReactNode;
