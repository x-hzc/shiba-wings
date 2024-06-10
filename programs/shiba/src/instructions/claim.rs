use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{MasterEditionAccount, MetadataAccount},
    token::{Mint, TokenAccount},
    token_2022::Token2022,
    token_interface::{
        transfer_checked, Mint as MintInterface, TokenAccount as TokenAccountInterface,
        TransferChecked,
    },
};

use crate::{
    states::{ClaimAccount, Global},
    ClaimError,
};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        mut,
        seeds = [
            b"global",
        ],
        bump
    )]
    pub global: Account<'info, Global>,

    #[account(
        mut,
        seeds = [
            b"claim",
            signer.key().as_ref(),
        ],
        bump
    )]
    pub claim_account: Account<'info, ClaimAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub claim_token_account: InterfaceAccount<'info, TokenAccountInterface>,

    #[account(mut)]
    pub token_account: InterfaceAccount<'info, TokenAccountInterface>,

    /// CHECK: This account is not read or written
    #[account(
        seeds = [
            b"token-authority",
        ],
        bump=global.token_auth_bump
    )]
    pub token_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, MintInterface>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimWithNFT<'info> {
    #[account(
        mut,
        seeds = [
            b"global",
        ],
        bump
    )]
    pub global: Account<'info, Global>,

    #[account(
        mut,
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

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub claim_token_account: InterfaceAccount<'info, TokenAccountInterface>,

    #[account(mut)]
    pub token_account: InterfaceAccount<'info, TokenAccountInterface>,

    /// CHECK: This account is not read or written
    #[account(
        seeds = [
            b"token-authority",
        ],
        bump=global.token_auth_bump
    )]
    pub token_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, MintInterface>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

fn transfer_owed<'info>(
    global: &mut Account<'info, Global>,
    claim_account: &mut Account<'info, ClaimAccount>,
    token_account: &mut InterfaceAccount<'info, TokenAccountInterface>,
    claim_token_account: &mut InterfaceAccount<'info, TokenAccountInterface>,
    token_authority: &UncheckedAccount<'info>,
    mint: &InterfaceAccount<'info, MintInterface>,
    token_program: &Program<'info, Token2022>,
) -> Result<()> {
    let released_so_far = global.total_released;
    let current_balance = token_account.amount;
    let total = released_so_far + current_balance;

    let total_value = total * claim_account.shares / (Global::TOTAL_SHARES as u64);
    let total_released_by_claim = claim_account.total_released;

    let owed = total_value - total_released_by_claim;
    require!(owed > 0, ClaimError::EmptyValue);

    global.total_released += owed;
    claim_account.total_released += owed;

    let cpi_program = token_program.to_account_info();
    let cpi_accounts = TransferChecked {
        from: token_account.to_account_info(),
        mint: mint.to_account_info(),
        to: claim_token_account.to_account_info(),
        authority: token_authority.to_account_info(),
    };

    let authority_seed: &[&[&[u8]]] = &[&[&b"token-authority"[..], &[global.token_auth_bump]]];
    transfer_checked(
        CpiContext::new(cpi_program, cpi_accounts).with_signer(authority_seed),
        owed,
        mint.decimals,
    )
}

pub fn handle_claim(ctx: Context<Claim>) -> Result<()> {
    transfer_owed(
        &mut ctx.accounts.global,
        &mut ctx.accounts.claim_account,
        &mut ctx.accounts.token_account,
        &mut ctx.accounts.claim_token_account,
        &ctx.accounts.token_authority,
        &ctx.accounts.mint,
        &ctx.accounts.token_program,
    )?;

    Ok(())
}

pub fn handle_claim_with_nft(ctx: Context<ClaimWithNFT>) -> Result<()> {
    transfer_owed(
        &mut ctx.accounts.global,
        &mut ctx.accounts.claim_account,
        &mut ctx.accounts.token_account,
        &mut ctx.accounts.claim_token_account,
        &ctx.accounts.token_authority,
        &ctx.accounts.mint,
        &ctx.accounts.token_program,
    )?;

    Ok(())
}
