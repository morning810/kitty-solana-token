import {
  SystemProgram,
  Keypair,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import {
  DataV2,
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import { Metaplex, UploadMetadataInput } from "@metaplex-foundation/js";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {
  getMetaplexInstance,
  getNetworkConfig,
  uploadMetadata,
} from "../splHelper/helper";
import {
  decimals,
  image,
  isMutable,
  name,
  networkName,
  royalty,
  setMintAddress,
  setMintKeypair,
  symbol,
  totalSupply,
} from "../splHelper/consts";
require("dotenv").config();

/* 
 main function
*/
const main = () => {
    const networkName = !!process.env.NETWORK
    ? process.env.NETWORK
    : "mainnet";
    console.log("", !!process.env.NETWORK);
};

main();
