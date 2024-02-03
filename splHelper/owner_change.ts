import {
  Keypair,
} from "@solana/web3.js";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import * as fs from 'fs';

//************************************************************** */
const keypair = Keypair.fromSecretKey(bs58.decode("your wallet public key"));
const secret_array = keypair.secretKey
    .toString() //convert secret key to string
    .split(',') //delimit string by commas and convert to an array of strings
    .map(value=>Number(value)); //convert string values to numbers inside the array
console.log("==", secret_array)
const secret = JSON.stringify(secret_array); //Covert to JSON string

fs.writeFile('keypair.json', secret, 'utf8', function(err) {
    if (err) throw err;
    console.log('Wrote secret key to guideSecret.json.');
});
//************************************************************** */
