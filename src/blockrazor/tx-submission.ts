
import { PublicKey, TransactionInstruction, Keypair, Connection, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {connection, JITO_TIPS} from "../constants";
import bs58 from "bs58";
import axios from "axios";
// Define constants
const BLOCKRAZOR_TIP = new PublicKey("Gywj98ophM7GmkDdaWs4isqZnDdFCW7B46TXmKfvyqSm");
const MIN_TIP_AMOUNT = 1_000_000;

// this is blockrazor's ams server url, 
// if ur vm is not in ams,
// you should look for other server url in doc.
const httpEndpoint = "http://amsterdam.solana.blockrazor.xyz:443/sendTransaction";
const healthEndpoint = "http://amsterdam.solana.blockrazor.xyz:443/health";

// blockrazor onchain tip accounts
const listOfTipAccounts = [
  "Gywj98ophM7GmkDdaWs4isqZnDdFCW7B46TXmKfvyqSm",
  "FjmZZrFvhnqqb9ThCuMVnENaM3JGVuGWNyCAxRJcFpg9",
  "6No2i3aawzHsjtThw81iq1EXPJN6rh8eSJCLaYZfKDTG",
  "A9cWowVAiHe9pJfKAj3TJiN9VpbzMUq6E4kEvf5mUT22",
  "68Pwb4jS7eZATjDfhmTXgRJjCiZmw1L7Huy4HNpnxJ3o",
  "4ABhJh5rZPjv63RBJBuyWzBK3g9gWMUQdTZP2kiW31V9",
  "B2M4NG5eyZp5SBQrSdtemzk5TqVuaWGQnowGaCBt8GyM",
  "5jA59cXMKQqZAVdtopv8q3yyw9SYfiE3vUCbt7p8MfVf",
  "5YktoWygr1Bp9wiS1xtMtUki1PeYuuzuCF98tqwYxf61",
  "295Avbam4qGShBYK7E9H5Ldew4B3WyJGmgmXfiWdeeyV",
  "EDi4rSy2LZgKJX74mbLTFk4mxoTgT6F7HxxzG2HBAFyK",
  "BnGKHAC386n4Qmv9xtpBVbRaUTKixjBe3oagkPFKtoy6",
  "Dd7K2Fp7AtoN8xCghKDRmyqr5U169t48Tw5fEd3wT9mq",
  "AP6qExwrbRgBAVaehg4b5xHENX815sMabtBzUzVB4v8S",
]

// ask for the api key
// https://www.blockrazor.io/
const BLOCKRAZOR_API_KEYS = [
    "YOUR_blockrazor_HTTP_KEY"
]

// BlockRazor configuration
const SEND_MODE = "fast";
const SAFE_WINDOW = 5;
const REVERT_PROTECTION = false;

export function getRamdomTipsAccounts() {
    const randomIndex = Math.floor(Math.random() * listOfTipAccounts.length);
    return new PublicKey(listOfTipAccounts[randomIndex]);
}
export function getRandomBlockrazorAPIKey() {
  const randomIndex = Math.floor(Math.random() * BLOCKRAZOR_API_KEYS.length);
  return BLOCKRAZOR_API_KEYS[randomIndex];
}

// HTTP client with connection reuse
const httpClient = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  httpAgent: new (require('http').Agent)({ keepAlive: true }),
  httpsAgent: new (require('https').Agent)({ keepAlive: true }),
});

// Health check to keep connection alive
export async function pingBlockrazorHealth() {
  try {
    const res = await httpClient.get(healthEndpoint);
    console.log(`BlockRazor health result:`, res.data);
  } catch (err) {
    console.error('BlockRazor health check failed:', err.message);
  }
}

export async function sendBlockrazorTx(
  ixs: any[],
  signer: Keypair,
  blockhash:any,
  dex:string,
  buyOrSell:string
): Promise<any> {
  const validator = getRamdomTipsAccounts();
  console.log("signer", signer.publicKey.toBase58());
  console.log("adding tip ix to our txn");
  // Create transfer instruction
  let tips = parseFloat(JITO_TIPS);
  const tipIx = SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: validator,
    lamports: tips*LAMPORTS_PER_SOL,
  });
  ixs.push(tipIx);

  // Get the latest blockhash
    // Get the latest blockhash
  const blockhash1 = blockhash;
  // Create transaction and sign it
  const tx = new Transaction().add(...ixs);
  if(typeof blockhash1 === "string") {
    tx.recentBlockhash = blockhash1;
  }else{
    tx.recentBlockhash = blockhash1.blockhash;
    tx.lastValidBlockHeight = blockhash1.lastValidBlockHeight
  }
  tx.feePayer = signer.publicKey;
  tx.sign(signer);
  console.log(tx);
  const b64Tx = Buffer.from(tx.serialize()).toString('base64');
  const apiKey = getRandomBlockrazorAPIKey();
  
  const payload = {
    transaction: b64Tx,
    mode: SEND_MODE,
    safeWindow: SAFE_WINDOW,
    RevertProtection: REVERT_PROTECTION,
  };
  
  console.log(`BlockRazor endpoint: ${httpEndpoint}`);
  let request;
  try{
    request = httpClient.post(httpEndpoint, payload, {
      headers: {
        'apikey': apiKey,
      }
    });
    

  

  }  catch (error) {
        console.log(`error sending tx to BlockRazor: ${error}`);
        
      } 
  
  console.log("Transaction sent with signature:", request);
  return request;
}

