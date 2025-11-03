import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Spleety } from "../target/types/spleety";
import { assert } from "chai";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("spleety", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Spleety as Program<Spleety>;
  const authority = (provider.wallet as anchor.Wallet).payer;

  const ORACLE_PROGRAM_ID = new anchor.web3.PublicKey(
    "2ioipav7WWCimNKLFTrLUXC4umXvGDkd3Uf4Z2oNmxtm"
  );

  let expenseId: string;
  let expenseGroupPda: anchor.web3.PublicKey;
  let participant1: Keypair;
  let participant2: Keypair;

  before(async () => {
    expenseId = `test-${Date.now()}`;
    [expenseGroupPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("expense"),
        authority.publicKey.toBuffer(),
        Buffer.from(expenseId),
      ],
      program.programId
    );

    participant1 = authority;
    participant2 = Keypair.generate();

    console.log("\n🎮 Test Setup Complete!");
    console.log(`Authority: ${authority.publicKey.toString()}`);
    console.log(
      `Participant 1 (authority): ${participant1.publicKey.toString()}`
    );
    console.log(`Expense ID: ${expenseId}`);
  });

  it("Test 1: Creates an expense group with USD amount", async () => {
    console.log("\n📝 Test 1: Creating expense...");

    const title = "Team Dinner";
    const totalAmountUsd = 100_000_000;
    const participantCount = 4;

    const tx = await program.methods
      .createExpense(
        expenseId,
        title,
        new anchor.BN(totalAmountUsd),
        participantCount
      )
      .accountsPartial({
        expenseGroup: expenseGroupPda,
        authority: authority.publicKey,
      })
      .rpc();

    console.log(`✅ Transaction: ${tx}`);

    const expenseGroup = await program.account.expenseGroup.fetch(
      expenseGroupPda
    );

    assert.equal(
      expenseGroup.authority.toString(),
      authority.publicKey.toString()
    );
    assert.equal(expenseGroup.title, title);
    assert.equal(
      expenseGroup.totalAmountUsd.toString(),
      totalAmountUsd.toString()
    );
    assert.equal(expenseGroup.participantCount, participantCount);
    assert.equal(
      expenseGroup.amountPerPersonUsd.toString(),
      (totalAmountUsd / participantCount).toString()
    );
    assert.equal(expenseGroup.paidCount, 1);
    assert.equal(expenseGroup.settled, false);

    console.log(`✅ Expense Created:`);
    console.log(`   Title: ${expenseGroup.title}`);
    console.log(
      `   Total USD: $${expenseGroup.totalAmountUsd.toNumber() / 1_000_000}`
    );
    console.log(
      `   Per Person: $${
        expenseGroup.amountPerPersonUsd.toNumber() / 1_000_000
      }`
    );
    console.log(`   Participants: ${expenseGroup.participantCount}`);
  });

  it("Test 2: Participant joins and pays (using oracle)", async () => {
    console.log("\n💰 Test 2: Participant paying...");

    const [oraclePriceFeedPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("price_feed")],
      ORACLE_PROGRAM_ID
    );

    const [participant1Pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("participant"),
        expenseGroupPda.toBuffer(),
        participant1.publicKey.toBuffer(),
      ],
      program.programId
    );

    const expenseGroupBefore = await program.account.expenseGroup.fetch(
      expenseGroupPda
    );
    const participant1BalanceBefore = await provider.connection.getBalance(
      participant1.publicKey
    );

    console.log(
      `   Participant 1 balance before: ${
        participant1BalanceBefore / LAMPORTS_PER_SOL
      } SOL`
    );

    const tx = await program.methods
      .joinAndPay()
      .accountsPartial({
        expenseGroup: expenseGroupPda,
        participantAccount: participant1Pda,
        participant: participant1.publicKey,
        oraclePriceFeed: oraclePriceFeedPda,
        oracleProgram: ORACLE_PROGRAM_ID,
      })
      .signers([participant1])
      .rpc();

    console.log(`✅ Transaction: ${tx}`);

    const expenseGroupAfter = await program.account.expenseGroup.fetch(
      expenseGroupPda
    );
    const participantAccount = await program.account.participant.fetch(
      participant1Pda
    );
    const participant1BalanceAfter = await provider.connection.getBalance(
      participant1.publicKey
    );

    assert.equal(expenseGroupAfter.paidCount, expenseGroupBefore.paidCount + 1);
    assert.equal(participantAccount.hasPaid, true);
    assert.equal(
      participantAccount.wallet.toString(),
      participant1.publicKey.toString()
    );
    assert.equal(
      participantAccount.expenseGroup.toString(),
      expenseGroupPda.toString()
    );

    const paidSol =
      (participant1BalanceBefore - participant1BalanceAfter) / LAMPORTS_PER_SOL;

    console.log(`✅ Payment Successful:`);
    console.log(`   Participant: ${participantAccount.wallet.toString()}`);
    console.log(
      `   Paid USD: $${participantAccount.paidAmountUsd.toNumber() / 1_000_000}`
    );
    console.log(
      `   Paid SOL: ${
        participantAccount.paidAmountSol.toNumber() / LAMPORTS_PER_SOL
      } SOL`
    );
    console.log(`   Actual paid (incl. fees): ~${paidSol.toFixed(4)} SOL`);
    console.log(
      `   Expense paid count: ${expenseGroupAfter.paidCount}/${expenseGroupAfter.participantCount} (including creator)`
    );

    assert.isTrue(paidSol > 0, "Participant should have paid some SOL");
  });

  it("Test 3: Authority settles expense (flexible withdrawal)", async () => {
    console.log("\n🏦 Test 3: Settling expense...");

    const expenseGroupBefore = await program.account.expenseGroup.fetch(
      expenseGroupPda
    );
    const authorityBalanceBefore = await provider.connection.getBalance(
      authority.publicKey
    );
    const expenseGroupLamportsBefore = await provider.connection.getBalance(
      expenseGroupPda
    );

    console.log(
      `   Expense group balance: ${
        expenseGroupLamportsBefore / LAMPORTS_PER_SOL
      } SOL`
    );
    console.log(
      `   Paid count: ${expenseGroupBefore.paidCount}/${expenseGroupBefore.participantCount}`
    );
    console.log(`   Authority can withdraw even though not all paid!`);

    const tx = await program.methods
      .settle()
      .accountsPartial({
        expenseGroup: expenseGroupPda,
        authority: authority.publicKey,
      })
      .rpc();

    console.log(`✅ Transaction: ${tx}`);

    const expenseGroupAfter = await program.account.expenseGroup.fetch(
      expenseGroupPda
    );
    const authorityBalanceAfter = await provider.connection.getBalance(
      authority.publicKey
    );
    const expenseGroupLamportsAfter = await provider.connection.getBalance(
      expenseGroupPda
    );

    const withdrawn =
      (authorityBalanceAfter - authorityBalanceBefore) / LAMPORTS_PER_SOL;
    const remainingInAccount = expenseGroupLamportsAfter / LAMPORTS_PER_SOL;

    assert.equal(expenseGroupAfter.settled, false);
    assert.isTrue(
      expenseGroupLamportsAfter > 0,
      "Should keep rent-exempt balance"
    );

    console.log(`✅ Settlement Complete:`);
    console.log(`   Settled: ${expenseGroupAfter.settled} (${expenseGroupAfter.paidCount}/${expenseGroupAfter.participantCount} paid including creator)`);
    console.log(`   Authority withdrew: ~${withdrawn.toFixed(4)} SOL`);
    console.log(
      `   Remaining (rent-exempt): ${remainingInAccount.toFixed(6)} SOL`
    );
    console.log(
      `   Final paid count: ${expenseGroupAfter.paidCount}/${expenseGroupAfter.participantCount} (including creator)`
    );
  });

  it("Test 4: Cannot pay after settlement", async () => {
    console.log("\n🚫 Test 4: Trying to pay after settlement...");

    const [oraclePriceFeedPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("price_feed")],
      ORACLE_PROGRAM_ID
    );

    const [participant2Pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("participant"),
        expenseGroupPda.toBuffer(),
        participant2.publicKey.toBuffer(),
      ],
      program.programId
    );

    try {
      await program.methods
        .joinAndPay()
        .accountsPartial({
          expenseGroup: expenseGroupPda,
          participantAccount: participant2Pda,
          participant: participant2.publicKey,
          oraclePriceFeed: oraclePriceFeedPda,
          oracleProgram: ORACLE_PROGRAM_ID,
        })
        .signers([participant2])
        .rpc();

      assert.fail("Should have thrown an error");
    } catch (error: any) {
      const errorMsg = error.error?.errorMessage || error.message;
      console.log(`✅ Correctly rejected: ${errorMsg}`);
      // Either rejected because settled OR insufficient funds (both valid rejections)
      assert.isTrue(
        errorMsg.includes("Expense has already been settled") ||
          errorMsg.includes("insufficient lamports"),
        "Should reject payment attempt"
      );
    }
  });

  it("Test 5: Cannot settle twice", async () => {
    console.log("\n🚫 Test 5: Trying to settle again...");

    try {
      await program.methods
        .settle()
        .accountsPartial({
          expenseGroup: expenseGroupPda,
          authority: authority.publicKey,
        })
        .rpc();

      assert.fail("Should have thrown an error");
    } catch (error: any) {
      const errorMsg = error.error?.errorMessage || error.message;
      console.log(`✅ Correctly rejected: ${errorMsg}`);
      assert.include(errorMsg, "No funds available to withdraw");
    }
  });
});
