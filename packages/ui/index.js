import React from "react";
import * as Dialog from "@radix-ui/react-dialog";

export function DailydabbleNav({
  subtitle,
  subtitleHref,
  subtitleAsHeading = false,
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
            React.createElement(
              "span",
              { className: "dd-brand-word" },
              React.createElement("span", null, "DailyDabble"),
              React.createElement("span", { className: "dd-brand-plus", "aria-hidden": "true" }, "+"),
            ),
          ),
          subtitle
            ? React.createElement(
                React.Fragment,
                null,
                React.createElement("span", { className: "dd-brand-separator", "aria-hidden": "true" }),
                React.createElement(
                  subtitleAsHeading ? "h1" : "span",
                  { className: "dd-brand-subtitle-heading" },
                  subtitleHref
                    ? React.createElement("a", { className: "dd-brand-subtitle-link", href: subtitleHref }, subtitle)
                    : React.createElement("span", { className: "dd-brand-subtitle" }, subtitle),
                ),
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
  progressSummary = null,
  buttonId,
  menuId,
  buttonAriaLabel = "Open menu",
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [menuTop, setMenuTop] = React.useState(0);
  const menuWrapRef = React.useRef(null);
  const visibleItems = items.filter((item) => !item.hidden);

  React.useEffect(() => {
    const iconSources = Array.from(new Set(visibleItems.map((item) => item.iconSrc).filter(Boolean)));
    const preloadedImages = iconSources.map((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
      return image;
    });
    return () => {
      preloadedImages.length = 0;
    };
  }, [visibleItems]);

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
        progressSummary
          ? React.createElement(
              "div",
              { className: "nav-menu-progress", "aria-label": progressSummary.ariaLabel },
              React.createElement(
                "div",
                { className: "nav-menu-progress-copy" },
                React.createElement("span", null, progressSummary.label || "Today"),
                React.createElement("strong", null, `${progressSummary.completed ?? 0}/${progressSummary.total ?? 0}`),
              ),
              React.createElement(
                "span",
                { className: "nav-menu-progress-track", "aria-hidden": "true" },
                React.createElement("span", {
                  className: "nav-menu-progress-fill",
                  style: {
                    width: `${
                      progressSummary.total
                        ? Math.max(0, Math.min(100, ((progressSummary.completed ?? 0) / progressSummary.total) * 100))
                        : 0
                    }%`,
                  },
                }),
              ),
              progressSummary.progressMessage
                ? React.createElement(
                    "p",
                    { className: "nav-menu-progress-message" },
                    progressSummary.progressMessage,
                  )
                : null,
              progressSummary.completionTitle
                ? React.createElement(
                    "div",
                    { className: "nav-menu-progress-complete" },
                    React.createElement(
                      "div",
                      { className: "nav-menu-progress-complete-title" },
                      React.createElement("span", { className: "nav-menu-progress-check", "aria-hidden": "true" }),
                      React.createElement("strong", null, progressSummary.completionTitle),
                    ),
                    progressSummary.completionMessage
                      ? React.createElement("p", null, progressSummary.completionMessage)
                      : null,
                    progressSummary.completionCountdown ||
                    (progressSummary.completionActionLabel && progressSummary.completionActionHref)
                      ? React.createElement(
                          "div",
                          { className: "nav-menu-progress-footer" },
                          progressSummary.completionCountdown
                            ? React.createElement(
                                "strong",
                                { className: "nav-menu-progress-countdown" },
                                progressSummary.completionCountdown,
                              )
                            : null,
                          progressSummary.completionActionLabel && progressSummary.completionActionHref
                            ? React.createElement(
                                "a",
                                { className: "nav-menu-progress-action", href: progressSummary.completionActionHref },
                                progressSummary.completionActionLabel,
                              )
                            : null,
                        )
                      : null,
                  )
                : null,
            )
          : null,
        React.createElement(
          "div",
          { className: "nav-menu-list" },
          visibleItems.map((item) => {
            const itemContent = [
              item.iconSrc
                ? React.createElement(
                    "span",
                    {
                      key: "icon",
                      className: "nav-menu-item-icon",
                      "aria-hidden": "true",
                      style: item.iconBackground ? { "--dd-menu-item-icon-bg": item.iconBackground } : undefined,
                    },
                    React.createElement("img", {
                      src: item.iconSrc,
                      alt: "",
                      loading: "eager",
                      decoding: "async",
                    }),
                  )
                : null,
              React.createElement(
                "span",
                { key: "copy", className: "nav-menu-item-copy" },
                React.createElement("span", { className: "nav-menu-item-label" }, item.label),
                item.description
                  ? React.createElement("span", { className: "nav-menu-item-description" }, item.description)
                  : null,
              ),
              item.statusLabel
                ? React.createElement(
                    "span",
                    {
                      key: "status",
                      className: `nav-menu-status nav-menu-status-${item.statusTone || "neutral"}`,
                    },
                    React.createElement("span", null, item.statusLabel),
                    item.statusTone === "done"
                      ? React.createElement("span", {
                          className: "nav-menu-status-check",
                          "aria-hidden": "true",
                        })
                      : null,
                  )
                : item.completed
                  ? React.createElement("span", {
                      key: "check",
                      className: "nav-menu-complete-check",
                      "aria-label": "Completed",
                      role: "img",
                    })
                  : null,
            ].filter(Boolean);

            const itemLink = React.createElement(
              Dialog.Close,
              { key: `${item.href}-${item.label}-link`, asChild: true },
              React.createElement(
                "a",
                {
                  id: item.id,
                  className: item.brand ? "nav-menu-item nav-menu-item-brand" : "nav-menu-item",
                  href: item.href,
                  style: item.iconBackground ? { "--dd-menu-item-hover-bg": item.iconBackground } : undefined,
                },
                itemContent,
              ),
            );

            if (!item.archiveHref) {
              return itemLink;
            }

            return React.createElement(
              "div",
              { key: `${item.href}-${item.label}`, className: "nav-menu-game-row" },
              itemLink,
              React.createElement(
                Dialog.Close,
                { asChild: true },
                React.createElement(
                  "a",
                  {
                    className: "nav-menu-archive-link",
                    href: item.archiveHref,
                    "aria-label": `${item.label} archive games`,
                    title: `${item.label} archive games`,
                  },
                  React.createElement(
                    "svg",
                    { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
                    React.createElement("path", {
                      d: "M7 4v3M17 4v3M4.5 9.5h15M6.5 6h11A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9A2.5 2.5 0 0 1 6.5 6Z",
                      stroke: "currentColor",
                      strokeWidth: "2",
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                    }),
                    React.createElement("path", {
                      d: "M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01",
                      stroke: "currentColor",
                      strokeWidth: "2.6",
                      strokeLinecap: "round",
                    }),
                  ),
                ),
              ),
            );
          }),
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
