import { ExtensionType, TOKEN_2022_PROGRAM_ID, createAssociatedTokenAccountIdempotent, createInitializeMintInstruction, createInitializeTransferFeeConfigInstruction, getAssociatedTokenAddress, getMintLen, getTransferFeeAmount, mintTo, unpackAccount, withdrawWithheldTokensFromAccounts,
    TYPE_SIZE,
    LENGTH_SIZE,
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

import { METADATA_2022_PROGRAM_ID, METADATA_2022_PROGRAM_ID_TESTNET } from "./consts";
import { DataV2, createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
const fs = require("fs")
const path = require("path")
const mime = require('mime')


export async function fileFromPath(filePath: string) {
    const content = await fs.promises.readFile(filePath)
    const type = mime.getType(filePath)
    return new File([content], path.basename(filePath), { type })
}


function metadataProgram(connection: Connection): PublicKey {
    const isDevnet = connection.rpcEndpoint.indexOf("devnet") > -1;
    console.log("======== devnet:", isDevnet);
    return isDevnet ? METADATA_2022_PROGRAM_ID_TESTNET : METADATA_2022_PROGRAM_ID
}

export async function deploySPLToken(connection: Connection, image: any, name: string, symbol: string, description: string, supply: string, taxes: string, payer: Keypair): Promise<string> {
    let mintKeypair: Keypair;
    
    const decimals = 9;
    const feeBasisPoints = Number(taxes) * 100; // 1%
    const uri = "https://bafkreievpa5j5w7mpbny3gpzvwdckculahwnvzwpnaekns5dvrj7kma5ra.ipfs.nftstorage.link/"
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

    const newTokenTx = await createNewToken(connection, payer, mintKeypair, mintKeypair.publicKey, decimals, mintAuthority, transferFeeConfigAuthority, withdrawWithheldAuthority, feeBasisPoints, maxFee, name, symbol, description, uri);
    //console.log("New Token Created:", generateExplorerTxUrl(newTokenTx));
    console.log("Token Address:", mintKeypair.publicKey.toBase58());

    // Step 3 - Mint tokens to Owner
    const sourceAccount = await createAssociatedTokenAccountIdempotent(connection, payer, mintKeypair.publicKey, owner.publicKey, {}, TOKEN_2022_PROGRAM_ID);
    const mintSig = await mintTo(connection, payer, mintKeypair.publicKey, sourceAccount, mintAuthority, mintAmount, [], undefined, TOKEN_2022_PROGRAM_ID);
    //console.log("Tokens Minted:", generateExplorerTxUrl(mintSig));

    return mintKeypair.publicKey.toBase58()

}


export async function createNewToken(connection: Connection, payer: Keypair, mintKeypair: Keypair, mint: PublicKey, decimals: number, mintAuthority: Keypair, transferFeeConfigAuthority: Keypair, withdrawWithheldAuthority: Keypair, feeBasisPoints: number, maxFee: bigint, name: string, symbol: string, description: string, uri: string): Promise<string> {
    let tx = ""
    try {
        // Define the extensions to be used by the mint
        const extensions = [
            ExtensionType.TransferFeeConfig,
        ];

        //Create token metadata
        const [metadataPDA] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), metadataProgram(connection).toBuffer(), mint.toBuffer()], metadataProgram(connection))

        console.log("==== metadataPDA:", metadataPDA)
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
        const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
        // Size of metadata
        const mintLamports = await connection.getMinimumBalanceForRentExemption(
            /*metadataExtension + */mintLen,
        );
        // const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);
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
