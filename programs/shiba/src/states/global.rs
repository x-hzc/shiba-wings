use anchor_lang::prelude::*;

#[account]
pub struct Global {
    pub marketing: Pubkey,   // 32
    pub lp: Pubkey,          // 32
    pub collection: Pubkey,  // 32
    pub total_released: u64, //  8
    pub token_auth_bump: u8, //  1
}

impl Global {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1;
    pub const TOTAL_SHARES: usize = 10_000;
}
