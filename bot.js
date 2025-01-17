import dotenv from 'dotenv';
dotenv.config();
// Importing libraries
import constants from './Config/constants.js';

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

var init = async function () {
  try {
    var customWsProvider = new constants.ethers.providers.WebSocketProvider(constants.wss);
    const account = constants.wallet.connect(customWsProvider);
    const iface = new constants.ethers.utils.Interface([
      "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)",
      "function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)",
      "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin,address[] calldata path,address to,uint deadline)",
    ]);

    customWsProvider.on("pending", async (tx) => {
      try {
        const transaction = await customWsProvider.getTransaction(tx);
        
        if (transaction && transaction.to === "0x10ED43C718714eb63d5aA57B78B54704E256024E") {
          const value = constants.web3.utils.fromWei(transaction.value.toString());

          // Skip the transaction if the value is below MINVALUE
          if (value <= constants.minValue) {
            return;
          }

          const gasPrice = constants.web3.utils.fromWei(transaction.gasPrice.toString());
          const gasLimit = constants.web3.utils.fromWei(transaction.gasLimit.toString());

                // for example we will be only showing transaction that are higher than 30 bnb
                if (value > constants.minValue) {
                  console.log("value : ", value);
                  console.log("gasPrice : ", gasPrice);
                  console.log("gasLimit : ", gasLimit);
                  //we can print the sender of that transaction
                  console.log("from", transaction.from);
          
                  let result = [];
                  //we will use try and catch to handle the error and decode the data of the function used to swap the token
                  try {
                    result = iface.decodeFunctionData(
                      "swapExactETHForTokens",
                      transaction.data
                    );
                  } catch (error) {
                    try {
                      result = iface.decodeFunctionData(
                        "swapExactETHForTokensSupportingFeeOnTransferTokens",
                        transaction.data
                      );
                    } catch (error) {
                      try {
                        result = iface.decodeFunctionData(
                          "swapETHForExactTokens",
                          transaction.data
                        );
                      } catch (error) {
                        console.log("final err : ", transaction);
                      }
                    }
                  }
        
                  if (result.length > 0) {
                    let tokenAddress = result[1][1];
                    console.log("tokenAddress", tokenAddress);

                    if (constants.blacklist.includes(tokenAddress)) {
                      console.log(`Token Address: ${tokenAddress} is in the blacklist, so we will ignore this transaction.`);
                      return;
                    } else if (!constants.whitelist.includes(tokenAddress)) {
                      console.log(`Token Address: ${tokenAddress} is not in the whitelist, and not in the blacklist. Proceeding with caution.`);
                    }

                    const buyGasPrice = constants.calculate_gas_price("buy", transaction.gasPrice);
                    const sellGasPrice = constants.calculate_gas_price("sell", transaction.gasPrice);

                    console.log("Going to buy");
                    const buyTransaction = await constants.buyToken(account, tokenAddress, transaction.gasLimit, buyGasPrice);

                    if (buyTransaction) {
                      console.log("Going to sell the token");
                      const sellTransaction = await constants.sellToken(account, tokenAddress, transaction.gasLimit, sellGasPrice);
                      if (sellTransaction) {
                        console.log("Successfully sold the token.");
                      } else {
                        console.log("Failed to sell the token.");
                      }
                    } else {
                      console.log("Failed to buy the token.");
                    }
                  }
                }
              }
            } catch (err) {
              console.error(`Error processing transaction for tx: ${tx}`);
              console.error(err);
            }
          });
      
          customWsProvider._websocket.on("error", async (ep) => {
            console.log(`Unable to connect to ${ep.subdomain} retrying in 3s...`);
            setTimeout(init, 3000);
          });
      
          customWsProvider._websocket.on("close", async (code) => {
            console.log(`Connection lost with code ${code}! Attempting reconnect in 3s...`);
            customWsProvider._websocket.terminate();
            setTimeout(init, 3000);
          });
        } catch (err) {
          console.error('An error occurred:', err);
        }
      };
      
      init();
//now we create the express server
const server = constants.http.createServer(constants.app);
// we launch the server
server.listen(constants.PORT, () => {
  console.log(`Listening on port ${constants.PORT}`);
});
