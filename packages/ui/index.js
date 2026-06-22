import React from "react";
import * as Dialog from "@radix-ui/react-dialog";

export function DailydabbleNav({
  subtitle,
  subtitleHref,
  label,
  labelId,
  labelClassName = "",
  homeHref = "/",
  leftContent = null,
  rightContent = null,
  headerClassName = "",
  innerClassName = "",
}) {
  return React.createElement(
    "header",
    { className: `dd-nav ${headerClassName}`.trim() },
    React.createElement(
      "div",
      { className: `dd-nav-inner ${innerClassName}`.trim() },
      React.createElement(
        "div",
        { className: "dd-nav-left" },
        leftContent ? React.createElement("div", { className: "dd-nav-left-content" }, leftContent) : null,
        React.createElement(
          "div",
          { className: "dd-brand" },
          React.createElement(
            "a",
            { className: "dd-brand-link", href: homeHref },
            React.createElement("span", { className: "dd-brand-word" }, "DailyDabble"),
          ),
          subtitle
            ? React.createElement(
                React.Fragment,
                null,
                React.createElement("span", { className: "dd-brand-separator", "aria-hidden": "true" }),
                subtitleHref
                  ? React.createElement("a", { className: "dd-brand-subtitle-link", href: subtitleHref }, subtitle)
                  : React.createElement("span", { className: "dd-brand-subtitle" }, subtitle),
              )
            : null,
        ),
        label
          ? React.createElement(
              "p",
              { id: labelId, className: `dd-nav-label ${labelClassName}`.trim() },
              label,
            )
          : null,
      ),
      React.createElement("div", { className: "dd-nav-right" }, rightContent),
    ),
  );
}

export function DailydabbleMenu({
  items = [],
  legalLinks = [],
  buttonId,
  menuId,
  buttonAriaLabel = "Open menu",
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [menuTop, setMenuTop] = React.useState(0);
  const menuWrapRef = React.useRef(null);
  const visibleItems = items.filter((item) => !item.hidden);

  const updateMenuTop = React.useCallback(() => {
    const nav = menuWrapRef.current?.closest(".dd-nav");
    setMenuTop(nav ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom)) : 0);
  }, []);

  React.useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    updateMenuTop();
    window.addEventListener("resize", updateMenuTop);
    window.addEventListener("scroll", updateMenuTop, { passive: true });
    return () => {
      window.removeEventListener("resize", updateMenuTop);
      window.removeEventListener("scroll", updateMenuTop);
    };
  }, [isOpen, updateMenuTop]);

  return React.createElement(
    Dialog.Root,
    {
      modal: false,
      open: isOpen,
      onOpenChange: (nextOpen) => {
        if (nextOpen) {
          updateMenuTop();
        }
        setIsOpen(nextOpen);
      },
    },
    React.createElement(
      "div",
      { className: "dd-menu-wrap", ref: menuWrapRef },
      React.createElement(
        Dialog.Trigger,
        { asChild: true },
        React.createElement(
          "button",
          {
            id: buttonId,
            type: "button",
            className: "menu-toggle-btn",
            "data-dd-menu-managed": "react",
            "aria-label": buttonAriaLabel,
          },
          React.createElement(
            "svg",
            { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
            React.createElement("path", {
              d: "M4 7h16M4 12h16M4 17h16",
              stroke: "currentColor",
              strokeWidth: "2",
              strokeLinecap: "round",
            }),
          ),
        ),
      ),
    ),
    React.createElement(
      Dialog.Portal,
      null,
      React.createElement(
        Dialog.Content,
        {
          id: menuId,
          className: "nav-menu",
          "data-dd-menu-managed": "react",
          "aria-label": "DailyDabble menu",
          style: { "--dd-menu-top": `${menuTop}px` },
        },
        React.createElement(
          "div",
          { className: "nav-menu-header" },
          React.createElement("p", { className: "nav-menu-title" }, "Games"),
          React.createElement(
            Dialog.Close,
            { asChild: true },
            React.createElement(
              "button",
              {
                type: "button",
                className: "nav-menu-close",
                "aria-label": "Close menu",
              },
              "×",
            ),
          ),
        ),
        visibleItems.map((item) =>
          React.createElement(
            Dialog.Close,
            { key: `${item.href}-${item.label}`, asChild: true },
            React.createElement(
              "a",
              {
                id: item.id,
                className: item.brand ? "nav-menu-item nav-menu-item-brand" : "nav-menu-item",
                href: item.href,
                style: item.iconBackground ? { "--dd-menu-item-hover-bg": item.iconBackground } : undefined,
              },
              item.iconSrc
                  ? React.createElement(
                      "span",
                    {
                      className: "nav-menu-item-icon",
                      "aria-hidden": "true",
                      style: item.iconBackground ? { "--dd-menu-item-icon-bg": item.iconBackground } : undefined,
                    },
                    React.createElement("img", {
                      src: item.iconSrc,
                      alt: "",
                      loading: "lazy",
                    }),
                  )
                : null,
              React.createElement("span", null, item.label),
              item.completed
                ? React.createElement("span", {
                    className: "nav-menu-complete-check",
                    "aria-label": "Completed",
                    role: "img",
                  })
                : null,
            ),
          ),
        ),
        legalLinks.length
          ? React.createElement(
              "div",
              { className: "nav-menu-footer" },
              legalLinks.map((item) =>
                React.createElement(
                  Dialog.Close,
                  { key: item.href, asChild: true },
                  React.createElement("a", { className: "nav-menu-legal-link", href: item.href }, item.label),
                ),
              ),
            )
          : null,
      ),
    ),
  );
}

export function DailydabbleUnavailable({
  title = "Game unavailable",
  message = "No puzzle available right now.",
  className = "",
}) {
  return React.createElement(
    "section",
    { className: `dd-empty-state ${className}`.trim() },
    React.createElement("h1", { className: "dd-empty-state-title" }, title),
    React.createElement("p", { className: "dd-empty-state-copy" }, message),
  );
}
