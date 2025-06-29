use anchor_lang::prelude::*;

#[account]
pub struct PositionInfo {
    pub owner: Pubkey,
    pub tick_lower: i32,
    pub tick_upper: i32,
    pub liquidity: u128,
}

impl PositionInfo {
    pub const INIT_SPACE: usize = 8 + 16; //(disc + u128);

    pub fn update(&mut self, liquidity_delta: u128) -> Result<()> {
        self.liquidity = self.liquidity.checked_add(liquidity_delta).expect("liquidity overflow");
        ;
        Ok(())
    }
}

