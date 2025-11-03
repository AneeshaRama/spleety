# Spleety

A decentralized split payments and crypto payroll platform built on Solana. Split bills, track payments, and settle up - all on-chain with full transparency. From expense splitting to payroll management, Spleety handles group payments seamlessly.

## Features

- **Equal Splits**: Automatically divide expenses among participants
- **Real-time Pricing**: SOL/USD conversion using on-chain oracle
- **Transparent**: All payments tracked on Solana blockchain
- **Creator Control**: Only expense creator pays upfront, others pay their share
- **Instant Settlement**: Withdraw collected funds anytime
- **Retro UI**: Pixel-perfect gaming aesthetic

## Tech Stack

**Smart Contract:**
- Anchor Framework (Rust)
- Solana Devnet

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Solana Web3.js
- Wallet Adapter

## Getting Started

### Prerequisites
- Node.js 18+
- Solana CLI
- Anchor Framework

### Installation

1. Clone the repository
```bash
git clone <repo-url>
cd spleety
```

2. Install dependencies
```bash
# Smart contract
anchor build

# Frontend
cd app
npm install
```

3. Deploy smart contract
```bash
anchor deploy --provider.cluster devnet
```

4. Update program ID in frontend
```bash
# Copy deployed program ID to app/lib/config.ts
```

5. Run frontend
```bash
cd app
npm install
npm run dev
```

Visit `http://localhost:3000`

## Usage

1. **Create Expense**: Set title, total amount (USD), and number of participants
2. **Share Link**: Send payment link to participants
3. **Participants Pay**: Each person pays their equal share in SOL
4. **Settle**: Creator withdraws collected funds

## Program Architecture

**Accounts:**
- `ExpenseGroup`: Stores expense details and payment tracking
- `Participant`: Records individual payment status

**Instructions:**
- `create_expense`: Initialize new expense
- `join_and_pay`: Participant pays their share
- `settle`: Creator withdraws funds

## Roadmap

**V2 (Coming Soon):**
- SPL token support (USDC/USDT)
- Unequal splits
- Notes/descriptions
- Recurring payments

**V3 (Future):**
- Crypto payroll features
- Organizations
- Employee management
- Bulk operations
- Payment history & exports

## Contributing

Contributions are welcome! Please open an issue or submit a PR.

## License

MIT

## Contact

Built with ❤️ on Solana

**Creator:** [@AneeshaRama](https://x.com/AneeshaRama)
