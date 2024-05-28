mod instructions;
mod states;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("2jf35bawHobk2KBFDnemtR1DJ1e3XzygnuuQupCbBAJP");

#[program]
pub mod shiba {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        handle_initialize(ctx)
    }

    pub fn register(ctx: Context<Register>) -> Result<()> {
        handle_register(ctx)
    }

    pub fn claim_with_nft(ctx: Context<ClaimWithNFT>) -> Result<()> {
        handle_claim_with_nft(ctx)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        handle_claim(ctx)
    }
}

#[error_code]
pub enum ClaimError {
    #[msg("Collection Not Verified")]
    CollectionNotVerified,
    #[msg("Token Account Empty")]
    TokenAccountEmpty,
    #[msg("Invalid Collection")]
    InvalidCollection,
    #[msg("Token Not NFT")]
    TokenNotNFT,
    #[msg("Empty value")]
    EmptyValue,
}
