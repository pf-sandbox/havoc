import {
    createTraderAPIMemoInstruction,
    HttpProvider
  } from "@bloxroute/solana-trader-client-ts";
  import {connection, JITO_TIPS} from "../constants";  
  import {
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
    Keypair,
    SystemProgram,
    Transaction,
  } from "@solana/web3.js";
  import base58 from "bs58";
  
  // bloXroute onchain tip accounts
  const TRADER_API_TIP_WALLET = [
    "HWEoBxYs7ssKuudEjzjmpfJVX7Dvi7wescFsVx2L5yoY",
    "95cfoy472fcQHaw4tPGBTKpn6ZQnfEPfBgDQx6gcRmRg",
    "3UQUKjhMKaY2S6bjcQD6yHB7utcZt5bfarRCmctpRtUd",
    "FogxVNs6Mm2w9rnGL1vkARSwJxvLE8mujTv3LK8RnUhF"
  ];
  const BLOXROUTE_API_KEYS = "YOUR_AUTH_API_KEY";
  
  // please use a wallet have no balance
  const WALLET_SECRET_KEYS_FOR_BLOXROUTE_AUTH = "ANY_WALLET_PRIVATE_KEY"; 
  
  // you should look for other server url in doc.
  const BLOXROUTE_AMS_ENDPOINT = "http://amsterdam.solana.dex.blxrbdn.com"
  
  

  


  
  export function getRandomBloXrouteTipWallet() {
    const randomIndex = Math.floor(Math.random() * TRADER_API_TIP_WALLET.length);
    return new PublicKey(TRADER_API_TIP_WALLET[randomIndex]);
  }
  export async function createBloXrouteTipTransaction(
    senderAddress: PublicKey,
    tipAmountInLamports: number
  ) {
    const tipAddress = getRandomBloXrouteTipWallet();
    return SystemProgram.transfer({
      fromPubkey: senderAddress,
      toPubkey: tipAddress,
      lamports: tipAmountInLamports,
    });
  }
  
  export async function sendBloXrouteTx(
    ixs: any[],
    signer: Keypair,
    blockhash: any,
    dex: string,
    buyOrSell: string
  ): Promise<any> {
    console.log("bloXroute: ", ixs.length);
    
    // Create provider with random credentials
    const provider = new HttpProvider(
      BLOXROUTE_API_KEYS,
      WALLET_SECRET_KEYS_FOR_BLOXROUTE_AUTH,
      BLOXROUTE_AMS_ENDPOINT
    );
    
    // Calculate tip amount
    let tips = 0.001;
 
    
    // Create tip instruction
    const tipWallet = getRandomBloXrouteTipWallet();
    console.log("Sending tip to bloXroute wallet:", tipWallet.toBase58());
    const tipIx = await createBloXrouteTipTransaction(
      signer.publicKey,
      tips * LAMPORTS_PER_SOL
    );
    ixs.push(tipIx);
    
    // Create memo instruction for better performance
    const memo = createTraderAPIMemoInstruction(
      "Powered by bloXroute Trader Api"
    );
    ixs.push(memo);
    
    // Get recent blockhash
    const recentBlockhash = await provider.getRecentBlockHash({});
    
    // Create and sign transaction
    const tx = new Transaction({
      recentBlockhash: recentBlockhash.blockHash,
      feePayer: signer.publicKey,
    });
    
    tx.add(...ixs);
    tx.sign(signer);
    
    const b64Tx = Buffer.from(tx.serialize()).toString('base64');
    
    const request = {
      transaction: { content: b64Tx, isCleanup: false },
      frontRunningProtection: false,
      useStakedRPCs: true,
      skipPreFlight: false,
    };
    
    let response;
    try {
      console.log("Submitting transaction to bloXroute...");
      response = await provider.postSubmit(request);
      
      if (response.signature) {
        console.log(
          `✅ bloXroute txn landed successfully\nSignature: https://solscan.io/tx/${response.signature}`
        );
      } else {
        console.log("❌ bloXroute Transaction failed");
      }
    } catch (error) {
      console.log(`error sending tx to bloXroute: ${error}`);
    }
    
    console.log("Transaction sent with signature:", response);
    return response;
  }