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
// import * as fs from 'fs';
require("dotenv").config();

//************************************************************** */
// const keypair = Keypair.fromSecretKey(bs58.decode("eK5jWERmFedYGd1DvQ9k2oBHPx8nGMt2raDBwbANutRKht2UWT3fxp3hNhUPbKD1pZor6XaFbmxvsi1wGqFXMGa"));
// const secret_array = keypair.secretKey    
//     .toString() //convert secret key to string
//     .split(',') //delimit string by commas and convert to an array of strings
//     .map(value=>Number(value)); //convert string values to numbers inside the array
// console.log("==", secret_array)
// const secret = JSON.stringify(secret_array); //Covert to JSON string

// fs.writeFile('guideSecret.json', secret, 'utf8', function(err) {
//     if (err) throw err;
//     console.log('Wrote secret key to guideSecret.json.');
// });
//************************************************************** */

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
  const payer = userWallet;
  const mintAuthority = userWallet;
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  console.log("mint address : ", mint);

  // Generate keys for transfer fee config authority and withdrawal authority
  const transferFeeConfigAuthority = userWallet;
  const withdrawWithheldAuthority = userWallet; //Keypair.generate();

  // Set the decimals, fee basis points, and maximum fee
  const decimals = 2;
  const feeBasisPoints = 100; // 1%
  const maxFee = BigInt(100);//BigInt(9 * Math.pow(10, decimals)); // 9 tokens

  // Define the amount to be minted and the amount to be transferred, accounting for decimals
  const mintAmount = BigInt(1_000_000 * Math.pow(10, decimals)); // Mint 1,000,000 tokens
  const transferAmount = BigInt(1_000 * Math.pow(10, decimals)); // Transfer 1,000 tokens

  // Calculate the fee for the transfer
  const calcFee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000); // expect 10 fee
  const fee = calcFee > maxFee ? maxFee : calcFee; // expect 9 fee

  // Metadata to store in Mint Account
  const metaData: TokenMetadata = {
    updateAuthority: userWallet.publicKey,
    mint: mint,
    name: "OPOS1",
    symbol: "OPOS1",
    uri: "https://bafkreievpa5j5w7mpbny3gpzvwdckculahwnvzwpnaekns5dvrj7kma5ra.ipfs.nftstorage.link/",
    additionalMetadata: [["description", "Only Possible On Solana"]],
  };

  // Size of MetadataExtension 2 bytes for type, 2 bytes for length
  const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
  // Size of metadata
  const metadataLen = pack(metaData).length;

  // Size of Mint Account with extension
  const pointer_mintlen = getMintLen([ExtensionType.MetadataPointer]);
  const fee_mintLen = getMintLen([ExtensionType.TransferFeeConfig]);
  // Minimum lamports required for Mint Account
  const mintLamports = await connection.getMinimumBalanceForRentExemption(
    pointer_mintlen + metadataExtension + fee_mintLen + metadataLen,
  );

  const mintTransaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint,
      space: pointer_mintlen,
      lamports: mintLamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),

    createInitializeMetadataPointerInstruction(
      mint, // Mint Account address
      userWallet.publicKey, // Authority that can set the metadata address
      mint,// metadata_address, // Account address that holds the metadata
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMintInstruction(
      mint,
      decimals,
      mintAuthority.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    ),

    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
      metadata: mint, //metadata_address, // Account address that holds the metadata
      updateAuthority: userWallet.publicKey, // Authority that can update the metadata
      mint: mint, // Mint Account address
      mintAuthority: mintAuthority.publicKey, // Designated Mint Authority
      name: metaData.name,
      symbol: metaData.symbol,
      uri: metaData.uri,
    }),
    createInitializeTransferFeeConfigInstruction(
      mint,
      transferFeeConfigAuthority.publicKey,
      withdrawWithheldAuthority.publicKey,
      feeBasisPoints,
      maxFee,
      TOKEN_2022_PROGRAM_ID
    ),
    
    // createUpdateFieldInstruction({
    //   programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
    //   metadata: mint, // Account address that holds the metadata
    //   updateAuthority: userWallet.publicKey, // Authority that can update the metadata
    //   field: metaData.additionalMetadata[0][0], // key
    //   value: metaData.additionalMetadata[0][1], // value
    // })
  );
  const newTokenTx = await sendAndConfirmTransaction(
    connection,
    mintTransaction,
    [payer, mintKeypair],
    undefined
  );
  console.log("New Token Created:", txUrl(newTokenTx));

  const mintInfo = await getMint(
    connection,
    mint,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
  // Retrieve and log the metadata pointer state
  const metadataPointer = getMetadataPointerState(mintInfo);
  console.log("\nMetadata Pointer:", JSON.stringify(metadataPointer, null, 2));


  // Step 3 - Mint tokens to Owner
  const owner = Keypair.generate();
  const sourceAccount = await createAssociatedTokenAccountIdempotent(
    connection,
    payer,
    owner.publicKey,
    userWallet.publicKey,
    {},
    TOKEN_2022_PROGRAM_ID
  );
  console.log("================sourceAccount : ", sourceAccount);
  const mintSig = await mintTo(
    connection,
    payer,
    mint,
    sourceAccount,
    mintAuthority,
    mintAmount,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  console.log("Tokens Minted:", txUrl(mintSig));

  // Step 4 - Send Tokens from Owner to a New Account
  const destinationOwner = Keypair.generate();
  const destinationAccount = await createAssociatedTokenAccountIdempotent(connection, payer, mint, destinationOwner.publicKey, {}, TOKEN_2022_PROGRAM_ID);
  const transferSig = await transferCheckedWithFee(
      connection,
      payer,
      sourceAccount,
      mint,
      destinationAccount,
      owner,
      transferAmount,
      decimals,
      fee,
      []
  );
  console.log("Tokens Transfered:", txUrl(transferSig));

  // Step 5 - Fetch Fee Accounts
  const allAccounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
      commitment: 'confirmed',
      filters: [
          {
              memcmp: {
                  offset: 0,
                  bytes: mint.toString(),
              },
          },
      ],
  });

  const accountsToWithdrawFrom: PublicKey[] = [];
  for (const accountInfo of allAccounts) {
      const account = unpackAccount(accountInfo.pubkey, accountInfo.account, TOKEN_2022_PROGRAM_ID);
      const transferFeeAmount = getTransferFeeAmount(account);
      if (transferFeeAmount !== null && transferFeeAmount.withheldAmount > BigInt(0)) {
          accountsToWithdrawFrom.push(accountInfo.pubkey);
      }
  }
  
  // Step 6 - Harvest Fees
  const feeVault = Keypair.generate();
  const feeVaultAccount = await createAssociatedTokenAccountIdempotent(connection, payer, mint, feeVault.publicKey, {}, TOKEN_2022_PROGRAM_ID);

  let withdrawSig1 = await withdrawWithheldTokensFromAccounts(
      connection,
      payer,
      mint,
      feeVaultAccount,//destinationAccount,
      withdrawWithheldAuthority,
      [],
      accountsToWithdrawFrom
  );
  console.log("Withdraw from Accounts:", txUrl(withdrawSig1));

  // // Harvest withheld fees from Token Accounts to Mint Account
  // withdrawSig1 = await harvestWithheldTokensToMint(
  //   connection,
  //   payer, // Transaction fee payer
  //   mint, // Mint Account address
  //   [destinationAccount], // Source Token Accounts for fee harvesting
  //   undefined, // Confirmation options
  //   TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
  // );
  // console.log("Harvest Fee To Mint Account:", txUrl(withdrawSig1));

};

main();
