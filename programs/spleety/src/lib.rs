use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("34NJCLuWB7FXCw4St5kpSrbx6tK8gdBW2TG8tpaY8Nwh");

const ORACLE_PROGRAM_ID: &str = "2ioipav7WWCimNKLFTrLUXC4umXvGDkd3Uf4Z2oNmxtm";

#[program]
pub mod spleety {
    use super::*;

    pub fn create_expense(
        ctx: Context<CreateExpense>,
        _expense_id: String,
        title: String,
        total_amount_usd: u64,
        participant_count: u8,
    ) -> Result<()> {
        require!(total_amount_usd > 0, ErrorCode::InvalidAmount);
        require!(participant_count >= 2 && participant_count <= 10, ErrorCode::InvalidParticipantCount);
        require!(title.len() <= 50, ErrorCode::TitleTooLong);

        let expense_group = &mut ctx.accounts.expense_group;
        expense_group.authority = ctx.accounts.authority.key();
        expense_group.title = title;
        expense_group.total_amount_usd = total_amount_usd;
        expense_group.participant_count = participant_count;
        expense_group.amount_per_person_usd = total_amount_usd / participant_count as u64;
        expense_group.paid_count = 1;
        expense_group.settled = false;
        expense_group.created_at = Clock::get()?.unix_timestamp;
        expense_group.bump = ctx.bumps.expense_group;

        emit!(ExpenseCreated {
            expense_group: expense_group.key(),
            authority: expense_group.authority,
            title: expense_group.title.clone(),
            total_amount_usd,
            participant_count,
            amount_per_person_usd: expense_group.amount_per_person_usd,
        });

        Ok(())
    }

    pub fn join_and_pay(ctx: Context<JoinAndPay>) -> Result<()> {
        require!(!ctx.accounts.expense_group.settled, ErrorCode::AlreadySettled);
        require!(ctx.accounts.expense_group.paid_count < ctx.accounts.expense_group.participant_count, ErrorCode::AllParticipantsPaid);

        let oracle_data = ctx.accounts.oracle_price_feed.try_borrow_data()?;
        let sol_price_micro = u64::from_le_bytes(
            oracle_data[40..48].try_into().unwrap()
        );

        require!(sol_price_micro > 0, ErrorCode::InvalidOraclePrice);

        let amount_usd_micro = ctx.accounts.expense_group.amount_per_person_usd;
        let sol_amount_lamports = (amount_usd_micro as u128)
            .checked_mul(1_000_000_000)
            .unwrap()
            .checked_div(sol_price_micro as u128)
            .unwrap() as u64;

        let expense_group_key = ctx.accounts.expense_group.key();

        let transfer_accounts = Transfer {
            from: ctx.accounts.participant.to_account_info(),
            to: ctx.accounts.expense_group.to_account_info(),
        };

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_accounts,
        );

        transfer(cpi_context, sol_amount_lamports)?;

        let participant_account = &mut ctx.accounts.participant_account;
        participant_account.expense_group = expense_group_key;
        participant_account.wallet = ctx.accounts.participant.key();
        participant_account.has_paid = true;
        participant_account.paid_at = Clock::get()?.unix_timestamp;
        participant_account.paid_amount_usd = amount_usd_micro;
        participant_account.paid_amount_sol = sol_amount_lamports;
        participant_account.bump = ctx.bumps.participant_account;

        let expense_group = &mut ctx.accounts.expense_group;
        expense_group.paid_count += 1;

        emit!(PaymentMade {
            expense_group: expense_group_key,
            participant: ctx.accounts.participant.key(),
            amount_usd: amount_usd_micro,
            amount_sol: sol_amount_lamports,
            sol_price: sol_price_micro,
        });

