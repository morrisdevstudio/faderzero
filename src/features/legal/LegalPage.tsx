import { useEffect } from 'react';
import legalNotices from '../../../docs/legal/LEGAL_NOTICES.md?raw';
import privacyPolicy from '../../../docs/legal/PRIVACY_POLICY.md?raw';
import terms from '../../../docs/legal/TERMS_OF_SERVICE.md?raw';
import { getLandingUrl } from '@/utils/domainRouting';

const documents = {
  '/legal-notices': { title: 'Mentions légales / Legal Notices', content: legalNotices },
  '/privacy': { title: 'Politique de confidentialité / Privacy Policy', content: privacyPolicy },
  '/terms': { title: 'Conditions générales d’utilisation / Terms of Service', content: terms },
} as const;

function MarkdownDocument({ content }: { content: string }) {
  return <div className="space-y-4 text-sm leading-7 text-white/75">
    {content.split('\n').map((line, index) => {
      const text = line.replaceAll('**', '');
      if (!text) return null;
      if (text === '---') return <hr key={index} className="border-white/10" />;
      if (text.startsWith('# ')) return <h1 key={index} className="text-3xl font-black tracking-tight text-white sm:text-4xl">{text.slice(2)}</h1>;
      if (text.startsWith('## ')) return <h2 key={index} className="pt-6 text-xl font-black text-white">{text.slice(3)}</h2>;
      if (text.startsWith('### ')) return <h3 key={index} className="pt-3 font-black text-white">{text.slice(4)}</h3>;
      if (text.startsWith('- ')) return <p key={index} className="pl-5 before:mr-2 before:content-['•']">{text.slice(2)}</p>;
      return <p key={index}>{text}</p>;
    })}
  </div>;
}

export function LegalPage() {
  const legalDocument = documents[window.location.pathname as keyof typeof documents] ?? documents['/legal-notices'];
  useEffect(() => { window.document.title = `FaderZero — ${legalDocument.title}`; }, [legalDocument.title]);
  return <main className="min-h-screen bg-[#0c0d10] px-4 py-10 text-white sm:px-6 sm:py-16"><article className="mx-auto max-w-3xl rounded-[1.8rem] border border-white/10 bg-[#12141c] p-6 sm:p-10"><a className="mb-8 inline-flex min-h-11 items-center text-xs font-black uppercase tracking-[.14em] text-rose-300 hover:text-rose-200" href={getLandingUrl('/')}>← FaderZero</a><MarkdownDocument content={legalDocument.content} /></article></main>;
}
