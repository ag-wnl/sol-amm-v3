use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::utils::errors::DexError;

/**
 * Mint - providing liquidity to the pool
 * we jus following uniswap v2 convention
 */

/**
 * if any acc related type errors: check if IdlBuild is generated, 
 * ref: https://solana.stackexchange.com/questions/13180/errore0599-no-associated-item-named-anchor-private-full-path-found-for-st
 * needed this for TokenAccount 
 * 
 * ex: idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]
 */

#[derive(Accounts)]
#[instruction(owner: Pubkey, lower_tick: i32, upper_tick: i32)]
pub struct Mint<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(
        init_if_needed,
        payer = payer,
        space = TickInfo::INIT_SPACE,
        seeds = [
            b"tick",
            pool.key().as_ref(),
            &lower_tick.to_le_bytes(),
        ],
        bump
    )]
    pub tick_lower: Account<'info, TickInfo>,

    #[account(
        init_if_needed,
        payer = payer,
        space = TickInfo::INIT_SPACE,
        seeds = [
            b"tick",
            pool.key().as_ref(),
            &upper_tick.to_le_bytes(),
        ],
        bump
    )]
    pub tick_upper: Account<'info, TickInfo>,

    #[account(
        init_if_needed,
        payer = payer,
        space = PositionInfo::INIT_SPACE,
        seeds = [
            b"position",
            owner.as_ref(),
            &lower_tick.to_le_bytes(),
            &upper_tick.to_le_bytes()
        ],
        bump
    )]
    pub position: Account<'info, PositionInfo>,

    #[account(mut)]
    pub user_token_0: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_1: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_token_0: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_token_1: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    
}

pub fn handler(
    ctx: Context<Mint>,
    owner: Pubkey,
    lower_tick: i32,
    upper_tick: i32,
    amount: u128,
) -> Result<(u64, u64)> {
    require!(
        lower_tick < upper_tick &&
        lower_tick >= MIN_TICK &&
        upper_tick <= MAX_TICK,
        DexError::InvalidTickRange
    );


    require!(amount > 0, DexError::InsufficientInputAmount);

    let pool = &mut ctx.accounts.pool;
    let tick_lower = &mut ctx.accounts.tick_lower;
    let tick_upper = &mut ctx.accounts.tick_upper;
    let position = &mut ctx.accounts.position;

    tick_lower.update(amount);
    tick_upper.update(amount);


    // init a new posn
    if position.owner == Pubkey::default() {
        position.owner = owner;
        position.tick_lower = lower_tick;
        position.tick_upper = upper_tick;
        position.liquidity = amount;
    } else {
        // update existing posn
        position.update(amount);
    }

    // temp hardcode for SOL/USDC pool liquidity:
    let amount_0 = 1_000_000_000u64; // 1 SOL (9 decimals)
    let amount_1 = 150_000_000u64; // 150 USDC (6 decimals, assuming SOL ~$150)

    pool.liquidity = pool.liquidity.checked_add(amount).expect("overflow");
    
    let balance_0_before = ctx.accounts.pool_token_0.amount;
    let balance_1_before = ctx.accounts.pool_token_1.amount;

    if amount_0 > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_0.to_account_info(),
            to: ctx.accounts.pool_token_0.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount_0)?;
    }

    if amount_1 > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_1.to_account_info(),
            to: ctx.accounts.pool_token_1.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount_1)?;
    }

    ctx.accounts.pool_token_0.reload()?;
    ctx.accounts.pool_token_1.reload()?;

    if amount_0 > 0 {
        require!(
            ctx.accounts.pool_token_0.amount >= balance_0_before + amount_0,
            DexError::InsufficientInputAmount
        );
    }
    
    if amount_1 > 0 {
        require!(
            ctx.accounts.pool_token_1.amount >= balance_1_before + amount_1,
            DexError::InsufficientInputAmount
        );
    }
    
    Ok((amount_0, amount_1))
}


