# Flame Enhancer

A React application powered by Google's Gemini AI for enhancing and processing content.

## Deployment

This app is configured for easy deployment on Vercel.

### Environment Variables

Set the following environment variable in your deployment platform:

- `GEMINI_API_KEY`: Your Google Gemini API key

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