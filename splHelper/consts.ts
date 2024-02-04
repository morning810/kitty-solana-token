import { getFileData, writeFileData } from "./helper";
import { PublicKey } from "@solana/web3.js"
import { toPublicKey } from "@metaplex-foundation/js";
require("dotenv").config();

export const decimals = 6;
export const totalSupply = 96000000000;
export const name = "logo";
export const symbol = "$log";
export const image = "https://QmZYbSp1PQgezLR6bj2oEmcDBgzFEUHWzFHMkwesb8mYDP.ipfs.nftstorage.link/";
export const royalty = 350;// 1%
export const isMutable = true;
export const newUpdateAuthority = undefined;
export const mintAuthority = null;
export const freezeAuthority = null;
export const verifySignerAsCreator = true;
export const METADATA_2022_PROGRAM_ID = new PublicKey("META4s4fSmpkTbZoUsgC1oBnWB31vQcmnN8giPw51Zu")
export const METADATA_2022_PROGRAM_ID_TESTNET = new PublicKey("M1tgEZCz7fHqRAR3G5RLxU6c6ceQiZyFK7tzzy4Rof4")

export const networkName = !!process.env.NETWORK
  ? process.env.NETWORK
  : "mainnet";

const mintAddressConfig = {
  path: `outputs/${name.replace(" ", "_")}.txt`,
  key: "MINT_ADDRESS",
};
export const getMintAddress = async () => {
  return !!process.env.TOKEN_ADDRESS
    ? process.env.TOKEN_ADDRESS
    : getFileData(mintAddressConfig.path, mintAddressConfig.key);
};
export const setMintAddress = async (data: string) => {
  return writeFileData(mintAddressConfig.path, mintAddressConfig.key, data);
};

const mintKeypairConfig = {
  path: `outputs/${name.replace(" ", "_")}.txt`,
  key: "MINT_KEYPAIR",
};
export const setMintKeypair = async (data: string) => {
  return writeFileData(mintKeypairConfig.path, mintKeypairConfig.key, data);
};
