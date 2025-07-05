use anchor_lang::prelude::*;
use crate::state::{TickArray, Pool};

#[derive(Accounts)]
#[instruction(starting_tick_index: i32)]
pub struct InitializeTickArray<'info> {
    #[account(
        init,
        payer = payer,
        space = TickArray::INIT_SPACE,
        seeds = [
            b"tick_array",
            pool.key().as_ref(),
            &starting_tick_index.to_le_bytes(),
        ],
        bump,
    )]
    pub tick_array: Account<'info, TickArray>,
    
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeTickArray>,
    starting_tick_index: i32,
) -> Result<()> {
    let tick_array = &mut ctx.accounts.tick_array;
    
    tick_array.starting_tick_index = starting_tick_index;
    tick_array.pool = ctx.accounts.pool.key();
    
    for tick in tick_array.ticks.iter_mut() {
        tick.initialized = false;
        tick.liquidity = 0;
    }
    
    Ok(())
}