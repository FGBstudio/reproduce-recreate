-- Audit A2 (nov 2026): contatore giornaliero per le funzioni AI.
-- Le edge functions energy-diagnosis e fingerprint-verdict inoltrano
-- richieste al gateway AI a pagamento con la chiave aziendale: senza un
-- tetto, un singolo account puo' consumare credito senza limite.
--
-- RLS: attiva e SENZA policy — la tabella e' invisibile a anon e
-- authenticated; scrive e legge solo il service role (le funzioni).

CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id uuid NOT NULL,
  day     date NOT NULL,
  fn      text NOT NULL,
  n       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, fn)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ai_usage IS
  'Contatori giornalieri delle chiamate AI per utente (audit A2). RLS senza policy: solo service role.';
