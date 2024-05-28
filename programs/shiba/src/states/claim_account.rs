use anchor_lang::prelude::*;

#[account]
pub struct ClaimAccount {
    pub total_released: u64, //  8
    pub shares: u64,         //  8
}
impl ClaimAccount {
    pub const LEN: usize = 8 + 8 + 8;

    pub fn initialize(&mut self, shares: u64) {
        self.total_released = 0;
        self.shares = shares;
    }
}
