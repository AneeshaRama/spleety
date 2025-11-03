use anchor_lang::prelude::*;
use anchor_lang::system_program;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

declare_id!("34NJCLuWB7FXCw4St5kpSrbx6tK8gdBW2TG8tpaY8Nwh");

pub const SOL_USD_FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
pub const MAXIMUM_PRICE_AGE: u64 = 60;
pub const SLIPPAGE_BPS: u64 = 200;

#[program]
pub mod spleety {
    use super::*;

    pub fn create_expense(
        ctx: Context<CreateExpense>,
        expense_id: [u8; 8],
        title: String,
        total_amount_usd_cents: u64,
        participant_count: u8,
    ) -> Result<()> {
        require!(title.len() > 0 && title.len() <= 50, SpleetyError::InvalidTitle);
        require!(total_amount_usd_cents > 0, SpleetyError::InvalidAmount);
        require!(participant_count >= 2, SpleetyError::InvalidParticipantCount);

        let expense_group = &mut ctx.accounts.expense_group;
        let amount_per_person = total_amount_usd_cents / participant_count as u64;

        expense_group.authority = ctx.accounts.authority.key();
        expense_group.expense_id = expense_id;
        expense_group.title = title;
        expense_group.total_amount_usd_cents = total_amount_usd_cents;
        expense_group.amount_per_person_usd_cents = amount_per_person;
        expense_group.participant_count = participant_count;
        expense_group.paid_count = 0;
        expense_group.total_collected_lamports = 0;
        expense_group.settled = false;
        expense_group.created_at = Clock::get()?.unix_timestamp;
        expense_group.bump = ctx.bumps.expense_group;

        Ok(())
    }

    pub fn join_and_pay(
        ctx: Context<JoinAndPay>,
        lamports_amount: u64,
    ) -> Result<()> {
        let expense_group = &mut ctx.accounts.expense_group;
        let price_update = &ctx.accounts.sol_usd_price_feed;

        require!(!expense_group.settled, SpleetyError::AlreadySettled);

        let clock = Clock::get()?;
        let price = price_update.get_price_no_older_than(
            &clock,
            MAXIMUM_PRICE_AGE,
            &get_feed_id_from_hex(SOL_USD_FEED_ID)?,
        )?;

        require!(price.price > 0, SpleetyError::InvalidPythPrice);

        let sol_price_usd_cents = (price.price as u64 * 100) /
            10u64.pow((-price.exponent) as u32);

        let usd_cents = expense_group.amount_per_person_usd_cents;
        let expected_lamports = (usd_cents * 1_000_000_000) / sol_price_usd_cents;

        let min_lamports = (expected_lamports * (10000 - SLIPPAGE_BPS)) / 10000;
        let max_lamports = (expected_lamports * (10000 + SLIPPAGE_BPS)) / 10000;

        require!(
            lamports_amount >= min_lamports && lamports_amount <= max_lamports,
            SpleetyError::InvalidPaymentAmount
        );

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: expense_group.to_account_info(),
                },
            ),
            lamports_amount,
        )?;

        let participant = &mut ctx.accounts.participant;
        participant.expense_group = expense_group.key();
        participant.wallet = ctx.accounts.payer.key();
        participant.has_paid = true;
        participant.amount_paid_lamports = lamports_amount;
        participant.paid_at = clock.unix_timestamp;
        participant.bump = ctx.bumps.participant;

        expense_group.paid_count += 1;
        expense_group.total_collected_lamports += lamports_amount;

        Ok(())
    }

    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        let expense_group = &mut ctx.accounts.expense_group;

        require!(
            ctx.accounts.authority.key() == expense_group.authority,
            SpleetyError::UnauthorizedSettlement
        );
        require!(!expense_group.settled, SpleetyError::AlreadySettled);

        let total_lamports = expense_group.total_collected_lamports;

        **expense_group.to_account_info().try_borrow_mut_lamports()? -= total_lamports;
        **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += total_lamports;

        expense_group.settled = true;

        Ok(())
    }
}

#[account]
pub struct ExpenseGroup {
    pub authority: Pubkey,
    pub expense_id: [u8; 8],
    pub title: String,
    pub total_amount_usd_cents: u64,
    pub amount_per_person_usd_cents: u64,
    pub participant_count: u8,
    pub paid_count: u8,
    pub total_collected_lamports: u64,
    pub settled: bool,
    pub created_at: i64,
    pub bump: u8,
}

impl ExpenseGroup {
    pub const LEN: usize = 8 + 32 + 8 + 4 + 50 + 8 + 8 + 1 + 1 + 8 + 1 + 8 + 1;
}

#[account]
pub struct Participant {
    pub expense_group: Pubkey,
    pub wallet: Pubkey,
    pub has_paid: bool,
    pub amount_paid_lamports: u64,
    pub paid_at: i64,
    pub bump: u8,
}

impl Participant {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 8 + 1;
}

#[derive(Accounts)]
#[instruction(expense_id: [u8; 8])]
pub struct CreateExpense<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = ExpenseGroup::LEN,
        seeds = [b"expense", authority.key().as_ref(), &expense_id],
        bump
    )]
    pub expense_group: Account<'info, ExpenseGroup>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinAndPay<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub expense_group: Account<'info, ExpenseGroup>,

    #[account(
        init,
        payer = payer,
        space = Participant::LEN,
        seeds = [b"participant", expense_group.key().as_ref(), payer.key().as_ref()],
        bump
    )]
    pub participant: Account<'info, Participant>,

    pub sol_usd_price_feed: Account<'info, PriceUpdateV2>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub expense_group: Account<'info, ExpenseGroup>,
}

#[error_code]
pub enum SpleetyError {
    #[msg("Expense title must be 1-50 characters")]
    InvalidTitle,

    #[msg("Amount must be greater than 0")]
    InvalidAmount,

    #[msg("Must have at least 2 participants")]
    InvalidParticipantCount,

    #[msg("This participant has already paid")]
    AlreadyPaid,

    #[msg("Expense has already been settled")]
    AlreadySettled,

    #[msg("Only the creator can settle this expense")]
    UnauthorizedSettlement,

    #[msg("Pyth price is invalid or negative")]
    InvalidPythPrice,

    #[msg("Payment amount outside acceptable range")]
    InvalidPaymentAmount,
}
