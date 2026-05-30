# SimApply OpenAI Relay Setup

SimApply now uses a relay server so your OpenAI secret key stays off the Chrome extension client.

## 1. Configure the extension

Create a root `.env` file from [.env.example](/Users/jessicajeanty/Desktop/simapply-extension/.env.example):

```bash
cp .env.example .env
```

By default, the extension points to:

```env
PLASMO_PUBLIC_SIMAPPLY_API_BASE_URL=http://localhost:8787
```

## 2. Configure the relay server

Create a server env file from [server/.env.example](/Users/jessicajeanty/Desktop/simapply-extension/server/.env.example):

```bash
cp server/.env.example server/.env
```

Then set your real key:

```env
OPENAI_API_KEY=your_real_openai_secret_key
OPENAI_MODEL=gpt-5
PORT=8787
```

## 3. Run both parts locally

Start the relay:

```bash
npm run relay:dev
```

In another terminal, start the extension:

```bash
npx plasmo dev
```

## 4. How it works

- The extension sends `resumeText` and `jobPosting` to `POST /analyze`
- The relay calls OpenAI `Responses API`
- The relay returns structured review data for:
  - match summary
  - match label/tone
  - missing keywords
  - line-by-line review items for the AI overlay

## 5. Production note

For production, deploy the relay server and update:

```env
PLASMO_PUBLIC_SIMAPPLY_API_BASE_URL=https://your-api-domain.com
```

Do not put `OPENAI_API_KEY` in the extension env or client bundle.
