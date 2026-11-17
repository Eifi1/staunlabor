/**
 * The entry of `preview-card.html`: one link-preview card (`?card=sky`,
 * `?card=overview`), in German and light, its previews playing until
 * `scripts/write-previews.mjs` calls `holdStill()`.
 *
 * The dev server serves it and only the script opens it; the build leaves it
 * out (Vite builds `index.html` alone). Two marks on <html> are the script's
 * signals: `data-loaded` once every preview has drawn (none of them still the
 * pending placeholder), `data-held` two frames after they were held, so the
 * picture taken is the held frame and not one on its way to it.
 */

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { changeLanguage, initI18n } from "@/shared/i18n/index";
import { kitLabels } from "@/shared/i18n/kit-labels";
import { queryClient } from "@/shared/state/query-client";
import { KitProviders } from "@/app/kit-providers";
import { EXHIBITS } from "@/features/experiments/exhibits";
import { PreviewCard, type Card } from "@/features/experiments/preview-card";
import "./app.css";

declare global {
  interface Window {
    holdStill?: () => void;
  }
}

const LANGUAGE = "de-CH";

function cardAsked(): Card {
  const asked = new URLSearchParams(window.location.search).get("card") ?? "overview";
  const known = EXHIBITS.some((entry) => entry.path && entry.exhibit === asked);
  if (asked !== "overview" && !known) throw new Error(`no card ${asked}`);
  return asked as Card;
}

/** Whether every still in the card has drawn: an <svg> or <canvas> each, and
 *  no pending placeholder (`aria-busy`) left anywhere in it. */
function drawn(): boolean {
  const card = document.querySelector("[data-card]");
  if (!card || card.querySelector('[aria-busy="true"]')) return false;
  const stills = [...card.querySelectorAll("[data-still]")];
  return stills.length > 0 && stills.every((still) => still.querySelector("svg, canvas"));
}

function Host({ card }: { card: Card }) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    window.holdStill = () => setHeld(true);
    const watch = window.setInterval(() => {
      if (!drawn()) return;
      document.documentElement.dataset.loaded = "true";
      window.clearInterval(watch);
    }, 100);
    return () => window.clearInterval(watch);
  }, []);
  useEffect(() => {
    if (!held) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document.documentElement.dataset.held = "true";
      }),
    );
  }, [held]);
  return <PreviewCard card={card} held={held} />;
}

void initI18n()
  .then(() => changeLanguage(LANGUAGE))
  .then(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <KitProviders labels={kitLabels(LANGUAGE)} locale={LANGUAGE} appName="Staunlabor">
              <Host card={cardAsked()} />
            </KitProviders>
          </QueryClientProvider>
        </BrowserRouter>
      </React.StrictMode>,
    );
  });
