use anchor_lang::prelude::*;

#[error_code]
pub enum DexError {
    #[msg("Invalid tick range")]
    InvalidTickRange,
    #[msg("Zero liquidity")]
    ZeroLiquidity,
    #[msg("Insufficient input amount")]
    InsufficientInputAmount,
    #[msg("Invalid token mint")]
    InvalidMint,
}