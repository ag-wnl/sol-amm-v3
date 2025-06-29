#![allow(unexpected_cfgs)]
#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod utils;

use instructions::*;

declare_id!("ADtE5oQ8waem7ggr2L34TCsn2wmtmYfuEQuNofEUu4S9");

#[program]
pub mod sol_dex_amm {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        sqrt_price_x96: u128,
        tick: i32,
    ) -> Result<()>{
        instructions::init_pool::handler(ctx, sqrt_price_x96, tick)
    }

    pub fn mint(
        ctx: Context<Mint>,
        owner: Pubkey,
        lower_tick: i32,
        upper_tick: i32,
        amount: u128,
    ) -> Result<(u64, u64)> {
        instructions::mint::handler(ctx, owner, lower_tick, upper_tick, amount)
    }
}