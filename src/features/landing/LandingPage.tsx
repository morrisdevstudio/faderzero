import { useEffect, useRef } from 'react';
import landingReferenceHtml from '../../../docs/landing page demo.html?raw';
import './landing-reference.css';

/** This view mounts the supplied reference document unchanged. */
export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const referenceDocument = new DOMParser().parseFromString(landingReferenceHtml, 'text/html');
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer?.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

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
      if (root) root.replaceChildren();
    };
  }, []);

  return <div ref={rootRef} style={{ display: 'contents' }} />;
}