        Ok(())
    }

    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        let expense_group = &mut ctx.accounts.expense_group;

        let total_lamports = expense_group.to_account_info().lamports();
        let rent_exempt = Rent::get()?.minimum_balance(expense_group.to_account_info().data_len());
        let withdrawable_amount = total_lamports.saturating_sub(rent_exempt);

        require!(withdrawable_amount > 0, ErrorCode::NoFundsToWithdraw);

        **expense_group.to_account_info().try_borrow_mut_lamports()? -= withdrawable_amount;
        **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += withdrawable_amount;

        if expense_group.paid_count >= expense_group.participant_count {
            expense_group.settled = true;
        }

        emit!(ExpenseSettled {
            expense_group: expense_group.key(),
            authority: expense_group.authority,
            amount_withdrawn: withdrawable_amount,
            paid_count: expense_group.paid_count,
            total_participants: expense_group.participant_count,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(expense_id: String)]
pub struct CreateExpense<'info> {
    #[account(
        init,
        payer = authority,
        space = ExpenseGroup::LEN,
        seeds = [b"expense", authority.key().as_ref(), expense_id.as_bytes()],
        bump
    )]
    pub expense_group: Account<'info, ExpenseGroup>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinAndPay<'info> {
    #[account(mut)]
    pub expense_group: Account<'info, ExpenseGroup>,

    #[account(
        init,
        payer = participant,
        space = Participant::LEN,
        seeds = [b"participant", expense_group.key().as_ref(), participant.key().as_ref()],
        bump
    )]
    pub participant_account: Account<'info, Participant>,

    #[account(mut)]
    pub participant: Signer<'info>,

    /// CHECK: Oracle price feed PDA - validated by seeds and program ownership
    #[account(
        seeds = [b"price_feed"],
        bump,
        seeds::program = oracle_program.key(),
    )]
    pub oracle_price_feed: AccountInfo<'info>,

    /// CHECK: Oracle program ID
    #[account(address = ORACLE_PROGRAM_ID.parse::<Pubkey>().unwrap())]
    pub oracle_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    pub expense_group: Account<'info, ExpenseGroup>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
pub struct ExpenseGroup {
    pub authority: Pubkey,
    pub title: String,
    pub total_amount_usd: u64,
    pub participant_count: u8,
    pub amount_per_person_usd: u64,
    pub paid_count: u8,
    pub settled: bool,
    pub created_at: i64,
    pub bump: u8,
}

impl ExpenseGroup {
    pub const LEN: usize = 8 + 32 + 4 + 50 + 8 + 1 + 8 + 1 + 1 + 8 + 1;
}

#[account]
pub struct Participant {
    pub expense_group: Pubkey,
    pub wallet: Pubkey,
    pub has_paid: bool,
    pub paid_at: i64,
    pub paid_amount_usd: u64,
    pub paid_amount_sol: u64,
    pub bump: u8,
}

impl Participant {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 1;
}

#[event]
pub struct ExpenseCreated {
    pub expense_group: Pubkey,
    pub authority: Pubkey,
    pub title: String,
    pub total_amount_usd: u64,
    pub participant_count: u8,
    pub amount_per_person_usd: u64,
}

#[event]
pub struct PaymentMade {
    pub expense_group: Pubkey,
    pub participant: Pubkey,
    pub amount_usd: u64,
    pub amount_sol: u64,
    pub sol_price: u64,
}

#[event]
pub struct ExpenseSettled {
    pub expense_group: Pubkey,
    pub authority: Pubkey,
    pub amount_withdrawn: u64,
    pub paid_count: u8,
    pub total_participants: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than 0")]
    InvalidAmount,
    #[msg("Participant count must be between 2 and 10")]
    InvalidParticipantCount,
    #[msg("Title cannot exceed 50 characters")]
    TitleTooLong,
    #[msg("Expense has already been settled")]
    AlreadySettled,
    #[msg("All participants have already paid")]
    AllParticipantsPaid,
    #[msg("Invalid oracle price")]
    InvalidOraclePrice,
    #[msg("No funds available to withdraw")]
    NoFundsToWithdraw,
}
