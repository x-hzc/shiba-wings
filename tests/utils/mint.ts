import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getAccount,
  getMint,
  getMintLen,
  getTransferFeeAmount,
  unpackAccount,
  withdrawWithheldTokensFromAccounts,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  Signer,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

export async function createTransferFeeToken({
  mint,
  payer,
  connection,
  mintAuthority,
  transferFeeConfigAuthority,
  withdrawWithheldAuthority,
  decimals,
  feeBasisPoints,
  maxFee,
}: {
  mint: Signer;
  payer: Signer;
  connection: Connection;
  mintAuthority: PublicKey;
  transferFeeConfigAuthority: PublicKey;
  withdrawWithheldAuthority: PublicKey;
  decimals: number;
  feeBasisPoints: number;
  maxFee: bigint;
}) {
  const mintLen = getMintLen([ExtensionType.TransferFeeConfig]);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint.publicKey,
    space: mintLen,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  });

  const initializeTransferFeeConfig =
    createInitializeTransferFeeConfigInstruction(
      mint.publicKey,
      transferFeeConfigAuthority,
      withdrawWithheldAuthority,
      feeBasisPoints,
      maxFee,
      TOKEN_2022_PROGRAM_ID
    );

  const initializeMintInstruction = createInitializeMintInstruction(
    mint.publicKey,
    decimals,
    mintAuthority,
    null,
    TOKEN_2022_PROGRAM_ID
  );

  const transaction = new Transaction().add(
    createAccountInstruction,
    initializeTransferFeeConfig,
    initializeMintInstruction
  );

  const transactionSignature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, mint]
  );

  return transactionSignature;
}

export async function withdrawFeeFromTokenAccounts({
  connection,
  mint,
  destinationTokenAccount,
  withdrawWithheldAuthority,
  payer,
}: {
  connection: Connection;
  mint: PublicKey;
  payer: Signer;
  destinationTokenAccount: PublicKey;
  withdrawWithheldAuthority: PublicKey;
}) {
  const allAccounts = await connection.getProgramAccounts(
    TOKEN_2022_PROGRAM_ID,
    {
      commitment: "confirmed",
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: mint.toString(),
          },
        },
      ],
    }
  );
  const accountsToWithdrawFrom = [];
  for (const accountInfo of allAccounts) {
    const account = unpackAccount(
      accountInfo.pubkey, // Token Account address
      accountInfo.account, // Token Account data
      TOKEN_2022_PROGRAM_ID // Token Extension Program ID
    );

    // Extract transfer fee data from each account
    const transferFeeAmount = getTransferFeeAmount(account);

    // Check if fees are available to be withdrawn
    if (transferFeeAmount !== null && transferFeeAmount.withheldAmount > 0) {
      accountsToWithdrawFrom.push(accountInfo.pubkey); // Add account to withdrawal list
    }
  }

  return await withdrawWithheldTokensFromAccounts(
    connection,
    payer, // Transaction fee payer
    mint, // Mint Account address
    destinationTokenAccount, // Destination account for fee withdrawal
    withdrawWithheldAuthority, // Authority for fee withdrawal
    [], // Additional signers
    accountsToWithdrawFrom, // Token Accounts to withdrawal from
    { commitment: "confirmed" }, // Confirmation options
    TOKEN_2022_PROGRAM_ID // Token Extension Program ID
  );
}

export async function getBalance(
  address: PublicKey,
  connection: Connection
): Promise<[number, number]> {
  const info = await getAccount(
    connection,
    address,
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );
  const amount = Number(info.amount);
  const mintToken = await getMint(
    connection,
    info.mint,
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );
  const balance = amount / 10 ** mintToken.decimals;
  return [balance, mintToken.decimals];
}
