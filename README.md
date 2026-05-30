# SimApply

SimApply is an AI-powered Chrome extension that helps job seekers tailor their resumes to specific roles inside a focused side panel. Users can upload a PDF or paste resume text, add a job description, review AI feedback on the original resume, apply guided rewrites, edit the draft, preview changes, and export a refined version.

This project is currently an MVP / prototype. Formatting may shift during editing and export, and AI suggestions are intended to support user judgment, not replace it.

## Features

- Upload a PDF resume or paste resume text
- Add a job description for role-specific feedback
- Review AI highlights on the original uploaded resume
- Get guided rewrite suggestions and editable recommendations
- Edit resume content directly in a side-panel workspace
- Preview the updated resume and export it as PDF

## Tech Stack

- Plasmo
- React
- Tailwind CSS
- `pdfjs-dist`
- `jspdf`
- OpenAI Responses API through a local relay server

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the extension

Create a root `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Default value:

```env
PLASMO_PUBLIC_SIMAPPLY_API_BASE_URL=http://localhost:8787
```

### 3. Configure the relay server

Create a server env file from `server/.env.example`:

```bash
cp server/.env.example server/.env
```

Then add your real OpenAI key:

```env
OPENAI_API_KEY=your_real_openai_secret_key
OPENAI_MODEL=gpt-4o-mini
PORT=8787
```

### 4. Run locally

Start the relay:

```bash
npm run relay:dev
```

In another terminal, start the extension:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run relay:dev
npm run build
npm run package
```

## Environment Variables

Root `.env`:

```env
PLASMO_PUBLIC_SIMAPPLY_API_BASE_URL=http://localhost:8787
```

`server/.env`:

```env
OPENAI_API_KEY=your_real_openai_secret_key
OPENAI_MODEL=gpt-4o-mini
PORT=8787
```

## How It Works

1. The user uploads a resume or pastes resume text.
2. The user optionally adds a job description.
3. SimApply opens a workspace with `Preview`, `Edit`, and `AI Assistant` tabs.
4. The relay sends structured resume/job-description analysis requests to OpenAI.
5. The user reviews suggestions, applies rewrites, edits the resume, and exports a refined version.

## Known Limitations

- Resume formatting may shift during editing, preview, and export.
- AI review is helpful but not perfect; users should still use their own judgment.
- AI usage limits / bring-your-own-key support are planned but not finalized.
- Original PDF highlighting and review coverage are still being refined.

## Roadmap

- Improve PDF review density and line-to-line highlight accuracy
- Add AI usage limits and bring-your-own-key flow
- Deploy the relay server for non-local use
- Improve document fidelity for edited preview/export
- Add a public-facing landing page
