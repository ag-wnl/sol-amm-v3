use std::ops::Sub;

use anchor_lang::prelude::*;
#[account]
pub struct TickInfo {
    pub initialized: bool,
    pub liquidity: u128,
}

impl TickInfo {
    pub const INIT_SPACE: usize = 8 + 1 + 16; // disc + bool + u128

    pub fn update(&mut self, liquidity_delta: u128) {
        let liquidity_before =  self.liquidity;
        let liquidity_after = liquidity_before.checked_add(liquidity_delta).expect("liquidity overflow");

        if liquidity_before == 0 {
            self.initialized = true;
        }

        self.liquidity = liquidity_after;
    }
}

pub const TICKS_PER_ARRAY: usize = 88;
// tick array:
#[account]
pub struct TickArray {
    pub starting_tick_index: i32,
    pub pool: Pubkey,
    pub ticks: [TickInfo; TICKS_PER_ARRAY],
}

impl TickArray {
    pub const INIT_SPACE: usize = 8 + 32 + 4 +  TICKS_PER_ARRAY * TickInfo::INIT_SPACE; // disc + pool + i32 + ticks

    /**
     * formula: starting_index = floor(tick_index / (tick_spacing * TICKS_PER_ARRAY)) * (tick_spacing * TICKS_PER_ARRAY)
     */
    pub fn get_starting_index(tick_index: i32, tick_spacing: u16) -> i32 {
        let array_span = tick_spacing as i32 * TICKS_PER_ARRAY as i32;

        let i = tick_index.div_euclid(array_span);
        i * array_span
    }

    pub fn info_for_tick(&self, tick_index: i32, tick_spacing: u16) -> &TickInfo {
        let offset = (tick_index - self.starting_tick_index).checked_div(tick_spacing as i32).expect("tick index is not aligned to tick spacing");
        &self.ticks[offset as usize]
    }

    pub fn info_for_tick_mutable(&mut self, tick_index: i32, tick_spacing: u16) -> &mut TickInfo {
        let offset = (tick_index - self.starting_tick_index).checked_div(tick_spacing as i32).expect("tick index is not aligned to tick spacing");
        &mut self.ticks[offset as usize]
    }
}


