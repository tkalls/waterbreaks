use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("HR51P2C3CHrw76rdtgM181SdyKSMJmyKn8yZq85eGV6Z");

const MAX_OPTIONS: usize = 3;

#[program]
pub mod water_break {
    use super::*;

    /// Admin creates a new prediction round for the upcoming water break.
    /// `duration_secs` is how long the betting window stays open (e.g. 90).
    pub fn initialize_round(
        ctx: Context<InitializeRound>,
        round_id: u64,
        option_a: String,
        option_b: String,
        option_c: String,
        duration_secs: i64,
    ) -> Result<()> {
        require!(
            option_a.len() <= 32 && option_b.len() <= 32 && option_c.len() <= 32,
            WaterBreakError::OptionTooLong
        );

        let round = &mut ctx.accounts.round;
        round.authority = ctx.accounts.authority.key();
        round.round_id = round_id;
        round.options = [option_a, option_b, option_c];
        round.deadline = Clock::get()?.unix_timestamp + duration_secs;
        round.resolved = false;
        round.winning_option = 255; // sentinel = unresolved
        round.option_pools = [0, 0, 0];
        round.total_pool = 0;
        round.bet_count = 0;
        round.bump = ctx.bumps.round;

        emit!(RoundInitialized {
            round: round.key(),
            round_id,
            deadline: round.deadline,
        });
        Ok(())
    }

    /// Fan stakes `amount` lamports on `option` (0, 1, or 2).
    pub fn place_bet(ctx: Context<PlaceBet>, option: u8, amount: u64) -> Result<()> {
        let round = &mut ctx.accounts.round;
        require!(!round.resolved, WaterBreakError::RoundResolved);
        require!(
            Clock::get()?.unix_timestamp < round.deadline,
            WaterBreakError::BettingClosed
        );
        require!((option as usize) < MAX_OPTIONS, WaterBreakError::InvalidOption);
        require!(amount > 0, WaterBreakError::ZeroAmount);

        // SOL moves straight from the fan's wallet into the round PDA,
        // which doubles as the pool vault. No middleman ever touches it.
        // Anchor 1.0: CpiContext::new takes the program *id* (Pubkey), not its
        // AccountInfo. The from/to AccountInfos travel in the Transfer struct.
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.better.to_account_info(),
                    to: round.to_account_info(),
                },
            ),
            amount,
        )?;

        let bet = &mut ctx.accounts.bet;
        bet.better = ctx.accounts.better.key();
        bet.round = round.key();
        bet.option = option;
        bet.amount = amount;
        bet.claimed = false;
        bet.bump = ctx.bumps.bet;

        round.option_pools[option as usize] = round.option_pools[option as usize]
            .checked_add(amount)
            .ok_or(WaterBreakError::Overflow)?;
        round.total_pool = round
            .total_pool
            .checked_add(amount)
            .ok_or(WaterBreakError::Overflow)?;
        round.bet_count = round
            .bet_count
            .checked_add(1)
            .ok_or(WaterBreakError::Overflow)?;

        emit!(BetPlaced {
            round: round.key(),
            better: bet.better,
            option,
            amount,
            total_pool: round.total_pool,
            bet_count: round.bet_count,
        });
        Ok(())
    }

    /// Admin-only. Locks in the correct outcome once the break ends and the
    /// match resumes. Must be called after the deadline has passed.
    pub fn resolve_round(ctx: Context<ResolveRound>, winning_option: u8) -> Result<()> {
        let round = &mut ctx.accounts.round;
        require!(!round.resolved, WaterBreakError::RoundResolved);
        require!(
            Clock::get()?.unix_timestamp >= round.deadline,
            WaterBreakError::BettingStillOpen
        );
        require!(
            (winning_option as usize) < MAX_OPTIONS,
            WaterBreakError::InvalidOption
        );
        require_keys_eq!(
            ctx.accounts.authority.key(),
            round.authority,
            WaterBreakError::Unauthorized
        );

        round.resolved = true;
        round.winning_option = winning_option;

        emit!(RoundResolved {
            round: round.key(),
            winning_option,
            total_pool: round.total_pool,
            winning_pool: round.option_pools[winning_option as usize],
        });
        Ok(())
    }

    /// Each winner calls this once. Payout is their proportional share of the
    /// entire pool based on how much they staked on the winning option:
    ///   payout = bet.amount * total_pool / option_pools[winning_option]
    /// This is a pull-based claim so it scales to any number of bettors
    /// without one instruction looping over an unbounded account list.
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let round = &ctx.accounts.round;
        let bet = &mut ctx.accounts.bet;

        require!(round.resolved, WaterBreakError::RoundNotResolved);
        require!(!bet.claimed, WaterBreakError::AlreadyClaimed);
        require!(
            bet.option == round.winning_option,
            WaterBreakError::NotAWinner
        );

        let winning_pool = round.option_pools[round.winning_option as usize];
        require!(winning_pool > 0, WaterBreakError::NoWinningPool);

        let payout = (bet.amount as u128)
            .checked_mul(round.total_pool as u128)
            .ok_or(WaterBreakError::Overflow)?
            .checked_div(winning_pool as u128)
            .ok_or(WaterBreakError::Overflow)? as u64;

        bet.claimed = true;

        **round.to_account_info().try_borrow_mut_lamports()? -= payout;
        **ctx
            .accounts
            .better
            .to_account_info()
            .try_borrow_mut_lamports()? += payout;

        emit!(WinningsClaimed {
            round: round.key(),
            better: bet.better,
            payout,
        });
        Ok(())
    }
}

