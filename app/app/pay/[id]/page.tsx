'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import Toast from '@/components/Toast';
import ExpenseSidebar from '@/components/ExpenseSidebar';

export default function PayPage() {
  const walletContext = useWallet();
  const { connected, publicKey } = walletContext;
  const params = useParams();
  const searchParams = useSearchParams();
  const expenseId = params.id as string;
  const creatorParam = searchParams.get('creator');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expense, setExpense] = useState<any>(null);
  const [hasUserPaid, setHasUserPaid] = useState(false);
  const [txSignature, setTxSignature] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const paymentLink = typeof window !== 'undefined' ? window.location.href : '';
  const isCreator = publicKey && creatorParam && publicKey.toString() === creatorParam;

  // Fetch expense data from blockchain
  useEffect(() => {
    if (!expenseId || !creatorParam) return;

    const fetchExpense = async () => {
      try {
        const { fetchExpenseGroup, getExpenseGroupPDA, fetchParticipant } = await import('@/lib/anchor');

        let expenseGroupPda;

        // Check if expenseId is a PDA (44 characters, base58) or an expense ID string
        if (expenseId.length === 44 && !expenseId.startsWith('expense-')) {
          // It's a PDA address
          expenseGroupPda = new PublicKey(expenseId);
        } else {
          // It's an expense ID, derive the PDA
          const creatorKey = new PublicKey(creatorParam);
          expenseGroupPda = getExpenseGroupPDA(creatorKey, expenseId);
        }

        const expenseData = await fetchExpenseGroup(expenseGroupPda);

        setExpense({
          ...expenseData,
          pda: expenseGroupPda.toString(),
        });

        if (publicKey) {
          const participantData = await fetchParticipant(expenseGroupPda, publicKey);
          if (participantData) {
            setHasUserPaid(participantData.hasPaid);
          }
        }
      } catch (error) {
        console.error('Error fetching expense:', error);
      } finally {
        setFetching(false);
      }
    };

    fetchExpense();
  }, [expenseId, creatorParam, publicKey]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePay = async () => {
    if (!connected || !publicKey || !creatorParam) return;

    setLoading(true);
    try {
      const { joinAndPay, getExpenseGroupPDA } = await import('@/lib/anchor');

      let expenseGroupPda;

      // Check if expenseId is a PDA or an expense ID string
      if (expenseId.length === 44 && !expenseId.startsWith('expense-')) {
        // It's a PDA address
        expenseGroupPda = new PublicKey(expenseId);
      } else {
        // It's an expense ID, derive the PDA
        const creatorKey = new PublicKey(creatorParam);
        expenseGroupPda = getExpenseGroupPDA(creatorKey, expenseId);
      }

      const tx = await joinAndPay(walletContext, publicKey, expenseGroupPda);

      setTxSignature(tx);
      setHasUserPaid(true);

      console.log('✅ Payment successful!', tx);

      setToast({
        message: `PAYMENT SUCCESSFUL! TX: ${tx.slice(0, 8)}...`,
        type: 'success'
      });

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Error paying:', error);

      let errorMessage = 'UNKNOWN ERROR';

      const errorStr = error.message || error.toString();

      if (errorStr.includes('AlreadyPaid') || errorStr.includes('already paid')) {
        errorMessage = 'YOU ALREADY PAID FOR THIS EXPENSE';
      } else if (errorStr.includes('User rejected') || errorStr.includes('User denied')) {
        errorMessage = 'TRANSACTION CANCELLED';
      } else if (errorStr.includes('insufficient funds') || errorStr.includes('Insufficient')) {
        errorMessage = 'INSUFFICIENT SOL FOR PAYMENT';
      } else if (errorStr.includes('ExpenseSettled') || errorStr.includes('settled')) {
        errorMessage = 'EXPENSE ALREADY SETTLED';
      } else {
        errorMessage = 'PAYMENT FAILED. TRY AGAIN';
      }

      setToast({
        message: errorMessage,
        type: 'error'
      });
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!connected || !publicKey || !isCreator) return;

    setWithdrawing(true);
    try {
      const { settleExpense } = await import('@/lib/anchor');

      let expenseGroupPda;

      if (expenseId.length === 44 && !expenseId.startsWith('expense-')) {
        expenseGroupPda = new PublicKey(expenseId);
      } else {
        const creatorKey = new PublicKey(creatorParam!);
        const { getExpenseGroupPDA } = await import('@/lib/anchor');
        expenseGroupPda = getExpenseGroupPDA(creatorKey, expenseId);
      }

      const tx = await settleExpense(walletContext, publicKey, expenseGroupPda);

      setToast({
        message: `FUNDS WITHDRAWN! TX: ${tx.slice(0, 8)}...`,
        type: 'success'
      });

      setTimeout(() => {
        window.location.reload();
      }, 2000);
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
      setWithdrawing(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="pixel-card">
          <p className="text-2xl text-[#ffff00]">LOADING...</p>
          <p className="text-sm text-gray-400 mt-4">FETCHING FROM BLOCKCHAIN</p>
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="pixel-card text-center">
          <p className="text-2xl text-[#ff0066] mb-4">ERROR!</p>
          <p className="text-sm">EXPENSE NOT FOUND ON CHAIN</p>
          <a href="/" className="inline-block mt-6 pixel-btn pixel-btn-primary">
            ← GO HOME
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
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

      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 p-6">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            {!sidebarOpen && (
              <a
                href="/"
                className="text-4xl text-[#ff00ff] hover:text-[#ff33ff] transition-colors hover:scale-110 transform ml-16 inline-block"
                title="Back to Home"
              >
                ←
              </a>
            )}
          </div>
          <WalletMultiButton className="!bg-[#0f0f1e] !border-4 !border-[#00ffff] !text-[#00ffff] hover:!bg-[#1a1a2e] !font-['Press_Start_2P'] !text-xs !px-4 !py-3 !rounded-none !shadow-[4px_4px_0px_0px_rgba(0,255,255,1)] hover:!shadow-[6px_6px_0px_0px_rgba(0,255,255,1)] hover:!translate-x-[-2px] hover:!translate-y-[-2px] !transition-all" />
        </div>
      </div>

      {/* Stars Background */}
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

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-2xl">
        {/* Title */}
        <h1 className="pixel-title text-center mb-4">
          PAY NOW
        </h1>

        <p className="text-center text-sm mb-8 text-[#00ffff]">
          JOIN THE SQUAD & SPLIT! 🎮
        </p>

        {/* Expense Details Card */}
        <div className="pixel-card pixel-glow mb-6">
          <h2 className="text-2xl mb-6 text-center text-[#ffff00]">
            {expense.title.toUpperCase()}
          </h2>

          <div className="space-y-4 text-sm">
            <div className="flex justify-between border-b-2 border-gray-700 pb-2">
              <span className="text-gray-400">EXPENSE ID:</span>
              <span className="text-[#ff00ff] break-all text-xs">{expenseId}</span>
            </div>

            <div className="flex justify-between border-b-2 border-gray-700 pb-2">
              <span className="text-gray-400">CREATOR:</span>
              <span className="text-[#00ffff] break-all text-xs">{expense.authority.toString().slice(0, 8)}...</span>
            </div>

            <div className="flex justify-between border-b-2 border-gray-700 pb-2">
              <span className="text-gray-400">TOTAL AMOUNT:</span>
              <span className="text-white">${expense.totalAmountUsd.toFixed(2)}</span>
            </div>

            <div className="flex justify-between border-b-2 border-gray-700 pb-2">
              <span className="text-gray-400">PARTICIPANTS:</span>
              <span className="text-white">{expense.participantCount} USERS</span>
            </div>

            <div className="flex justify-between border-b-2 border-gray-700 pb-2">
              <span className="text-gray-400">PAID:</span>
              <span className="text-[#00ff00]">{expense.paidCount}/{expense.participantCount}</span>
            </div>

            <div className="flex justify-between border-b-2 border-gray-700 pb-2">
              <span className="text-gray-400">STATUS:</span>
              <span className={expense.settled ? "text-[#00ff00] font-bold" : "text-[#ffff00]"}>
                {expense.settled ? "✓ SETTLED" : "ACTIVE"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">YOUR SHARE:</span>
              <span className="text-3xl text-[#ffff00]">${expense.amountPerPersonUsd.toFixed(2)}</span>
            </div>
          </div>

          {/* Pay Button - Only show for non-creators */}
          {!isCreator ? (
            <>
              {connected ? (
                hasUserPaid ? (
                  <div className="mt-8 text-center">
                    <div className="pixel-btn pixel-btn-success cursor-not-allowed">
                      ✓ YOU PAID!
                    </div>
                    {txSignature && (
                      <p className="text-xs text-gray-400 mt-4">
                        TX: {txSignature.slice(0, 20)}...
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handlePay}
                    disabled={loading || expense.settled}
                    className="w-full mt-8 pixel-btn pixel-btn-success pixel-float"
                  >
                    {loading ? 'PROCESSING...' : expense.settled ? 'SETTLED!' : 'PAY YOUR SHARE'}
                  </button>
                )
              ) : (
                <div className="mt-8 text-center text-[#ff0066]">
                  ⚠️ CONNECT WALLET TO PAY ⚠️
                </div>
              )}
            </>
          ) : (
            <div className="mt-8 text-center">
              <div className="pixel-card bg-[#1a1a2e] border-2 border-[#ffff00]">
                <p className="text-[#ffff00] text-sm">
                  👑 YOU'RE THE CREATOR
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  You already paid! Others will pay you their share.
                </p>
              </div>
            </div>
          )}

          {/* Share Link Section */}
          <div className="mt-8 pt-6 border-t-2 border-gray-700">
            <p className="text-xs text-gray-400 mb-2 text-center">
              SHARE THIS LINK WITH SQUAD:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={paymentLink}
                readOnly
                className="pixel-input flex-1 text-xs"
              />
              <button
                onClick={handleCopyLink}
                className="pixel-btn pixel-btn-secondary"
              >
                {copied ? '✓' : 'COPY'}
              </button>
            </div>
          </div>
        </div>

        {/* Creator Withdraw Button */}
        {isCreator && (
          <div className="mt-6">
            <button
              onClick={handleWithdraw}
              disabled={withdrawing || expense.settled}
              className="w-full pixel-btn pixel-btn-success"
            >
              {withdrawing ? 'WITHDRAWING...' : expense.settled ? 'ALREADY SETTLED' : '💰 WITHDRAW FUNDS'}
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">
              {expense.paidCount}/{expense.participantCount} USERS PAID
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="pixel-card bg-[#1a1a2e] text-center text-xs mt-6">
          <p className="text-gray-400">
            💡 PRICE IS CALCULATED IN REAL-TIME USING SOL/USD ORACLE
          </p>
          <p className="text-[#00ffff] mt-2">
            YOU PAY IN SOL, EVERYONE GETS FAIR USD VALUE!
          </p>
        </div>
      </div>
    </div>
  );
}
