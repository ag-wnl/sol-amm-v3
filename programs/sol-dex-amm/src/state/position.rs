use anchor_lang::prelude::*;

#[account]
pub struct PositionInfo {
    liquidity: u128,
}

impl PositionInfo {
    pub const INIT_SPACE: usize = 8 + 16; //(disc + u128);
}