#[account]
pub struct Round {
    pub authority: Pubkey,
    pub round_id: u64,
    pub options: [String; MAX_OPTIONS],
    pub deadline: i64,
    pub resolved: bool,
    pub winning_option: u8,
    pub option_pools: [u64; MAX_OPTIONS],
    pub total_pool: u64,
    pub bet_count: u32,
    pub bump: u8,
}

impl Round {
    pub const MAX_SIZE: usize = 8 // discriminator
        + 32 // authority
        + 8 // round_id
        + (4 + 32) * MAX_OPTIONS // options: String = 4 byte len + up to 32 bytes
        + 8 // deadline
        + 1 // resolved
        + 1 // winning_option
        + 8 * MAX_OPTIONS // option_pools
        + 8 // total_pool
        + 4 // bet_count
        + 1; // bump
}

#[account]
pub struct Bet {
    pub better: Pubkey,
    pub round: Pubkey,
    pub option: u8,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl Bet {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 1 + 8 + 1 + 1;
}

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct InitializeRound<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Round::MAX_SIZE,
        seeds = [b"round", round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub better: Signer<'info>,

    #[account(
        mut,
        seeds = [b"round", round.round_id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,

    #[account(
        init,
        payer = better,
        space = Bet::MAX_SIZE,
        seeds = [b"bet", round.key().as_ref(), better.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, Bet>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveRound<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"round", round.round_id.to_le_bytes().as_ref()],
        bump = round.bump,
        has_one = authority
    )]
    pub round: Account<'info, Round>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub better: Signer<'info>,

    // `mut` is required: claim_winnings debits lamports from this PDA (the vault)
    // via try_borrow_mut_lamports, which fails at runtime on a non-writable account.
    #[account(
        mut,
        seeds = [b"round", round.round_id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,

    #[account(
        mut,
        seeds = [b"bet", round.key().as_ref(), better.key().as_ref()],
        bump = bet.bump,
        has_one = better
    )]
    pub bet: Account<'info, Bet>,
}

#[event]
pub struct RoundInitialized {
    pub round: Pubkey,
    pub round_id: u64,
    pub deadline: i64,
}

#[event]
pub struct BetPlaced {
    pub round: Pubkey,
    pub better: Pubkey,
    pub option: u8,
    pub amount: u64,
    pub total_pool: u64,
    pub bet_count: u32,
}

#[event]
pub struct RoundResolved {
    pub round: Pubkey,
    pub winning_option: u8,
    pub total_pool: u64,
    pub winning_pool: u64,
}

#[event]
pub struct WinningsClaimed {
    pub round: Pubkey,
    pub better: Pubkey,
    pub payout: u64,
}

#[error_code]
pub enum WaterBreakError {
    #[msg("Option label too long (max 32 chars)")]
    OptionTooLong,
    #[msg("This round has already been resolved")]
    RoundResolved,
    #[msg("Betting window has closed for this round")]
    BettingClosed,
    #[msg("Betting window is still open")]
    BettingStillOpen,
    #[msg("Invalid prediction option")]
    InvalidOption,
    #[msg("Stake amount must be greater than zero")]
    ZeroAmount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Only the round authority can resolve it")]
    Unauthorized,
    #[msg("Round has not been resolved yet")]
    RoundNotResolved,
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    #[msg("This bet did not pick the winning option")]
    NotAWinner,
    #[msg("No winning pool to distribute from")]
    NoWinningPool,
}
