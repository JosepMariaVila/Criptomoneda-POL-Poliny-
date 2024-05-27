const xrpl = require("xrpl");
// hot address: rnx3tUMGWDrazjVgZwDRdHWi4BzbqnVzWx (clau/adreça pública del receptor inicial dels POL)
const seed1 = "sate7QZLwBtXXXXXXXXXX3VgKNJKi"; // (clau privada del receptor inicial dels POL)
// cold address: rnSWeJnqzXGK26sgPYFm1fKRznYNuw8EJd (clau/adreça pública de l'issuer dels POL)
const seed2 = "seuuEA8AvATbNYYYYYYYYYYcE95Ym"; // (clau privada de l'issuer dels POL)

// Connect ---------------------------------------------------------------------
async function main() {
  const client = new xrpl.Client("wss://xrplcluster.com");
  console.log("Connecting to Testnet...");
  await client.connect();

  const hot_wallet = xrpl.Wallet.fromSeed(seed1);
  const cold_wallet = xrpl.Wallet.fromSeed(seed2);
  console.log(
    `Got hot address ${hot_wallet.address} and cold address ${cold_wallet.address}.`
  );

  // Configure issuer (cold address) settings ----------------------------------
  const cold_settings_tx = {
    TransactionType: "AccountSet",
    Account: cold_wallet.address,
    SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple,
  };

  const cst_prepared = await client.autofill(cold_settings_tx);
  const cst_signed = cold_wallet.sign(cst_prepared);
  console.log("Sending cold address AccountSet transaction...");
  const cst_result = await client.submitAndWait(cst_signed.tx_blob);
  if (cst_result.result.meta.TransactionResult == "tesSUCCESS") {
    console.log(
      `Transaction succeeded: https://bithomp.com/explorer/${cst_signed.hash}`
    );
  } else {
    throw `Error sending transaction: ${cst_result}`;
  }

  // Create trust line from hot to cold address --------------------------------
  const currency_code = "POL";
  const trust_set_tx = {
    TransactionType: "TrustSet",
    Account: hot_wallet.address,
    LimitAmount: {
      currency: currency_code,
      issuer: cold_wallet.address,
      value: "99000000", // Arbitrarily chosen
    },
  };

  const ts_prepared = await client.autofill(trust_set_tx);
  const ts_signed = hot_wallet.sign(ts_prepared);
  console.log("Creating trust line from hot address to issuer...");
  const ts_result = await client.submitAndWait(ts_signed.tx_blob);
  if (ts_result.result.meta.TransactionResult == "tesSUCCESS") {
    console.log(
      `Transaction succeeded: https://bithomp.com/explorer/${ts_signed.hash}`
    );
  } else {
    throw `Error sending transaction: ${ts_result.result.meta.TransactionResult}`;
  }

  // Send token ----------------------------------------------------------------
  let issue_quantity = "99000000";

  const send_token_tx = {
    TransactionType: "Payment",
    Account: cold_wallet.address,
    Amount: {
      currency: currency_code,
      value: issue_quantity,
      issuer: cold_wallet.address,
    },
    Destination: hot_wallet.address,
  };

  const pay_prepared = await client.autofill(send_token_tx);
  const pay_signed = cold_wallet.sign(pay_prepared);
  console.log(
    `Cold to hot - Sending ${issue_quantity} ${currency_code} to ${hot_wallet.address}...`
  );
  const pay_result = await client.submitAndWait(pay_signed.tx_blob);
  if (pay_result.result.meta.TransactionResult == "tesSUCCESS") {
    console.log(
      `Transaction succeeded: https://bithomp.com/explorer/${pay_signed.hash}`
    );
  } else {
    console.log(pay_result);
    throw `Error sending transaction: ${pay_result.result.meta.TransactionResult}`;
  }

  // Check balances ------------------------------------------------------------
  console.log("Getting hot address balances...");
  const hot_balances = await client.request({
    command: "account_lines",
    account: hot_wallet.address,
    ledger_index: "validated",
  });
  console.log(hot_balances.result);

  console.log("Getting cold address balances...");
  const cold_balances = await client.request({
    command: "gateway_balances",
    account: cold_wallet.address,
    ledger_index: "validated",
    hotwallet: [hot_wallet.address],
  });
  console.log(JSON.stringify(cold_balances.result, null, 2));

  client.disconnect();
} // End of main()

main();
