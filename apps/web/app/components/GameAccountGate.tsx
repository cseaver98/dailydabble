"use client";

import type { ReactNode } from "react";
import AuthDialog from "./AuthDialog";

type GameAccountGateProps = {
  gameName: string;
  children: ReactNode;
};

export default function GameAccountGate({ gameName, children }: GameAccountGateProps) {
  return (
    <>
      <div aria-hidden="true">{children}</div>
      <AuthDialog
        isOpen
        onClose={() => {}}
        mode="gate"
        title="Log in or create an account to keep playing"
        subtitle={`You have completed your free games. Log in to play ${gameName} and keep your stats.`}
        dismissible={false}
        backHref="/"
      />
    </>
  );
}
