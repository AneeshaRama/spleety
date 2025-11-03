import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { PROGRAM_ID, ORACLE_PROGRAM_ID, RPC_ENDPOINT } from './config';
import IDL from './spleety.json';

// Convert wallet to AnchorWallet format
function toAnchorWallet(wallet: WalletContextState, publicKey: PublicKey): any {
  if (!wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error('Wallet does not support required signing methods');
  }

  return {
    publicKey: publicKey,
    signTransaction: wallet.signTransaction.bind(wallet),
    signAllTransactions: wallet.signAllTransactions.bind(wallet),
  };
}

export function getProgram(wallet: WalletContextState, publicKey: PublicKey) {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const anchorWallet = toAnchorWallet(wallet, publicKey);
  const provider = new AnchorProvider(connection, anchorWallet, {
    commitment: 'confirmed',
  });

  return new Program(IDL as any, provider);
}

// Read-only program for fetching data
export function getReadOnlyProgram() {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

  // Create a dummy wallet for read-only operations
  const dummyWallet = {
    publicKey: PROGRAM_ID,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };

  const provider = new AnchorProvider(connection, dummyWallet as any, {
    commitment: 'confirmed',
  });

  return new Program(IDL as any, provider);
}

export function getExpenseGroupPDA(authority: PublicKey, expenseId: string) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('expense'), authority.toBuffer(), Buffer.from(expenseId)],
    PROGRAM_ID
  );
  return pda;
}

export function getParticipantPDA(expenseGroup: PublicKey, participant: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('participant'), expenseGroup.toBuffer(), participant.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export function getOraclePriceFeedPDA() {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('price_feed')],
    ORACLE_PROGRAM_ID
  );
  return pda;
}

export async function createExpense(
  wallet: WalletContextState,
  publicKey: PublicKey,
  expenseId: string,
  title: string,
  totalAmountUsd: number,
  participantCount: number
) {
  const program = getProgram(wallet, publicKey);
  const expenseGroupPda = getExpenseGroupPDA(publicKey, expenseId);

  // Convert USD to micro-dollars (multiply by 1,000,000)
  const totalAmountMicro = Math.floor(totalAmountUsd * 1_000_000);

  const tx = await program.methods
    .createExpense(
      expenseId,
      title,
      new anchor.BN(totalAmountMicro),
      participantCount
    )
    .accountsPartial({
      expenseGroup: expenseGroupPda,
      authority: publicKey,
    })
    .rpc();

  return { tx, expenseGroupPda };
}

export async function joinAndPay(
  wallet: WalletContextState,
  publicKey: PublicKey,
  expenseGroupPda: PublicKey
) {
  const program = getProgram(wallet, publicKey);
  const participantPda = getParticipantPDA(expenseGroupPda, publicKey);
  const oraclePriceFeedPda = getOraclePriceFeedPDA();

  const tx = await program.methods
    .joinAndPay()
    .accountsPartial({
      expenseGroup: expenseGroupPda,
      participantAccount: participantPda,
      participant: publicKey,
      oraclePriceFeed: oraclePriceFeedPda,
      oracleProgram: ORACLE_PROGRAM_ID,
    })
    .rpc();

  return tx;
}

export async function settleExpense(
  wallet: WalletContextState,
  publicKey: PublicKey,
  expenseGroupPda: PublicKey
) {
  const program = getProgram(wallet, publicKey);

  const tx = await program.methods
    .settle()
    .accountsPartial({
      expenseGroup: expenseGroupPda,
      authority: publicKey,
    })
    .rpc();

  return tx;
}

export async function fetchExpenseGroup(expenseGroupPda: PublicKey) {
  const program = getReadOnlyProgram();
  const expenseGroup = await program.account.expenseGroup.fetch(expenseGroupPda);

  return {
    authority: expenseGroup.authority,
    title: expenseGroup.title,
    totalAmountUsd: expenseGroup.totalAmountUsd.toNumber() / 1_000_000,
    participantCount: expenseGroup.participantCount,
    amountPerPersonUsd: expenseGroup.amountPerPersonUsd.toNumber() / 1_000_000,
    paidCount: expenseGroup.paidCount,
    settled: expenseGroup.settled,
    createdAt: expenseGroup.createdAt.toNumber(),
  };
}

export async function fetchParticipant(
  expenseGroupPda: PublicKey,
  participantPubkey: PublicKey
) {
  const program = getReadOnlyProgram();
  const participantPda = getParticipantPDA(expenseGroupPda, participantPubkey);

  try {
    const participant = await program.account.participant.fetch(participantPda);
    return {
      hasPaid: participant.hasPaid,
      paidAmountUsd: participant.paidAmountUsd.toNumber() / 1_000_000,
      paidAmountSol: participant.paidAmountSol.toNumber() / 1_000_000_000,
      paidAt: participant.paidAt.toNumber(),
    };
  } catch {
    return null;
  }
}
