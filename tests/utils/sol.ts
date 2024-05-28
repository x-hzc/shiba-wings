import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

export const airdrop =
  (connection: Connection) => async (recipient: PublicKey) => {
    const signature = await connection.requestAirdrop(
      recipient,
      2 * LAMPORTS_PER_SOL
    );

    await connection.confirmTransaction(signature, "confirmed");
  };

export function parseNumber(amount: number, decimals: number) {
  return BigInt(amount * 10 ** decimals);
}

export function getGlobal(programId: PublicKey) {
  const [globalAccount] = PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("global")],
    programId
  );
  return globalAccount;
}

export const getClaim = (programId: PublicKey) => (address: PublicKey) => {
  const [claimAccount] = PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("claim"), address.toBuffer()],
    programId
  );
  return claimAccount;
};

export function getTokenAuthority(programId: PublicKey) {
  const [tokenAuthority] = PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("token-authority")],
    programId
  );
  return tokenAuthority;
}

export const getTokenAccount = (
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve: boolean
) =>
  getAssociatedTokenAddressSync(
    mint,
    owner,
    allowOwnerOffCurve,
    TOKEN_2022_PROGRAM_ID
  );
