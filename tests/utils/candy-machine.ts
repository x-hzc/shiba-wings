import { PublicKey, Signer } from "@solana/web3.js";
import {
  Metaplex,
  toBigNumber,
  CreateCandyMachineInput,
  DefaultCandyGuardSettings,
} from "@metaplex-foundation/js";

const NFT_METADATA =
  "https://mfp2m2qzszjbowdjl2vofmto5aq6rtlfilkcqdtx2nskls2gnnsa.arweave.net/YV-mahmWUhdYaV6q4rJu6CHozWVC1CgOd9NkpctGa2Q";

export async function createCollectionNft(
  METAPLEX: Metaplex,
  updateAuthority: Signer
) {
  const { nft: collectionNft } = await METAPLEX.nfts().create({
    name: "Test",
    uri: NFT_METADATA,
    sellerFeeBasisPoints: 0,
    isCollection: true,
    updateAuthority,
  });

  return collectionNft;
}

export async function generateCandyMachine(
  METAPLEX: Metaplex,
  collectionNft: PublicKey,
  owner: Signer
) {
  const candyMachineSettings: CreateCandyMachineInput<DefaultCandyGuardSettings> =
    {
      itemsAvailable: toBigNumber(3), // Collection Size: 3
      sellerFeeBasisPoints: 1000, // 10% Royalties on Collection
      symbol: "DEMO",
      maxEditionSupply: toBigNumber(0), // 0 reproductions of each NFT allowed
      isMutable: true,
      creators: [{ address: owner.publicKey, share: 100 }],
      collection: {
        address: collectionNft, // Can replace with your own NFT or upload a new one
        updateAuthority: owner,
      },
    };
  const { candyMachine } = await METAPLEX.candyMachines().create(
    candyMachineSettings
  );
  return candyMachine;
}

export async function addItems(
  METAPLEX: Metaplex,
  CANDY_MACHINE_ID: PublicKey
) {
  const candyMachine = await METAPLEX.candyMachines().findByAddress({
    address: CANDY_MACHINE_ID,
  });
  const items = [];
  for (let i = 0; i < 3; i++) {
    items.push({
      name: `NFT # ${i + 1}`,
      uri: NFT_METADATA,
    });
  }
  const { response } = await METAPLEX.candyMachines().insertItems(
    {
      candyMachine,
      items: items,
    },
    { commitment: "confirmed" }
  );
}

export async function mintNft(
  METAPLEX: Metaplex,
  CANDY_MACHINE_ID: PublicKey,
  owner: Signer,
  recipient: PublicKey
) {
  const candyMachine = await METAPLEX.candyMachines().findByAddress({
    address: CANDY_MACHINE_ID,
  });
  let { nft, tokenAddress } = await METAPLEX.candyMachines().mint(
    {
      candyMachine,
      collectionUpdateAuthority: owner.publicKey,
      owner: recipient,
    },
    { commitment: "confirmed" }
  );

  return {
    nft,
    tokenAddress,
  };
}
