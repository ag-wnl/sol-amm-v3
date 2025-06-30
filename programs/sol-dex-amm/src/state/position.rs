use anchor_lang::prelude::*;

#[account]
pub struct PositionInfo {
    pub owner: Pubkey,
    pub tick_lower: i32,
    pub tick_upper: i32,
    pub liquidity: u128,
}

impl PositionInfo {
    pub const INIT_SPACE: usize = 8 + 32 + 4 + 4 + 16; // disc + pubkey + i32 + i32 + u128

    pub fn update(&mut self, liquidity_delta: u128) {
        self.liquidity = self.liquidity.checked_add(liquidity_delta).expect("liquidity overflow");
    }
}

