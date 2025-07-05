use anchor_lang::prelude::*;

pub const MIN_TICK: i32 = -887272;
pub const MAX_TICK: i32 = 887272;

#[account]
pub struct Pool {
    pub token_0: Pubkey,
    pub token_1: Pubkey,

    pub sqrt_price_x96: u128,
    pub tick: i32,

    pub liquidity: u128,
    // pda bump:
    pub bump: u8,

    pub tick_spacing: u16,
}

impl Pool {
    pub const INIT_SPACE: usize = 8 + 32 + 32 + 16 + 4 + 16 + 1; // discriminator + 2*Pubkey + u128 + i32 + u128 + u8
}
