import type { ReactNode } from "react";

export type DailydabbleNavProps = {
  subtitle?: string;
  label?: string;
  labelId?: string;
  labelClassName?: string;
  homeHref?: string;
  rightContent?: ReactNode;
  headerClassName?: string;
  innerClassName?: string;
};

export type DailydabbleMenuLink = {
  label: string;
  href: string;
  id?: string;
  hidden?: boolean;
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
