use anchor_lang::prelude::*;

#[account]
pub struct TickInfo {
    pub initialized: bool,
    pub liquidity: u128,
}

impl TickInfo {
    pub const INIT_SPACE: usize = 8 + 16; //(disc + u128);

    pub fn update(&mut self, liquidity_delta: u128) {
        let liquidity_before =  self.liquidity;
        let liquidity_after = liquidity_before.checked_add(liquidity_delta).expect("liquidity overflow");

        if liquidity_before == 0 {
            self.initialized = true;
        }

        self.liquidity = liquidity_after;
    }
}


