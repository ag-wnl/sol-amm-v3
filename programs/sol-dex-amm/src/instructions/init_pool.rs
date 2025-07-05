use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init, 
        payer = payer, 
        space = Pool::INIT_SPACE, 
        seeds = [b"pool", token_0.key().as_ref(), token_1.key().as_ref()], bump)]
    
    pub pool: Account<'info, Pool>,
    /// CHECK: Token mint address used for pool identification in PDA seeds
    pub token_0: AccountInfo<'info>,
    /// CHECK: Token mint address used for pool identification in PDA seeds
    pub token_1: AccountInfo<'info>,


    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializePool>,
    sqrt_price_x96: u128,
    tick: i32,
    tick_spacing: u16,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    
    pool.token_0 = ctx.accounts.token_0.key();
    pool.token_1 = ctx.accounts.token_1.key();
    pool.sqrt_price_x96 = sqrt_price_x96;
    pool.tick = tick;
    pool.tick_spacing = tick_spacing;
    pool.liquidity = 0;
    pool.bump = ctx.bumps.pool;

    Ok(())
}