import React from "react";

export function DailydabbleNav({
  subtitle,
  label,
  labelId,
  labelClassName = "",
  homeHref = "/",
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
        React.createElement(
          "a",
          { className: "dd-brand-link", href: homeHref },
          React.createElement("span", { className: "dd-brand-word" }, "DailyDabble"),
          subtitle
            ? React.createElement(
                React.Fragment,
                null,
                React.createElement("span", { className: "dd-brand-separator", "aria-hidden": "true" }),
                React.createElement("span", { className: "dd-brand-subtitle" }, subtitle),
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
  const menuRef = React.useRef(null);
  const visibleItems = items.filter((item) => !item.hidden);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return React.createElement(
    "div",
    { className: "dd-menu-wrap", ref: menuRef },
    React.createElement(
      "button",
      {
        id: buttonId,
        type: "button",
        className: "menu-toggle-btn",
        "data-dd-menu-managed": "react",
        "aria-label": buttonAriaLabel,
        "aria-expanded": isOpen,
        onClick: () => setIsOpen((value) => !value),
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
    React.createElement(
      "div",
      { id: menuId, className: "nav-menu", "data-dd-menu-managed": "react", hidden: !isOpen },
      visibleItems.map((item) =>
        React.createElement(
          "a",
          {
            key: `${item.href}-${item.label}`,
            id: item.id,
            className: item.brand ? "nav-menu-item nav-menu-item-brand" : "nav-menu-item",
            href: item.href,
            onClick: closeMenu,
          },
          React.createElement("span", null, item.label),
          item.brand
            ? React.createElement(
                "svg",
                {
                  className: "nav-menu-item-icon",
                  width: "17",
                  height: "17",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  "aria-hidden": "true",
                },
                React.createElement("path", {
                  d: "M3 10.5 12 3l9 7.5",
                  stroke: "currentColor",
                  strokeWidth: "2.5",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }),
                React.createElement("path", {
                  d: "M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10",
                  stroke: "currentColor",
                  strokeWidth: "2.5",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }),
                React.createElement("path", {
                  d: "M10 21v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5",
                  stroke: "currentColor",
                  strokeWidth: "2.5",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }),
              )
            : null,
        ),
      ),
      legalLinks.length
        ? React.createElement(
            "div",
            { className: "nav-menu-footer" },
            legalLinks.map((item) =>
              React.createElement(
                "a",
                { key: item.href, className: "nav-menu-legal-link", href: item.href, onClick: closeMenu },
                item.label,
              ),
            ),
          )
        : null,
    ),
  );
}
