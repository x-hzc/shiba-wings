
use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::{MasterEditionAccount, MetadataAccount},
    token::{Mint, TokenAccount}
};

use crate::{
    states::{ClaimAccount, Global},
    ClaimError
};

#[derive(Accounts)]

pub struct Register<'info> {

    #[account(
        seeds = [
            b"global",
        ],
        bump
    )]
    pub global: Account<'info, Global>,

    #[account(
        init,
        payer = signer,
        space = ClaimAccount::LEN,        
        seeds = [
            b"claim",
            nft_token.key().as_ref(),
        ],
        bump
    )]
    pub claim_account: Account<'info, ClaimAccount>,

    #[account(
        mint::decimals = 0,
        constraint = nft_mint.supply == 1 @ ClaimError::TokenNotNFT,
    )]
    nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = signer,
        constraint = nft_token.amount == 1 @ ClaimError::TokenAccountEmpty
    )]

    nft_token: Account<'info, TokenAccount>,

    #[account(
        constraint = nft_metadata.collection.as_ref().map_or(false, |c| c.verified) @ ClaimError::CollectionNotVerified,
        constraint = nft_metadata.collection.as_ref().map_or(false, |c| c.key == global.collection) @ ClaimError::InvalidCollection
    )]

    nft_metadata: Box<Account<'info, MetadataAccount>>,

    #[account()]
    nft_edition: Box<Account<'info, MasterEditionAccount>>,

    #[account(mut)]
    signer: Signer<'info>,

    pub system_program: Program<'info, System>
}

pub fn handle_register<'info>(ctx: Context<Register<'info>>) -> Result<()> {
    let claim_account = &mut ctx.accounts.claim_account;
    claim_account.initialize(3);
    Ok(())
}