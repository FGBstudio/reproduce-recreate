import { useMemo, useState } from 'react';
import { Search, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLanguage } from '@/contexts/LanguageContext';

interface Faq {
  q: string;
  a: string;
}
interface FaqCategory {
  category: string;
  items: Faq[];
}

const FAQS: Record<'en' | 'it', FaqCategory[]> = {
  en: [
    {
      category: 'Map & Sites',
      items: [
        { q: 'What do the colored pins on the map mean?', a: 'Green pins indicate sites operating within normal ranges, orange flags warnings (e.g. IAQ thresholds or energy anomalies), red marks critical issues such as offline sensors.' },
        { q: 'What does "Configuring" mean?', a: 'Configuring means the site has been provisioned but at least one module (Energy, Air, Water) is still being calibrated. Once data starts flowing reliably, the status switches to Active.' },
        { q: 'Why is a site marked offline?', a: 'A site is considered offline when no telemetry has been received for more than 60 minutes from any of its assigned devices.' },
      ],
    },
    {
      category: 'Scores & Metrics',
      items: [
        { q: 'How is the Overall Performance score calculated?', a: 'Overall Performance is a weighted blend: 80% Energy efficiency, 15% Water usage, 5% Air quality. Each component is normalized 0–100.' },
        { q: 'What is the Environmental Visibility Score (EVS)?', a: 'EVS = (active modules / 3) × 100. It reflects how much of the site you are actually monitoring across Energy, Air and Water.' },
        { q: 'Why does a value appear as "—"?', a: 'We follow a strict no-fake-data policy. When real telemetry is unavailable for the selected period, we show "—" instead of estimated or mocked values.' },
      ],
    },
    {
      category: 'Plans & Upgrades',
      items: [
        { q: 'How do I activate a new module?', a: 'Modules unlock automatically when compatible devices are assigned to your site. To request a paid upgrade, contact your FGB account manager.' },
        { q: 'Can I export reports?', a: 'Yes — every site supports PDF reports with AI-generated diagnoses in your selected language, available from the dashboard header.' },
      ],
    },
  ],
  it: [
    {
      category: 'Mappa e Siti',
      items: [
        { q: 'Cosa significano i pin colorati sulla mappa?', a: 'Verde indica siti che operano nei range normali, arancione segnala warning (es. soglie IAQ o anomalie energia), rosso indica criticità come sensori offline.' },
        { q: 'Cosa vuol dire "Configurazione"?', a: 'Significa che il sito è stato provisionato ma almeno un modulo (Energia, Aria, Acqua) è ancora in calibrazione. Quando i dati arrivano stabilmente lo stato passa ad Attivo.' },
        { q: 'Perché un sito è offline?', a: 'Un sito è considerato offline quando non riceviamo telemetria da più di 60 minuti da alcuno dei suoi dispositivi assegnati.' },
      ],
    },
    {
      category: 'Score e Metriche',
      items: [
        { q: 'Come si calcola l\'Overall Performance?', a: 'È una media pesata: 80% efficienza Energia, 15% uso Acqua, 5% qualità Aria. Ogni componente è normalizzato 0–100.' },
        { q: 'Cos\'è l\'Environmental Visibility Score (EVS)?', a: 'EVS = (moduli attivi / 3) × 100. Riflette quanta parte del sito stai effettivamente monitorando tra Energia, Aria e Acqua.' },
        { q: 'Perché vedo "—" al posto di un valore?', a: 'Seguiamo una policy stretta no-fake-data: quando la telemetria reale non è disponibile per il periodo selezionato mostriamo "—" invece di valori stimati.' },
      ],
    },
    {
      category: 'Piani e Upgrade',
      items: [
        { q: 'Come attivo un nuovo modulo?', a: 'I moduli si sbloccano automaticamente quando vengono assegnati dispositivi compatibili al sito. Per upgrade a pagamento contatta il tuo account manager FGB.' },
        { q: 'Posso esportare i report?', a: 'Sì — ogni sito supporta report PDF con diagnosi AI nella lingua scelta, disponibili dall\'header della dashboard.' },
      ],
    },
  ],
};

export const HelpTab = () => {
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const lang = (language === 'it' ? 'it' : 'en') as 'it' | 'en';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS[lang];
    return FAQS[lang]
      .map(cat => ({
        ...cat,
        items: cat.items.filter(
          it => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q),
        ),
      }))
      .filter(cat => cat.items.length > 0);
  }, [query, lang]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={lang === 'it' ? 'Cerca nelle FAQ…' : 'Search FAQs…'}
          className="pl-9 h-9 text-xs bg-white/5 border-white/10"
        />
      </div>

      <div className="max-h-[320px] overflow-y-auto pr-1 space-y-3">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {lang === 'it' ? 'Nessun risultato.' : 'No results.'}
          </p>
        ) : (
          filtered.map(cat => (
            <div key={cat.category}>
              <p className="px-1 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                {cat.category}
              </p>
              <Accordion type="single" collapsible className="space-y-1">
                {cat.items.map((item, idx) => (
                  <AccordionItem
                    key={idx}
                    value={`${cat.category}-${idx}`}
                    className="border border-white/5 rounded-lg px-3 bg-white/[0.02]"
                  >
                    <AccordionTrigger className="text-xs font-medium hover:no-underline py-2.5 text-left">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-[11px] text-muted-foreground leading-relaxed pb-2.5">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))
        )}
      </div>

      <div className="mt-1 flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--fgb-accent))] to-[hsl(var(--fgb-light))] flex items-center justify-center text-[10px] font-semibold text-white">
            MM
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-foreground">Matteo Martignoni</p>
          <p className="text-[10px] text-muted-foreground">FGB Support · Online</p>
        </div>
        <a
          href="mailto:monitoring@fgb-studio.com"
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-[hsl(var(--fgb-accent))] text-[10px] font-medium text-[hsl(var(--fgb-base))] hover:opacity-90 transition-opacity"
        >
          <Mail className="w-3 h-3" />
          {lang === 'it' ? 'Contatta' : 'Contact'}
        </a>
      </div>
    </div>
  );
};

export default HelpTab;