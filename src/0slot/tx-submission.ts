
import { PublicKey, TransactionInstruction, Keypair, Connection, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {connection, JITO_TIPS} from "../constants";
import bs58 from "bs58";
import axios from "axios";
// Define constants
const NOZOMI_TIP = new PublicKey("Eb2KpSC8uMt9GmzyAEm5Eb1AAAgTjRaXWFjKyFXHZxF3");
const MIN_TIP_AMOUNT = 1_000_000;

  // 0slot onchain tip accounts
const listOfTipsAddresses = [
    "Eb2KpSC8uMt9GmzyAEm5Eb1AAAgTjRaXWFjKyFXHZxF3",
    "FCjUJZ1qozm1e8romw216qyfQMaaWKxWsuySnumVCCNe",
    "ENxTEjSQ1YabmUpXAdCgevnHQ9MHdLv8tzFiuiYJqa13",
    "6rYLG55Q9RpsPGvqdPNJs4z5WTxJVatMB8zV3WJhs5EK",
    "Cix2bHfqPcKcM233mzxbLk14kSggUUiz2A87fJtGivXr"
]
// this is 0slot's ams server url, 
// if ur vm is not in ams,
// you should look for other server url in doc.
const Zer0slot_url = "http://ams1.0slot.trade?api-key="; 

// ask for the api key
// https://0slot.trade/
const Zer0slot_api_key = [
  "YOUR_0slot_HTTP_KEY"
]

export async function getRamdomValidator() {
    const randomIndex = Math.floor(Math.random() * listOfTipsAddresses.length);
    return new PublicKey(listOfTipsAddresses[randomIndex]);
}
export async function getRandom0slotAPIKey() {
  const randomIndex = Math.floor(Math.random() * Zer0slot_api_key.length);
  return Zer0slot_api_key[randomIndex];
}


export async function send0slotTx(
  ixs: any[],
  signer: Keypair,
  blockhash:any,
  dex:string,
  buyOrSell:string,
): Promise<any> {
    const validator = await getRamdomValidator();
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
    const blockhash1 = await connection.getLatestBlockhash();
  // Create transaction and sign it
  const tx = new Transaction().add(...ixs);
  if(typeof blockhash1 === "string") {
    tx.recentBlockhash = blockhash1;
  }else{
    tx.recentBlockhash = blockhash1.blockhash;
    tx.lastValidBlockHeight = blockhash1.lastValidBlockHeight;
  }
  tx.feePayer = signer.publicKey;
  tx.sign(signer);
  console.log(tx);
  const b64Tx = Buffer.from(tx.serialize()).toString('base64');
  let url_request = `${Zer0slot_url}${await getRandom0slotAPIKey()}`;

  let request;
  try{

    request = axios.post(url_request, {
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [ 
        b64Tx, 
        { "encoding": "base64" }
    ]
    });
    

    // for(const url of other_server_url){
    //   let url_request = `${url}${await getRandomNozomiAPIKey()}`;
    //   request = axios.post(url_request, {
    //     jsonrpc: "2.0",
    //     id: 1,
    //     method: "sendTransaction",
    //     params: [ 
    //       b64Tx, 
    //       { "encoding": "base64" }
    //   ]
    //   });
    // }

  

  }  catch (error) {
        console.log(`error sending tx to Nozomi: ${error}`);
        
      } 
  
  console.log("Transaction sent with signature:", request);
  
}

