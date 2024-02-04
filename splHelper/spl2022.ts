import {
  SystemProgram,
  Keypair,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TYPE_SIZE,
  LENGTH_SIZE,
  getMintLen,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createInitializeTransferFeeConfigInstruction,
  createAssociatedTokenAccountIdempotent,
  mintTo,
  transferCheckedWithFee,
  unpackAccount,
  getTransferFeeAmount,
  withdrawWithheldTokensFromAccounts,
  harvestWithheldTokensToMint,
  createInitializeMetadataPointerInstruction,
  getMint,
  getMetadataPointerState
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";

import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {
  getMetaplexInstance,
  getNetworkConfig,
  txUrl,
  uploadMetadata,
} from "./helper";
import {
  deploySPLToken,
  createNewToken
} from "./create";
// import * as fs from 'fs';
require("dotenv").config();


/*
 main function
*/
const main = async () => {
  const network = getNetworkConfig("devnet");
  const connection = new Connection(network.cluster);
  const secretKey: any = process.env.USER_WALLET;
  const userWallet = Keypair.fromSecretKey(bs58.decode(secretKey));
  console.log("userWallet address: ", userWallet.publicKey.toString());

  // Generate keys for payer, mint authority, and mint
  const payer = userWallet
  const mintAuthority = userWallet;
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  // Generate keys for transfer fee config authority and withdrawal authority
  const transferFeeConfigAuthority = payer;
  const withdrawWithheldAuthority = payer;
  // Generate keys for payer, mint authority, and mint
  const owner = payer;
  const decimals = 6;
  const feeBasisPoints = Number("3.5") * 100; // 3.5%
  const uri = "https://bafkreievpa5j5w7mpbny3gpzvwdckculahwnvzwpnaekns5dvrj7kma5ra.ipfs.nftstorage.link/"
  console.log("Metadata uploaded:", uri);


  const mintAmount = BigInt(Number("30000000") * Math.pow(10, decimals)); // Mint 1,000,000 tokens
  //const maxFee = BigInt(9 * Math.pow(10, decimals)); // 9 tokens
  const maxFee = mintAmount

  // Step 2 - Create a New Token
  const newTokenTx = await createNewToken(
    connection, 
    payer, 
    mintKeypair, 
    mint, 
    decimals, 
    mintAuthority, 
    transferFeeConfigAuthority, 
    withdrawWithheldAuthority, 
    feeBasisPoints, 
    maxFee, 
    "ttt", "$ttt", "description", uri);
  //console.log("New Token Created:", generateExplorerTxUrl(newTokenTx));
  console.log("Token Address:", mint.toBase58());

  // Step 3 - Mint tokens to Owner
  const sourceAccount = await createAssociatedTokenAccountIdempotent(connection, payer, mint, owner.publicKey, {}, TOKEN_2022_PROGRAM_ID);
  const mintSig = await mintTo(connection, payer, mint, sourceAccount, mintAuthority, mintAmount, [], undefined, TOKEN_2022_PROGRAM_ID);
  console.log("Tokens Minted:", txUrl(mintSig));

  return mintKeypair.publicKey.toBase58()
}
main();
