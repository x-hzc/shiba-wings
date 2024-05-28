import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Shiba } from "../target/types/shiba";
import {
  TOKEN_2022_PROGRAM_ID,
  createAccount,
  mintTo,
  transferChecked,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Metaplex, keypairIdentity, Nft } from "@metaplex-foundation/js";
import { assert, expect } from "chai";
import {
  getBalance,
  withdrawFeeFromTokenAccounts,
  createTransferFeeToken,
} from "./utils/mint";
import {
  createCollectionNft,
  generateCandyMachine,
  addItems,
  mintNft,
} from "./utils/candy-machine";
import {
  airdrop,
  getTokenAccount,
  parseNumber,
  getTokenAuthority,
  getGlobal,
  getClaim as uncurriedGetClaim,
} from "./utils/sol";

const { Keypair } = anchor.web3;

describe("shiba", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Shiba as Program<Shiba>;
  const provider = anchor.getProvider();
  const owner = Keypair.generate();
  const marketing = Keypair.generate();
  const lp = Keypair.generate();
  let sourceTokenAccount: PublicKey;
  let destinationTokenAccount: PublicKey;

  const userOne = Keypair.generate();
  const userTwo = Keypair.generate();
  const userThree = Keypair.generate();

  const mintKeypair = Keypair.generate();

  const METAPLEX = Metaplex.make(provider.connection).use(
    keypairIdentity(owner)
  );
  let CANDY_MACHINE_ID: PublicKey;
  let collectionNft: PublicKey;

  let nft1: {
    nft: Nft;
    tokenAddress: PublicKey;
  };
  let nft2: {
    nft: Nft;
    tokenAddress: PublicKey;
  };
  let nft3: {
    nft: Nft;
    tokenAddress: PublicKey;
  };

  const decimals = 2;
  const mintAuthority = owner.publicKey;
  const transferFeeConfigAuthority = owner.publicKey;
  const withdrawWithheldAuthority = owner.publicKey;

  const marketingATA = getTokenAccount(
    mintKeypair.publicKey,
    marketing.publicKey,
    false
  );

  const lpATA = getTokenAccount(mintKeypair.publicKey, lp.publicKey, false);
  const tokenAccount = getTokenAccount(
    mintKeypair.publicKey,
    getTokenAuthority(program.programId),
    true
  );
  const getClaim = uncurriedGetClaim(program.programId);

  before(async () => {
    console.log("/***  ===== AIRDROPS =====  ***/");

    const curriedAirdrop = airdrop(provider.connection);
    await curriedAirdrop(owner.publicKey);
    await curriedAirdrop(userOne.publicKey);
    await curriedAirdrop(userTwo.publicKey);
    await curriedAirdrop(userThree.publicKey);
    await curriedAirdrop(marketing.publicKey);
    await curriedAirdrop(lp.publicKey);

    console.log("/***  ===== CREATE TOKEN =====  ***/");

    const feeBasisPoints = 200;
    const maxFee = parseNumber(1_000_000, decimals);

    await createTransferFeeToken({
      mint: mintKeypair,
      payer: owner,
      connection: program.provider.connection,
      mintAuthority,
      transferFeeConfigAuthority,
      withdrawWithheldAuthority,
      decimals,
      feeBasisPoints,
      maxFee,
    });

    sourceTokenAccount = await createAccount(
      program.provider.connection,
      owner, // Payer to create Token Account
      mintKeypair.publicKey, // Mint Account address
      owner.publicKey, // Token Account owner
      undefined, // Optional keypair, default to Associated Token Account
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID // Token Extension Program ID
    );

    const randomKeypair = new Keypair();

    destinationTokenAccount = await createAccount(
      program.provider.connection,
      owner, // Payer to create Token Account
      mintKeypair.publicKey, // Mint Account address
      randomKeypair.publicKey, // Token Account owner
      undefined, // Optional keypair, default to Associated Token Account
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID // Token Extension Program ID
    );

    const SUPPLY = parseNumber(888_888_888, decimals);

    await mintTo(
      program.provider.connection,
      owner, // Transaction fee payer
      mintKeypair.publicKey, // Mint Account address
      sourceTokenAccount, // Mint to
      mintAuthority, // Mint Authority address
      SUPPLY, // Amount
      undefined, // Additional signers
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID // Token Extension Program ID
    );

    console.log("/***  ===== CREATE NFT =====  ***/");

    collectionNft = (await createCollectionNft(METAPLEX, owner)).address;
    CANDY_MACHINE_ID = (
      await generateCandyMachine(METAPLEX, collectionNft, owner)
    ).address;
    await addItems(METAPLEX, CANDY_MACHINE_ID);

    nft1 = await mintNft(METAPLEX, CANDY_MACHINE_ID, owner, userOne.publicKey);
    nft2 = await mintNft(METAPLEX, CANDY_MACHINE_ID, owner, userTwo.publicKey);
    nft3 = await mintNft(
      METAPLEX,
      CANDY_MACHINE_ID,
      owner,
      userThree.publicKey
    );

    const transferAmount = parseNumber(10_000, decimals);

    await transferChecked(
      program.provider.connection,
      owner,
      sourceTokenAccount,
      mintKeypair.publicKey,
      destinationTokenAccount,
      owner.publicKey,
      transferAmount,
      decimals,
      undefined,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );
  });

  it("should initialize", async () => {
    await program.methods
      .initialize()
      .accounts({
        collectionAddress: collectionNft,
        mint: mintKeypair.publicKey,
        user: owner.publicKey,
        tokenAccount,
        marketing: marketing.publicKey,
        lp: lp.publicKey,
      })
      .signers([owner])
      .rpc();
    const global = await program.account.global.fetch(
      getGlobal(program.programId)
    );
    expect(global.marketing).to.eql(marketing.publicKey);
    expect(global.lp).to.eql(lp.publicKey);
    expect(global.collection).to.eql(collectionNft);
    const marketingClaim = await program.account.claimAccount.fetch(
      getClaim(marketing.publicKey)
    );
    expect(marketingClaim.shares.toString()).to.eql("3500");
    const lpClaim = await program.account.claimAccount.fetch(
      getClaim(lp.publicKey)
    );
    expect(lpClaim.shares.toString()).to.eql("5000");
  });

  it("should only initialize global once", async () => {
    try {
      await program.methods
        .initialize()
        .accounts({
          collectionAddress: collectionNft,
          mint: mintKeypair.publicKey,
          user: owner.publicKey,
          tokenAccount,
          marketing: marketing.publicKey,
          lp: lp.publicKey,
        })
        .signers([owner])
        .rpc();
    } catch (e) {
      assert.ok(e);
    }
  });

  it("should register", async () => {
    await program.methods
      .register()
      .accounts({
        nftMint: nft1.nft.address,
        nftToken: nft1.tokenAddress,
        signer: userOne.publicKey,
        nftMetadata: nft1.nft.metadataAddress,
        nftEdition: nft1.nft.edition.address,
      })
      .signers([userOne])
      .rpc();
    const nftClaim = await program.account.claimAccount.fetch(
      getClaim(nft1.tokenAddress)
    );
    expect(nftClaim.shares.toString()).to.eql("3");
  });

  it("should only register once", async () => {
    try {
      await program.methods
        .register()
        .accounts({
          nftMint: nft1.nft.address,
          nftToken: nft1.tokenAddress,
          signer: userOne.publicKey,
          nftMetadata: nft1.nft.metadataAddress,
          nftEdition: nft1.nft.edition.address,
        })
        .signers([userOne])
        .rpc();
    } catch (e) {
      assert.ok(e);
    }
  });

  it("should claim if marketing or lp", async () => {
    const TAX = 200;

    const [beforeBalance] = await getBalance(
      tokenAccount,
      program.provider.connection
    );

    expect(beforeBalance).to.eql(0);

    await withdrawFeeFromTokenAccounts({
      connection: program.provider.connection,
      mint: mintKeypair.publicKey,
      destinationTokenAccount: tokenAccount,
      withdrawWithheldAuthority,
      payer: owner,
    });

    const [afterWithdraw] = await getBalance(
      tokenAccount,
      program.provider.connection
    );

    expect(afterWithdraw).to.eql(TAX);

    await program.methods
      .claim()
      .accounts({
        tokenAccount,
        claimTokenAccount: marketingATA,
        mint: mintKeypair.publicKey,
        signer: marketing.publicKey,
      })
      .signers([marketing])
      .rpc({
        commitment: "confirmed",
      });

    const [tokenAccountAfterMarketingClaim] = await getBalance(
      tokenAccount,
      program.provider.connection
    );
    const marketingOwed = TAX * 0.35;

    const [marketingBalance] = await getBalance(
      marketingATA,
      program.provider.connection
    );

    expect(tokenAccountAfterMarketingClaim).to.eql(TAX - marketingOwed);
    // 2% tax from transfer
    expect(marketingBalance).to.eql(Number((marketingOwed * 0.98).toFixed(2)));

    await program.methods
      .claim()
      .accounts({
        tokenAccount,
        claimTokenAccount: lpATA,
        mint: mintKeypair.publicKey,
        signer: lp.publicKey,
      })
      .signers([lp])
      .rpc({
        commitment: "confirmed",
      });

    const [tokenAccountAfterLpClaim] = await getBalance(
      tokenAccount,
      program.provider.connection
    );

    const lpOwed = TAX * 0.5;

    const [lpBalance] = await getBalance(lpATA, program.provider.connection);

    expect(tokenAccountAfterLpClaim).to.eql(TAX - marketingOwed - lpOwed);
    // 2% tax from transfer
    expect(lpBalance).to.eql(Number((lpOwed * 0.98).toFixed(2)));
  });

  it("should claim if nft holder", async () => {
    const TAX = 200;

    const [tokenAccountBeforeClaim] = await getBalance(
      tokenAccount,
      program.provider.connection
    );

    expect(tokenAccountBeforeClaim).to.eql(TAX * 0.15);

    await program.methods
      .claimWithNft()
      .accounts({
        claimTokenAccount: getTokenAccount(
          mintKeypair.publicKey,
          userOne.publicKey,
          false
        ),
        tokenAccount: tokenAccount,
        mint: mintKeypair.publicKey,
        nftToken: nft1.tokenAddress,
        nftMint: nft1.nft.address,
        signer: userOne.publicKey,
        nftMetadata: nft1.nft.metadataAddress,
        nftEdition: nft1.nft.edition.address,
      })
      .signers([userOne])
      .rpc({
        commitment: "confirmed",
      });

    const [tokenAccountAfterClaim] = await getBalance(
      tokenAccount,
      program.provider.connection
    );

    const expectedClaimFromNFT = TAX * 0.0003;
    expect(tokenAccountAfterClaim).to.eql(TAX * 0.15 - expectedClaimFromNFT);

    const [userOneBalance] = await getBalance(
      getTokenAccount(mintKeypair.publicKey, userOne.publicKey, false),
      program.provider.connection
    );

    // 2% tax from transfer
    // rounding down but will be accessible from next tax wave
    expect(userOneBalance).to.eql(
      Math.floor(expectedClaimFromNFT * 0.98 * 10 ** decimals) / 10 ** decimals
    );

    await program.methods
      .register()
      .accounts({
        nftMint: nft2.nft.address,
        nftToken: nft2.tokenAddress,
        signer: userTwo.publicKey,
        nftMetadata: nft2.nft.metadataAddress,
        nftEdition: nft2.nft.edition.address,
      })
      .signers([userTwo])
      .rpc({
        commitment: "confirmed",
      });

    await program.methods
      .claimWithNft()
      .accounts({
        claimTokenAccount: getTokenAccount(
          mintKeypair.publicKey,
          userTwo.publicKey,
          false
        ),
        tokenAccount: tokenAccount,
        mint: mintKeypair.publicKey,
        nftToken: nft2.tokenAddress,
        nftMint: nft2.nft.address,
        signer: userTwo.publicKey,
        nftMetadata: nft2.nft.metadataAddress,
        nftEdition: nft2.nft.edition.address,
      })
      .signers([userTwo])
      .rpc({
        commitment: "confirmed",
      });

    const [tokenAccountAfterClaim2] = await getBalance(
      tokenAccount,
      program.provider.connection
    );

    const expectedClaimFromNFT2 = TAX * 0.0003;
    expect(tokenAccountAfterClaim2).to.eql(
      Math.floor(
        (TAX * 0.15 - expectedClaimFromNFT - expectedClaimFromNFT2) *
          10 ** decimals
      ) /
        10 ** decimals
    );

    const [userTwoBalance] = await getBalance(
      getTokenAccount(mintKeypair.publicKey, userTwo.publicKey, false),
      program.provider.connection
    );

    // 2% tax from transfer
    // rounding down but will be accessible from next tax wave
    expect(userTwoBalance).to.eql(
      Math.floor(expectedClaimFromNFT2 * 0.98 * 10 ** decimals) / 10 ** decimals
    );
  });

  it("should consider how much was already withdrawn", async () => {
    const transferAmount = parseNumber(10_000, decimals);
    await transferChecked(
      program.provider.connection,
      owner,
      sourceTokenAccount,
      mintKeypair.publicKey,
      destinationTokenAccount,
      owner.publicKey,
      transferAmount,
      decimals,
      undefined,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    await withdrawFeeFromTokenAccounts({
      connection: program.provider.connection,
      mint: mintKeypair.publicKey,
      destinationTokenAccount: tokenAccount,
      withdrawWithheldAuthority,
      payer: owner,
    });

    const [beforeBalance] = await getBalance(
      marketingATA,
      program.provider.connection
    );

    expect(beforeBalance).to.eql(68.6);

    await program.methods
      .claim()
      .accounts({
        tokenAccount,
        claimTokenAccount: marketingATA,
        mint: mintKeypair.publicKey,
        signer: marketing.publicKey,
      })
      .signers([marketing])
      .rpc({
        commitment: "confirmed",
      });

    const [afterBalance] = await getBalance(
      marketingATA,
      program.provider.connection
    );

    expect(afterBalance).to.eql(138.36);

    await transferChecked(
      program.provider.connection,
      owner,
      sourceTokenAccount,
      mintKeypair.publicKey,
      destinationTokenAccount,
      owner.publicKey,
      transferAmount,
      decimals,
      undefined,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    await withdrawFeeFromTokenAccounts({
      connection: program.provider.connection,
      mint: mintKeypair.publicKey,
      destinationTokenAccount: tokenAccount,
      withdrawWithheldAuthority,
      payer: owner,
    });

    const [beforeBalanceLpATA] = await getBalance(
      lpATA,
      program.provider.connection
    );

    expect(beforeBalanceLpATA).to.eql(98);

    await program.methods
      .claim()
      .accounts({
        tokenAccount,
        claimTokenAccount: lpATA,
        mint: mintKeypair.publicKey,
        signer: lp.publicKey,
      })
      .signers([lp])
      .rpc({
        commitment: "confirmed",
      });

    const [afterBalanceLpATA] = await getBalance(
      lpATA,
      program.provider.connection
    );

    expect(afterBalanceLpATA).to.eql(296.37);
  });

  it("should revert if not nft holder", async () => {
    try {
      await program.methods
        .claimWithNft()
        .accounts({
          claimTokenAccount: getTokenAccount(
            mintKeypair.publicKey,
            userThree.publicKey,
            false
          ),
          tokenAccount: tokenAccount,
          mint: mintKeypair.publicKey,
          nftToken: nft1.tokenAddress,
          nftMint: nft1.nft.address,
          signer: userThree.publicKey,
          nftMetadata: nft1.nft.metadataAddress,
          nftEdition: nft1.nft.edition.address,
        })
        .signers([userThree])
        .rpc();
    } catch (e) {
      assert.ok(e);
    }
  });

  it("should revert if non claimable (either rounding is 0 OR all claimed)", async () => {
    // claim all
    await program.methods
      .claimWithNft()
      .accounts({
        claimTokenAccount: getTokenAccount(
          mintKeypair.publicKey,
          userOne.publicKey,
          false
        ),
        tokenAccount: tokenAccount,
        mint: mintKeypair.publicKey,
        nftToken: nft1.tokenAddress,
        nftMint: nft1.nft.address,
        signer: userOne.publicKey,
        nftMetadata: nft1.nft.metadataAddress,
        nftEdition: nft1.nft.edition.address,
      })
      .signers([userOne])
      .rpc({
        commitment: "confirmed",
      });

    try {
      await program.methods
        .claimWithNft()
        .accounts({
          claimTokenAccount: getTokenAccount(
            mintKeypair.publicKey,
            userOne.publicKey,
            false
          ),
          tokenAccount: tokenAccount,
          mint: mintKeypair.publicKey,
          nftToken: nft1.tokenAddress,
          nftMint: nft1.nft.address,
          signer: userOne.publicKey,
          nftMetadata: nft1.nft.metadataAddress,
          nftEdition: nft1.nft.edition.address,
        })
        .signers([userOne])
        .rpc({
          commitment: "confirmed",
        });
    } catch (e) {
      assert.ok(e);
    }
  });
});
