'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import Toast from '@/components/Toast';
import ExpenseSidebar from '@/components/ExpenseSidebar';

interface Expense {
  expenseId: string;
  creator: string;
  title: string;
  amount: number;
  participants: number;
  timestamp: number;
  pda: string;
  settled: boolean;
}

export default function ExpensesPage() {
  const walletContext = useWallet();
  const { publicKey } = walletContext;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!publicKey) return;

    const fetchExpenses = async () => {
      setLoading(true);
      try {
        const { getReadOnlyProgram } = await import('@/lib/anchor');

        const program = getReadOnlyProgram();
        const connection = program.provider.connection;

        const discriminator = Buffer.from([126, 142, 10, 132, 157, 84, 19, 217]);
        const bs58 = await import('bs58');

        const accounts = await connection.getProgramAccounts(program.programId, {
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: bs58.default.encode(discriminator),
              },
            },
          ],
        });

        const fetchedExpenses: Expense[] = [];

        for (const { pubkey, account } of accounts) {
          try {
            const data = account.data;
            let offset = 8;

            const authorityBytes = data.slice(offset, offset + 32);
            const authority = new PublicKey(authorityBytes);
            offset += 32;

            if (authority.toString() !== publicKey.toString()) {
              continue;
            }

            const titleLength = data.readUInt32LE(offset);
            offset += 4;
            const title = data.slice(offset, offset + titleLength).toString('utf8');
            offset += titleLength;

            const totalAmountUsdLow = data.readUInt32LE(offset);
            const totalAmountUsdHigh = data.readUInt32LE(offset + 4);
            const totalAmountUsd = (totalAmountUsdHigh * 0x100000000 + totalAmountUsdLow) / 1_000_000;
            offset += 8;

            const participantCount = data.readUInt8(offset);
            offset += 1;

            offset += 8;
            offset += 1;

            const settled = data.readUInt8(offset) !== 0;
            offset += 1;

            const createdAtLow = data.readUInt32LE(offset);
            const createdAtHigh = data.readInt32LE(offset + 4);
            const createdAt = (createdAtHigh * 0x100000000 + createdAtLow) * 1000;

            fetchedExpenses.push({
              expenseId: pubkey.toString(),
              creator: publicKey.toString(),
              title,
              amount: totalAmountUsd,
              participants: participantCount,
              timestamp: createdAt,
              pda: pubkey.toString(),
              settled,
            });
          } catch (err) {
            console.error('Failed to decode account', pubkey.toString(), err);
          }
        }

        fetchedExpenses.sort((a, b) => b.timestamp - a.timestamp);
        setExpenses(fetchedExpenses);
      } catch (error) {
        console.error('Error fetching expenses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [publicKey]);

  const handleWithdraw = async (expense: Expense) => {
    if (!publicKey || !walletContext) return;

    setWithdrawingId(expense.expenseId);

    try {
      const { settleExpense } = await import('@/lib/anchor');
      const expenseGroupPda = new PublicKey(expense.pda);

      const tx = await settleExpense(walletContext, publicKey, expenseGroupPda);

      setToast({
        message: `FUNDS WITHDRAWN SUCCESSFULLY!`,
        type: 'success'
      });
    } catch (error: any) {
      let errorMessage = 'UNKNOWN ERROR';

      const errorStr = error.message || error.toString();

      if (errorStr.includes('NoFundsToWithdraw') || errorStr.includes('No funds')) {
        errorMessage = 'NO FUNDS TO WITHDRAW YET';
      } else if (errorStr.includes('User rejected') || errorStr.includes('User denied')) {
        errorMessage = 'TRANSACTION CANCELLED';
      } else if (errorStr.includes('insufficient funds') || errorStr.includes('Insufficient')) {
        errorMessage = 'INSUFFICIENT SOL FOR TRANSACTION';
      } else if (errorStr.includes('NotExpenseAuthority')) {
        errorMessage = 'ONLY CREATOR CAN WITHDRAW';
      } else {
        errorMessage = 'WITHDRAWAL FAILED. TRY AGAIN';
      }

      setToast({
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleViewExpense = (expense: Expense) => {
    window.location.href = `/pay/${expense.pda}?creator=${expense.creator}`;
  };

  return (
    <div className="min-h-screen p-8">
      {/* Expense Sidebar */}
      <ExpenseSidebar onOpenChange={setSidebarOpen} />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Stars Background */}
      {mounted && (
        <div className="fixed inset-0 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="star"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className={`relative z-10 max-w-7xl mx-auto transition-all duration-300 ${sidebarOpen ? 'ml-80' : ''}`}>
        <h1 className="pixel-title text-center mb-4">
          MY EXPENSES
        </h1>

        <p className="text-center text-sm mb-12 text-[#00ffff]">
          {loading ? 'LOADING...' : `${expenses.length} TOTAL EXPENSES`}
        </p>

        {!publicKey ? (
          <div className="text-center">
            <div className="pixel-card max-w-md mx-auto">
              <p className="text-2xl mb-4 text-[#ff00ff]">CONNECT WALLET</p>
              <p className="text-sm text-gray-400">
                TO VIEW YOUR EXPENSES!
              </p>
            </div>
          </div>
        ) : expenses.length === 0 && !loading ? (
          <div className="text-center">
            <div className="pixel-card max-w-md mx-auto">
              <p className="text-2xl mb-4 text-[#ffff00]">NO EXPENSES YET</p>
              <p className="text-sm text-gray-400 mb-6">
                CREATE ONE TO GET STARTED!
              </p>
              <a
                href="/"
                className="inline-block pixel-btn pixel-btn-primary"
              >
                CREATE EXPENSE
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {expenses.map((expense) => (
              <div
                key={expense.expenseId}
                className="pixel-card bg-[#0f0f1e] border-[#00ffff] hover:border-[#ff00ff] transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl text-[#ffff00] break-words flex-1">
                    {expense.title.toUpperCase()}
                  </h3>
                  {expense.settled && (
                    <span className="ml-2 px-2 py-1 text-xs bg-[#00ff00] text-[#0f0f1e] font-bold border-2 border-[#00ff00]">
                      ✓ SETTLED
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm mb-6">
                  <div className="flex justify-between border-b-2 border-gray-700 pb-2">
                    <span className="text-gray-400">AMOUNT:</span>
                    <span className="text-white text-lg">${expense.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b-2 border-gray-700 pb-2">
                    <span className="text-gray-400">PARTICIPANTS:</span>
                    <span className="text-white">{expense.participants} USERS</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">CREATED:</span>
                    <span className="text-white text-xs">
                      {new Date(expense.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleViewExpense(expense)}
                    className={expense.settled ? "w-full pixel-btn pixel-btn-secondary" : "flex-1 pixel-btn pixel-btn-secondary"}
                  >
                    VIEW
                  </button>
                  {!expense.settled && (
                    <button
                      onClick={() => handleWithdraw(expense)}
                      disabled={withdrawingId === expense.expenseId}
                      className="flex-1 pixel-btn pixel-btn-success disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {withdrawingId === expense.expenseId ? 'WAIT...' : 'WITHDRAW'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
