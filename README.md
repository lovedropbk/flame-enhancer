# Flame Enhancer

A React application powered by OpenAI (gpt-5-mini) for enhancing and processing content.

## Deployment

This app is configured for easy deployment on Vercel.

### Environment Variables

Set the following environment variable in your deployment platform:

- `OPENAI_API_KEY`: Your OpenAI API key

### Vercel environment setup

- Dashboard:
  - Go to your Vercel Project → Settings → Environment Variables
  - Add OPENAI_API_KEY for Production, Preview, and Development
  - Trigger a new deploy to apply changes

- CLI:
  ```bash
  vercel env add OPENAI_API_KEY production
  vercel env add OPENAI_API_KEY preview
  vercel env add OPENAI_API_KEY development
  ```
  Then redeploy your project.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and add your API key:
   ```bash
   cp .env.example .env.local
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Build

```bash
npm run build
```

The built files will be in the `dist` directory.