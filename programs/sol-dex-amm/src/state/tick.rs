use anchor_lang::prelude::*;

#[account]
pub struct TickInfo {
    pub initialized: bool,
    pub liquidity: u64,
}

impl TickInfo {
    pub const INIT_SPACE: usize = 8 + 16; //(disc + u128);
}


