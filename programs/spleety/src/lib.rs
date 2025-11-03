use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod spleety {
    use super::*;

    
}

#[account]
pub struct ExpenseGroup {
    pub authority: Pubkey,
    pub title: String,
    pub total_amount: u64,
    pub participant_count: u8,
    pub amount_per_person: u64,
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
    pub bump: u8,
}

impl Participant {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 1;
}

