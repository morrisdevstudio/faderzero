import { useEffect, useRef } from 'react';
import landingReferenceHtml from '../../../docs/landing page demo.html?raw';
import landingReferenceCss from './landing-reference.css?inline';

const fontStylesheetUrl = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700;800;900&display=swap';

/** This view mounts the supplied reference document unchanged. */
export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const referenceDocument = new DOMParser().parseFromString(landingReferenceHtml, 'text/html');
    const style = document.createElement('style');
    const fontStylesheet = document.createElement('link');
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer?.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    style.dataset.faderzeroLandingReference = 'true';
    // The app shell has two global properties absent from the reference document.
    // Resetting them prevents those pre-existing rules from changing the reference pixels.
    style.textContent = `${landingReferenceCss}\nhtml { line-height: normal; }\n#root { isolation: auto; }\nbody::before { mask-image: none; }`;
    fontStylesheet.rel = 'stylesheet';
    fontStylesheet.href = fontStylesheetUrl;
    fontStylesheet.dataset.faderzeroLandingReference = 'true';
    document.head.append(style, fontStylesheet);

    document.documentElement.lang = referenceDocument.documentElement.lang;
    document.title = referenceDocument.title;
    const description = document.querySelector('meta[name="description"]') ?? document.head.appendChild(document.createElement('meta'));
    description.setAttribute('name', 'description');
    description.setAttribute('content', referenceDocument.querySelector('meta[name="description"]')?.getAttribute('content') ?? '');

    const root = rootRef.current;
    if (root) {
      root.innerHTML = referenceDocument.body.innerHTML;
      root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((element) => {
        if (observer) observer.observe(element);
        else element.classList.add('is-visible');
      });
    }

    return () => {
      observer?.disconnect();
      style.remove();
      fontStylesheet.remove();
      if (root) root.replaceChildren();
    };
  }, []);

  return <div ref={rootRef} style={{ display: 'contents' }} />;
}
