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

#[account]
pub struct TickArray {
    pub start_tick_index: i32,
    pub bump: u8,
    pub ticks: [TickInfo; TICKS_PER_ARRAY],
}

impl TickArray {
    pub const LEN: usize = 8
        + 4
        + 1
        + 3
        + TICKS_PER_ARRAY * TickInfo::INIT_SPACE;

    
        pub fn pda_seed_bytes(pool: &Pubkey, start_tick_index: i32) -> Vec<Vec<u8>> {
            vec![
                b"tick_array".to_vec(),
                pool.to_bytes().to_vec(),
                start_tick_index.to_le_bytes().to_vec(),
            ]
        }

        pub fn locate(t: i32, spacing: i32) -> (i32, usize) {
        // floor_div to nearest multiple of page size
        let ticks_per_page = (TICKS_PER_ARRAY as i32) * spacing;
        let page = (t.div_euclid(ticks_per_page)) * ticks_per_page;
        let offset = ((t - page) / spacing) as usize;
        (page, offset)
    }       
}


