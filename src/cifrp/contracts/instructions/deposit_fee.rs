use anchor_lang::prelude::*;
use crate::state::CifrpPool;
use crate::errors::CifrpError;
use crate::events::FeeDeposited;

pub fn handler(ctx: Context<DepositFee>, amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    require!(!pool.paused, CifrpError::PoolPaused);
    require!(amount > 0, CifrpError::ArithmeticError);

    let ix = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.payer.key(),
        &ctx.accounts.vault_sol.key(),
        amount,
    );

    anchor_lang::solana_program::program::invoke(
        &ix,
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.vault_sol.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    pool.total_accumulated = pool.total_accumulated.checked_add(amount)
        .ok_or(CifrpError::ArithmeticError)?;

    emit!(FeeDeposited {
        pool: pool.key(),
        amount,
        total_accumulated: pool.total_accumulated,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct DepositFee<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, CifrpPool>,
    #[account(mut)]
    pub vault_sol: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}
