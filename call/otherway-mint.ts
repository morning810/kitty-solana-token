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
  harvestWithheldTokensToMint
} from "@solana/spl-token";
import {
  DataV2,
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  bundlrStorage,
  keypairIdentity,
  Metaplex,
  UploadMetadataInput,
} from "@metaplex-foundation/js";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {
  getMetaplexInstance,
  getNetworkConfig,
  txUrl,
  uploadMetadata,
} from "../splHelper/helper";
require("dotenv").config();

const METADATA_2022_PROGRAM_ID = new PublicKey("META4s4fSmpkTbZoUsgC1oBnWB31vQcmnN8giPw51Zu")
const METADATA_2022_PROGRAM_ID_TESTNET = new PublicKey("M1tgEZCz7fHqRAR3G5RLxU6c6ceQiZyFK7tzzy4Rof4")

function metadataProgram(connection: Connection): PublicKey {
  const isDevnet = connection.rpcEndpoint.indexOf("devnet") > -1;
  return isDevnet ? METADATA_2022_PROGRAM_ID_TESTNET : METADATA_2022_PROGRAM_ID
}

async function createNewToken(connection: Connection, payer: Keypair, mintKeypair: Keypair, mint: PublicKey, decimals: number, mintAuthority: Keypair, transferFeeConfigAuthority: Keypair, withdrawWithheldAuthority: Keypair, feeBasisPoints: number, maxFee: bigint, image: any, name: string, symbol: string, description: string, uri: string): Promise<string> {
  let tx = ""
  try {
      // Define the extensions to be used by the mint
      const extensions = [
          ExtensionType.TransferFeeConfig,
      ];

      //Create token metadata
      const [metadataPDA] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), metadataProgram(connection).toBuffer(), mint.toBuffer()], metadataProgram(connection))

      const ON_CHAIN_METADATA = {
          name: name,
          symbol: symbol,
          uri: uri,
          sellerFeeBasisPoints: feeBasisPoints,
          uses: null,
          creators: null,
          collection: null,
      } as DataV2;

      // Calculate the length of the mint
      const mintLen = getMintLen(extensions);
      const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);
      const mintTransaction = new Transaction().add(
          SystemProgram.createAccount({
              fromPubkey: payer.publicKey,
              newAccountPubkey: mint,
              space: mintLen,
              lamports: mintLamports,
              programId: TOKEN_2022_PROGRAM_ID,
          }),
          createInitializeTransferFeeConfigInstruction(
              mint,
              transferFeeConfigAuthority.publicKey,
              withdrawWithheldAuthority.publicKey,
              feeBasisPoints,
              maxFee,
              TOKEN_2022_PROGRAM_ID
          ),
          createInitializeMintInstruction(mint, decimals, mintAuthority.publicKey, null, TOKEN_2022_PROGRAM_ID),
          createCreateMetadataAccountV3Instruction({
              metadata: metadataPDA,
              mint: mint,
              mintAuthority: payer.publicKey,
              payer: payer.publicKey,
              updateAuthority: payer.publicKey,
          }, {
              createMetadataAccountArgsV3:
              {
                  data: ON_CHAIN_METADATA,
                  isMutable: true,
                  collectionDetails: null
              }
          }, metadataProgram(connection)),
      );
      tx = await sendAndConfirmTransaction(connection, mintTransaction, [payer, mintKeypair], undefined);
  } catch (error) {
      console.error('Invalid address:', error);
  }
  return tx
}

const showWait = async (ctx: any, caption: string) => {
  return update(ctx, `⌛ ${caption}`)
}

async function deploySPLToken(connection: Connection, image: any, name: string, symbol: string, description: string, supply: string, taxes: string, payer: Keypair, ctx: any, msg: any): Promise<string> {

  try {
      let mintKeypair: Keypair;
      msg = await showWait(ctx, `Uploading metadata...`)

      const decimals = 9;
      const feeBasisPoints = Number(taxes) * 100; // 1%
      const uri = await uploadMetadata(image, name, symbol, description, feeBasisPoints)
      console.log("Metadata uploaded:", uri);

      // Generate keys for payer, mint authority, and mint
      const mintAuthority = payer
      mintKeypair = Keypair.generate();
      const owner = payer;
      // Generate keys for transfer fee config authority and withdrawal authority
      const transferFeeConfigAuthority = payer;
      const withdrawWithheldAuthority = payer;

      const mintAmount = BigInt(Number(supply) * Math.pow(10, decimals)); // Mint 1,000,000 tokens
      //const maxFee = BigInt(9 * Math.pow(10, decimals)); // 9 tokens
      const maxFee = mintAmount

      // Step 2 - Create a New Token

      msg = await showWait(ctx, `Deploying....`)

      const newTokenTx = await createNewToken(connection, payer, mintKeypair, mintKeypair.publicKey, decimals, mintAuthority, transferFeeConfigAuthority, withdrawWithheldAuthority, feeBasisPoints, maxFee, image, name, symbol, description, uri);
      //console.log("New Token Created:", generateExplorerTxUrl(newTokenTx));
      console.log("Token Address:", mintKeypair.publicKey.toBase58());

      // Step 3 - Mint tokens to Owner
      const sourceAccount = await createAssociatedTokenAccountIdempotent(connection, payer, mintKeypair.publicKey, owner.publicKey, {}, TOKEN_2022_PROGRAM_ID);
      const mintSig = await mintTo(connection, payer, mintKeypair.publicKey, sourceAccount, mintAuthority, mintAmount, [], undefined, TOKEN_2022_PROGRAM_ID);
      //console.log("Tokens Minted:", generateExplorerTxUrl(mintSig));

      console.log({
          msg
      })
      ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch((ex: any) => { })
      //ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id).catch((ex: any) => { })

      return mintKeypair.publicKey.toBase58()

  } catch (ex) {
      console.log(ex)
  }
  return ""

}