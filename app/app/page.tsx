"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";
import ExpenseSidebar from "@/components/ExpenseSidebar";

export default function Home() {
  const walletContext = useWallet();
  const { connected, publicKey } = walletContext;
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [participants, setParticipants] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !publicKey) return;

    setLoading(true);
    try {
      const expenseId = `expense-${Date.now()}`;
      const { createExpense } = await import("@/lib/anchor");

      console.log("Creating expense with ID:", expenseId);

      const { tx, expenseGroupPda } = await createExpense(
        walletContext,
        publicKey,
        expenseId,
        title,
        parseFloat(amount),
        parseInt(participants)
      );

      console.log("✅ Expense created!");
      console.log("📍 TX signature:", tx);
      console.log("📍 Expense PDA:", expenseGroupPda.toString());

      setToast({
        message: `EXPENSE CREATED! TX: ${tx.slice(0, 8)}...`,
        type: "success",
      });

      setTimeout(() => {
        router.push(`/pay/${expenseId}?creator=${publicKey.toString()}`);
      }, 1500);
    } catch (error: any) {
      console.error("Error creating expense:", error);

      let errorMessage = "UNKNOWN ERROR";

      const errorStr = error.message || error.toString();

      if (
        errorStr.includes("User rejected") ||
        errorStr.includes("User denied")
      ) {
        errorMessage = "TRANSACTION CANCELLED";
      } else if (
        errorStr.includes("insufficient funds") ||
        errorStr.includes("Insufficient")
      ) {
        errorMessage = "INSUFFICIENT SOL FOR TRANSACTION";
      } else if (errorStr.includes("InvalidTitle")) {
        errorMessage = "TITLE TOO LONG (MAX 50 CHARS)";
      } else if (errorStr.includes("InvalidParticipantCount")) {
        errorMessage = "PARTICIPANTS MUST BE 2-10";
      } else if (errorStr.includes("InvalidAmount")) {
        errorMessage = "AMOUNT MUST BE GREATER THAN 0";
      } else {
        errorMessage = "FAILED TO CREATE EXPENSE. TRY AGAIN";
      }

      setToast({
        message: errorMessage,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

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
      <div className="fixed top-0 right-0 z-50 p-6">
        <WalletMultiButton className="!bg-[#0f0f1e] !border-4 !border-[#00ffff] !text-[#00ffff] hover:!bg-[#1a1a2e] !font-['Press_Start_2P'] !text-xs !px-4 !py-3 !rounded-none !shadow-[4px_4px_0px_0px_rgba(0,255,255,1)] hover:!shadow-[6px_6px_0px_0px_rgba(0,255,255,1)] hover:!translate-x-[-2px] hover:!translate-y-[-2px] !transition-all" />
      </div>

      {/* Pixel Stars Background */}
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
        <h1 className="pixel-title text-center mb-4">SPLEETY</h1>

        <p className="text-center text-sm mb-8 text-[#00ffff]">
          SPLIT EXPENSES LIKE A BOSS! 🎮
        </p>

        {/* Create Expense Card */}
        {connected ? (
          <div className="pixel-card pixel-glow">
            <h2 className="text-2xl mb-6 text-center text-[#ffff00]">
              CREATE EXPENSE
            </h2>

            <form onSubmit={handleCreateExpense} className="space-y-6">
              <div>
                <label className="block text-sm mb-2">EXPENSE TITLE</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="DINNER WITH SQUAD"
                  className="pixel-input"
                  required
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-sm mb-2">TOTAL AMOUNT (USD)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                  className="pixel-input"
                  required
                  min="1"
                  step="0.01"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm">PARTICIPANTS</label>
                  <div className="relative">
                    <button
                      type="button"
                      onMouseEnter={() => setShowInfoTooltip(true)}
                      onMouseLeave={() => setShowInfoTooltip(false)}
                      className="w-6 h-6 rounded-full border-2 border-[#00ffff] text-[#00ffff] text-sm flex items-center justify-center hover:bg-[#00ffff] hover:text-[#0f0f1e] transition-all shadow-[0_0_10px_rgba(0,255,255,0.5)] hover:shadow-[0_0_20px_rgba(0,255,255,0.8)] animate-pulse hover:scale-110"
                    >
                      i
                    </button>
                    {showInfoTooltip && (
                      <div className="absolute left-10 top-0 w-80 bg-[#1a1a2e] border-4 border-[#00ffff] p-5 text-sm z-50 shadow-[0_0_30px_rgba(0,255,255,0.5)]">
                        <p className="text-[#00ffff] font-bold mb-3 text-base">💡 INCLUDE YOURSELF!</p>
                        <p className="text-gray-300 mb-3 leading-relaxed">
                          Enter total number of people INCLUDING YOU (the creator).
                        </p>
                        <p className="text-gray-400 mb-3 leading-relaxed">
                          Example: If you + 3 friends, enter <span className="text-[#ffff00] font-bold">4</span>
                        </p>
                        <p className="text-gray-400 leading-relaxed">
                          You don't pay yourself - others pay you their share!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <input
                  type="number"
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  placeholder="4"
                  className="pixel-input"
                  required
                  min="2"
                  max="10"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full pixel-btn pixel-btn-primary pixel-float"
              >
                {loading ? "CREATING..." : "CREATE & GET LINK"}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-gray-400">
              <p>⚡ POWERED BY SOLANA DEVNET ⚡</p>
              <p className="mt-2">ORACLE PRICE: LIVE 🔴</p>
            </div>
          </div>
        ) : (
          <div className="pixel-card text-center">
            <p className="text-2xl mb-4 text-[#ff00ff]">CONNECT WALLET</p>
            <p className="text-sm text-gray-400">
              TO START SPLITTING EXPENSES!
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p className="mt-2">v1.0.0 • DEVNET • RETRO EDITION</p>
        </div>
      </div>
    </div>
  );
}
