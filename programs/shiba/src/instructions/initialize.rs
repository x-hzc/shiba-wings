use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken, 
    token::Mint,
    token_2022::Token2022, 
    token_interface::{
        Mint as MintInterface, 
        TokenAccount as TokenAccountInterface,
    }
};

use crate::states::{ClaimAccount, Global};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, 
        payer = user, 
        space = Global::LEN,
        seeds = [b"global".as_ref()],
        bump
    )]
    pub global: Account<'info, Global>,

    #[account(
        init,
        payer = user,
        space = ClaimAccount::LEN,
        seeds = [
            b"claim".as_ref(),
            marketing.key.as_ref(),
        ],
        bump
    )]
    pub marketing_claim: Account<'info, ClaimAccount>,

    #[account(
        init,
        payer = user,
        space = ClaimAccount::LEN,
        seeds = [
            b"claim".as_ref(),
            lp.key.as_ref(),
        ],
        bump
    )]
    pub lp_claim: Account<'info, ClaimAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = token_authority,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccountInterface>,
    
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: This account is not read or written
    #[account(
        seeds = [
            b"token-authority",
        ],
        bump
    )]
    pub token_authority: UncheckedAccount<'info>,

    /// CHECK: This account is not read or written 
    pub marketing: UncheckedAccount<'info>,
    /// CHECK: This account is not read or written 
    pub lp: UncheckedAccount<'info>,

    #[account(
        mint::decimals = 0,
    )]
    pub collection_address: Account<'info, Mint>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, MintInterface>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}


pub fn handle_initialize(ctx: Context<Initialize>) -> Result<()> {
    let global = &mut ctx.accounts.global;
    global.marketing = *ctx.accounts.marketing.key;
    global.lp = *ctx.accounts.lp.key;
    global.collection = ctx.accounts.collection_address.key();
    global.total_released = 0;
    global.token_auth_bump = ctx.bumps.token_authority;

    let marketing_claim = &mut ctx.accounts.marketing_claim;
    marketing_claim.initialize(3500);

    let lp_claim = &mut ctx.accounts.lp_claim;
    lp_claim.initialize(5000);

    Ok(())
}
