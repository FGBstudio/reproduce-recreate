# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (PostgreSQL + Edge Functions)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│   IoT Sensors   │────▶│   MQTT Broker   │────▶│  Ingestion Service  │
│ (Energy/Air/H2O)│     │ data.hub.fgb    │     │  (Docker/Node.js)   │
└─────────────────┘     └─────────────────┘     └──────────┬──────────┘
                                                           │
                                                           ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│    Frontend     │◀────│  Edge Functions │◀────│      Supabase       │
│   (React/Vite)  │     │  (devices/ts)   │     │    PostgreSQL       │
└─────────────────┘     └─────────────────┘     └─────────────────────┘
```

## MQTT Ingestion Service

Il servizio di ingestion è completamente indipendente da Lovable e può essere deployato su qualsiasi server Docker.

### Quick Start

```bash
# 1. Vai nella cartella del servizio
cd services/mqtt-ingestion

# 2. Copia e configura le variabili d'ambiente
cp .env.example .env
# Modifica .env con le tue credenziali Supabase e MQTT

# 3. Avvia con Docker
docker-compose up -d

# 4. Verifica che funzioni
curl http://localhost:3001/health
```

### Verifica Dati in Supabase

```sql
-- Raw messages (audit log)
SELECT * FROM mqtt_messages_raw ORDER BY received_at DESC LIMIT 10;

-- Telemetry normalizzata
SELECT ts, metric, value, unit, labels 
FROM telemetry ORDER BY ts DESC LIMIT 20;
```

Per documentazione completa: [`services/mqtt-ingestion/README.md`](services/mqtt-ingestion/README.md)

## Backend Setup

Vedi [`BACKEND_SETUP.md`](BACKEND_SETUP.md) per:
- Configurazione Supabase
- Applicazione migrazioni database
- Deploy Edge Functions
- Scheduled jobs per aggregazione

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
