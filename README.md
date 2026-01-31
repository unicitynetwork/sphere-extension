# Sphere Wallet — Browser Extension

A Chrome extension wallet for the [Unicity Protocol](https://www.unicity.network/) testnet. Manage UCT tokens, register nametags, and send/receive payments.

## Install from Release

1. Go to the [Releases](../../releases) page and download the latest `sphere-wallet-v*.zip`
2. Unzip the downloaded file
3. Open Chrome and navigate to `chrome://extensions`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked** and select the unzipped folder
6. The Sphere Wallet icon will appear in your toolbar

## Setup

1. Click the Sphere Wallet icon in your toolbar
2. Create a new wallet and set a password
3. **Save your recovery phrase** — this is the only way to restore your wallet
4. Go to **Settings > Network > Configure** and enter your API key
5. Register a nametag so others can send you tokens by name

## Development

```bash
# Install dependencies
npm install

# Dev build (watch mode)
npm run dev

# Production build
npm run build

# Build + zip for distribution
npm run package
```

Load the `dist/` folder as an unpacked extension in `chrome://extensions` for development.

## Supported Tokens (Testnet)

| Symbol | Decimals |
|--------|----------|
| UCT    | 18       |
| USDU   | 6        |
| EURU   | 6        |
| SOL    | 9        |
| BTC    | 8        |
| ETH    | 18       |
| ALPHT  | 8        |
| USDT   | 6        |
| USDC   | 6        |
